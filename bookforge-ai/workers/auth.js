const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type,Authorization"
};

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") return json({}, 204);
    try {
      const url = new URL(request.url);
      if (request.method === "POST" && url.pathname.includes("request-link")) return await requestLink(request, env);
      if (request.method === "POST" && url.pathname.includes("verify")) return await verifyLink(request, env);
      if (request.method === "GET" && url.pathname.includes("me")) return await me(request, env);
      if (request.method === "POST" && url.pathname.includes("logout")) return await logout(request, env);
      return json({ error: "Route not found" }, 404);
    } catch (error) {
      return json({ error: error.message || "Authentication error" }, 500);
    }
  }
};

async function requestLink(request, env) {
  const { email } = await request.json();
  const cleanEmail = normalizeEmail(email);
  const token = crypto.randomUUID();
  const expiresIn = Number(env.MAGIC_LINK_TTL_SECONDS || "900");
  const appUrl = env.APP_URL || new URL(request.url).origin;
  const link = `${appUrl}/dashboard.html?magic=${token}`;

  await env.BOOKFORGE_KV.put(`magic:${token}`, JSON.stringify({ email: cleanEmail, created_at: Date.now() }), { expirationTtl: expiresIn });
  const user = await env.BOOKFORGE_KV.get(`user:${cleanEmail}`, "json");
  if (!user) {
    await env.BOOKFORGE_KV.put(`user:${cleanEmail}`, JSON.stringify({ email: cleanEmail, plan: "free", created_at: new Date().toISOString() }));
  }

  if (env.RESEND_API_KEY && env.EMAIL_FROM) {
    await sendMagicEmail(env, cleanEmail, link);
    return json({ ok: true, message: "Revisa tu email para entrar." });
  }

  return json({ ok: true, message: "Magic link creado.", magicLink: link });
}

async function verifyLink(request, env) {
  const { token } = await request.json();
  if (!token) return json({ error: "Token required" }, 400);
  const magic = await env.BOOKFORGE_KV.get(`magic:${token}`, "json");
  if (!magic?.email) return json({ error: "Magic link inválido o caducado" }, 401);

  const sessionToken = crypto.randomUUID();
  const ttl = Number(env.SESSION_TTL_SECONDS || "2592000");
  await env.BOOKFORGE_KV.put(`session:${sessionToken}`, JSON.stringify({ email: magic.email, created_at: new Date().toISOString() }), { expirationTtl: ttl });
  await env.BOOKFORGE_KV.delete(`magic:${token}`);

  const user = await env.BOOKFORGE_KV.get(`user:${magic.email}`, "json");
  return json({ token: sessionToken, user: user || { email: magic.email, plan: "free" } });
}

async function me(request, env) {
  const session = await requireSession(request, env);
  const user = await env.BOOKFORGE_KV.get(`user:${session.email}`, "json");
  return json({ user: user || { email: session.email, plan: "free" } });
}

async function logout(request, env) {
  const token = getBearer(request);
  if (token) await env.BOOKFORGE_KV.delete(`session:${token}`);
  return json({ ok: true });
}

async function sendMagicEmail(env, email, link) {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${env.RESEND_API_KEY}` },
    body: JSON.stringify({
      from: env.EMAIL_FROM,
      to: email,
      subject: "Tu acceso a BookForge AI",
      html: `<div style="font-family:Arial,sans-serif;line-height:1.6"><h1>Entra en BookForge AI</h1><p>Haz clic para abrir tu dashboard:</p><p><a href="${link}" style="background:#6366f1;color:white;padding:12px 18px;border-radius:8px;text-decoration:none">Entrar ahora</a></p><p>Este enlace caduca pronto.</p></div>`
    })
  });
  if (!response.ok) throw new Error("No se pudo enviar el magic link");
}

async function requireSession(request, env) {
  const token = getBearer(request);
  if (!token) throw new Error("Unauthorized");
  const session = await env.BOOKFORGE_KV.get(`session:${token}`, "json");
  if (!session?.email) throw new Error("Invalid session");
  return session;
}

function getBearer(request) {
  return (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
}

function normalizeEmail(email) {
  const clean = String(email || "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) throw new Error("Email inválido");
  return clean;
}

function json(data, status = 200) {
  return new Response(status === 204 ? null : JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
}
