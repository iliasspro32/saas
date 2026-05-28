const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type,Authorization"
};

const CONFIG_KEY = "admin:config";
const ADMIN_AUTH_KEY = "admin:auth";
const SECRET_FIELDS = ["geminiApiKey", "openRouterApiKey", "anthropicApiKey", "stripeSecretKey", "stripeWebhookSecret", "resendApiKey"];

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") return json({}, 204);
    try {
      const url = new URL(request.url);
      if (request.method === "POST" && url.pathname.includes("setup")) return await setupAdmin(request, env);
      await requireAdmin(request, env);
      if (request.method === "GET" && url.pathname.includes("config")) return await getConfig(env);
      if (request.method === "POST" && url.pathname.includes("config")) return await saveConfig(request, env);
      if (request.method === "GET" && url.pathname.includes("status")) return await status(env);
      if (request.method === "POST" && url.pathname.includes("test-gemini")) return await testGemini(env);
      if (request.method === "POST" && url.pathname.includes("test-openrouter")) return await testOpenRouter(env);
      return json({ error: "Route not found" }, 404);
    } catch (error) {
      return json({ error: error.message || "Admin error" }, Number(error.status || 500));
    }
  }
};

async function setupAdmin(request, env) {
  if (!env.BOOKFORGE_KV) {
    throw httpError("Falta la vinculacion KV con nombre exacto BOOKFORGE_KV.", 500);
  }

  const existing = await env.BOOKFORGE_KV.get(ADMIN_AUTH_KEY, "json");
  if (env.ADMIN_TOKEN || existing?.hash) {
    throw httpError("El admin ya esta configurado. Entra con tu token actual.", 409);
  }

  const { token } = await request.json().catch(() => ({}));
  const cleanToken = String(token || "").trim();
  if (cleanToken.length < 8) throw httpError("La clave admin debe tener minimo 8 caracteres.", 400);

  await env.BOOKFORGE_KV.put(ADMIN_AUTH_KEY, JSON.stringify({
    hash: await sha256(cleanToken),
    createdAt: new Date().toISOString()
  }));

  return json({ ok: true, message: "Admin creado. Ya puedes entrar con esa clave." });
}

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
    geminiModel: clean(incoming.geminiModel, current.geminiModel || env.GEMINI_MODEL || "gemini-2.5-pro"),
    geminiMaxTokens: clean(incoming.geminiMaxTokens, current.geminiMaxTokens || env.GEMINI_MAX_TOKENS || "12000"),
    aiProvider: clean(incoming.aiProvider, current.aiProvider || env.AI_PROVIDER || "gemini"),
    openRouterModel: clean(incoming.openRouterModel, current.openRouterModel || env.OPENROUTER_MODEL || "anthropic/claude-sonnet-4"),
    openRouterMaxTokens: clean(incoming.openRouterMaxTokens, current.openRouterMaxTokens || env.OPENROUTER_MAX_TOKENS || "4096"),
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
  const hasStoredAdmin = Boolean((await env.BOOKFORGE_KV?.get(ADMIN_AUTH_KEY, "json"))?.hash);
  return json({
    ok: true,
    kvConfigured: Boolean(env.BOOKFORGE_KV),
    adminProtected: Boolean(env.ADMIN_TOKEN || hasStoredAdmin),
    needsSetup: !env.ADMIN_TOKEN && !hasStoredAdmin,
    geminiConfigured: Boolean(env.GEMINI_API_KEY || config.geminiApiKey),
    geminiModel: config.geminiModel || env.GEMINI_MODEL || "gemini-2.5-pro",
    openRouterConfigured: Boolean(env.OPENROUTER_API_KEY || config.openRouterApiKey),
    openRouterModel: config.openRouterModel || env.OPENROUTER_MODEL || "anthropic/claude-sonnet-4",
    aiProvider: config.aiProvider || env.AI_PROVIDER || "gemini",
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
  const model = config.geminiModel || env.GEMINI_MODEL || "gemini-2.5-pro";
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

async function testOpenRouter(env) {
  const config = await readConfig(env);
  const apiKey = env.OPENROUTER_API_KEY || config.openRouterApiKey;
  if (!apiKey) throw httpError("Falta OPENROUTER_API_KEY. Guarda una clave en Admin o en Cloudflare.", 400);
  const model = config.openRouterModel || env.OPENROUTER_MODEL || "anthropic/claude-sonnet-4";
  const appUrl = config.appUrl || env.APP_URL || "https://saas-7ro.pages.dev";
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
      "HTTP-Referer": appUrl,
      "X-Title": "BookForge AI"
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: "Responde solo JSON valido." },
        { role: "user", content: "{\"ok\":true,\"provider\":\"openrouter\"}" }
      ],
      max_tokens: 128,
      temperature: 0.2,
      response_format: { type: "json_object" }
    })
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw httpError(data?.error?.message || "OpenRouter test failed", response.status);
  return json({ ok: true, model, response: data?.choices?.[0]?.message?.content || "" });
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

async function requireAdmin(request, env) {
  const token = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) throw httpError("Admin no autorizado", 401);
  if (env.ADMIN_TOKEN && token === env.ADMIN_TOKEN) return;

  const stored = await env.BOOKFORGE_KV?.get(ADMIN_AUTH_KEY, "json");
  if (stored?.hash && await sha256(token) === stored.hash) return;

  if (!env.ADMIN_TOKEN && !stored?.hash) {
    throw httpError("Admin sin configurar. Crea una clave desde el boton Primer acceso.", 428);
  }

  throw httpError("Admin no autorizado", 401);
}

function clean(value, fallback) {
  return typeof value === "string" ? value.trim() : fallback;
}

function httpError(message, status = 500) {
  const error = new Error(message);
  error.status = status;
  return error;
}

async function sha256(value) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function json(data, status = 200) {
  return new Response(status === 204 ? null : JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
}
