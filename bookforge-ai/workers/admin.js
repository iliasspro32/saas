const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type,Authorization"
};

const CONFIG_KEY = "admin:config";
const SECRET_FIELDS = ["geminiApiKey", "anthropicApiKey", "stripeSecretKey", "stripeWebhookSecret", "resendApiKey"];

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") return json({}, 204);
    try {
      requireAdmin(request, env);
      const url = new URL(request.url);
      if (request.method === "GET" && url.pathname.includes("config")) return await getConfig(env);
      if (request.method === "POST" && url.pathname.includes("config")) return await saveConfig(request, env);
      if (request.method === "GET" && url.pathname.includes("status")) return await status(env);
      if (request.method === "POST" && url.pathname.includes("test-gemini")) return await testGemini(env);
      return json({ error: "Route not found" }, 404);
    } catch (error) {
      return json({ error: error.message || "Admin error" }, Number(error.status || 500));
    }
  }
};

async function getConfig(env) {
  const config = await readConfig(env);
  return json({ config: maskSecrets(config) });
}

async function saveConfig(request, env) {
  if (!env.BOOKFORGE_KV) {
    throw httpError("No puedo guardar: falta la vinculacion KV con nombre exacto BOOKFORGE_KV en Cloudflare Pages.", 500);
  }

  const incoming = await request.json().catch(() => ({}));
  const current = await readConfig(env);
  const next = {
    ...current,
    appUrl: clean(incoming.appUrl, current.appUrl || env.APP_URL || ""),
    geminiModel: clean(incoming.geminiModel, current.geminiModel || env.GEMINI_MODEL || "gemini-2.0-flash"),
    geminiMaxTokens: clean(incoming.geminiMaxTokens, current.geminiMaxTokens || env.GEMINI_MAX_TOKENS || "12000"),
    stripeProPriceId: clean(incoming.stripeProPriceId, current.stripeProPriceId || env.STRIPE_PRO_PRICE_ID || ""),
    stripeAgencyPriceId: clean(incoming.stripeAgencyPriceId, current.stripeAgencyPriceId || env.STRIPE_AGENCY_PRICE_ID || ""),
    emailFrom: clean(incoming.emailFrom, current.emailFrom || env.EMAIL_FROM || ""),
    updatedAt: new Date().toISOString()
  };

  for (const field of SECRET_FIELDS) {
    if (typeof incoming[field] === "string" && incoming[field].trim() && !incoming[field].includes("••••")) {
      next[field] = incoming[field].trim();
    }
  }

  await env.BOOKFORGE_KV.put(CONFIG_KEY, JSON.stringify(next));
  return json({ ok: true, config: maskSecrets(next) });
}

async function status(env) {
  const config = await readConfig(env);
  return json({
    ok: true,
    kvConfigured: Boolean(env.BOOKFORGE_KV),
    adminProtected: Boolean(env.ADMIN_TOKEN),
    geminiConfigured: Boolean(env.GEMINI_API_KEY || config.geminiApiKey),
    geminiModel: config.geminiModel || env.GEMINI_MODEL || "gemini-2.0-flash",
    stripeConfigured: Boolean(env.STRIPE_SECRET_KEY || config.stripeSecretKey),
    stripePricesConfigured: Boolean((env.STRIPE_PRO_PRICE_ID || config.stripeProPriceId) && (env.STRIPE_AGENCY_PRICE_ID || config.stripeAgencyPriceId)),
    emailConfigured: Boolean((env.RESEND_API_KEY || config.resendApiKey) && (env.EMAIL_FROM || config.emailFrom)),
    appUrl: config.appUrl || env.APP_URL || "",
    updatedAt: config.updatedAt || null
  });
}

async function testGemini(env) {
  const config = await readConfig(env);
  const apiKey = env.GEMINI_API_KEY || config.geminiApiKey;
  if (!apiKey) throw httpError("Falta GEMINI_API_KEY. Guarda una clave en Admin o usa wrangler secret put GEMINI_API_KEY.", 400);
  const model = config.geminiModel || env.GEMINI_MODEL || "gemini-2.0-flash";
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: "Responde solo JSON valido: {\"ok\":true,\"provider\":\"gemini\"}" }] }],
      generationConfig: { responseMimeType: "application/json", maxOutputTokens: 128 }
    })
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw httpError(data?.error?.message || "Gemini test failed", response.status);
  return json({ ok: true, model, response: data?.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("").trim() });
}

async function readConfig(env) {
  if (!env.BOOKFORGE_KV) return {};
  return await env.BOOKFORGE_KV.get(CONFIG_KEY, "json") || {};
}

function maskSecrets(config) {
  const masked = { ...config };
  for (const field of SECRET_FIELDS) {
    if (masked[field]) masked[field] = `••••${String(masked[field]).slice(-4)}`;
  }
  return masked;
}

function requireAdmin(request, env) {
  const expected = env.ADMIN_TOKEN;
  if (!expected) throw httpError("Missing environment variable: ADMIN_TOKEN", 500);
  const token = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token || token !== expected) throw httpError("Admin no autorizado", 401);
}

function clean(value, fallback) {
  return typeof value === "string" ? value.trim() : fallback;
}

function httpError(message, status = 500) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function json(data, status = 200) {
  return new Response(status === 204 ? null : JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
}
