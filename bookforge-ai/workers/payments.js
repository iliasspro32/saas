const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type,Authorization,Stripe-Signature"
};

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") return json({}, 204);
    try {
      const url = new URL(request.url);
      if (request.method === "POST" && url.pathname.includes("checkout")) return await checkout(request, env);
      if (request.method === "POST" && url.pathname.includes("portal")) return await portal(request, env);
      if (request.method === "POST" && url.pathname.includes("webhook")) return await webhook(request, env);
      return json({ error: "Route not found" }, 404);
    } catch (error) {
      return json({ error: error.message || "Payment error" }, 500);
    }
  }
};

async function checkout(request, env) {
  assertEnv(env, ["STRIPE_SECRET_KEY"]);
  const user = await requireSession(request, env);
  const { plan } = await request.json();
  const price = plan === "agency" ? env.STRIPE_AGENCY_PRICE_ID : env.STRIPE_PRO_PRICE_ID;
  if (!price) return json({ error: "Stripe price is not configured" }, 500);

  const appUrl = env.APP_URL || new URL(request.url).origin;
  const body = new URLSearchParams({
    mode: "subscription",
    success_url: `${appUrl}/dashboard.html?checkout=success`,
    cancel_url: `${appUrl}/pricing.html?checkout=cancelled`,
    "line_items[0][price]": price,
    "line_items[0][quantity]": "1",
    "customer_email": user.email,
    "metadata[email]": user.email,
    "metadata[plan]": plan === "agency" ? "agency" : "pro"
  });

  const session = await stripe(env, "/v1/checkout/sessions", body);
  return json({ url: session.url });
}

async function portal(request, env) {
  assertEnv(env, ["STRIPE_SECRET_KEY"]);
  const user = await requireSession(request, env);
  const record = await env.BOOKFORGE_KV.get(`user:${user.email}`, "json");
  if (!record?.stripe_customer_id) return json({ error: "No Stripe customer found" }, 404);

  const appUrl = env.APP_URL || new URL(request.url).origin;
  const session = await stripe(env, "/v1/billing_portal/sessions", new URLSearchParams({
    customer: record.stripe_customer_id,
    return_url: `${appUrl}/dashboard.html`
  }));
  return json({ url: session.url });
}

async function webhook(request, env) {
  assertEnv(env, ["STRIPE_WEBHOOK_SECRET"]);
  const raw = await request.text();
  const signature = request.headers.get("stripe-signature") || "";
  const event = await verifyStripeEvent(raw, signature, env.STRIPE_WEBHOOK_SECRET);

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const email = session.metadata?.email || session.customer_details?.email || session.customer_email;
    const plan = session.metadata?.plan || "pro";
    if (email) await upsertUser(env, email, { plan, stripe_customer_id: session.customer, subscription_status: "active" });
  }

  if (event.type === "customer.subscription.deleted") {
    const subscription = event.data.object;
    const users = await findUserByCustomer(env, subscription.customer);
    for (const email of users) await upsertUser(env, email, { plan: "free", subscription_status: "cancelled" });
  }

  return json({ received: true });
}

async function stripe(env, path, body) {
  const response = await fetch(`https://api.stripe.com${path}`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
      "content-type": "application/x-www-form-urlencoded"
    },
    body
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.error?.message || "Stripe request failed");
  return data;
}

async function verifyStripeEvent(raw, signature, secret) {
  const pairs = Object.fromEntries(signature.split(",").map((part) => part.split("=")));
  if (!pairs.t || !pairs.v1) throw new Error("Missing Stripe signature");
  const payload = `${pairs.t}.${raw}`;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signed = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  const hex = [...new Uint8Array(signed)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  if (!timingSafeEqual(hex, pairs.v1)) throw new Error("Invalid Stripe signature");
  return JSON.parse(raw);
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

async function upsertUser(env, email, patch) {
  const key = `user:${email}`;
  const current = await env.BOOKFORGE_KV.get(key, "json") || { email, created_at: new Date().toISOString() };
  const next = { ...current, ...patch, updated_at: new Date().toISOString() };
  await env.BOOKFORGE_KV.put(key, JSON.stringify(next));
  if (next.stripe_customer_id) await env.BOOKFORGE_KV.put(`stripe_customer:${next.stripe_customer_id}:${email}`, "1");
}

async function findUserByCustomer(env, customer) {
  const result = await env.BOOKFORGE_KV.list({ prefix: `stripe_customer:${customer}:` });
  return result.keys.map((key) => key.name.split(":").slice(2).join(":")).filter(Boolean);
}

async function requireSession(request, env) {
  const token = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) throw new Error("Unauthorized");
  const session = await env.BOOKFORGE_KV.get(`session:${token}`, "json");
  if (!session?.email) throw new Error("Invalid session");
  return session;
}

function assertEnv(env, keys) {
  for (const key of keys) if (!env[key]) throw new Error(`Missing environment variable: ${key}`);
}

function json(data, status = 200) {
  return new Response(status === 204 ? null : JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
}
