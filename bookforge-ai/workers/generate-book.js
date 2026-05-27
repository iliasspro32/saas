const SYSTEM_PROMPT = "Eres un autor y editor profesional con 20 años publicando en Amazon KDP y plataformas digitales. Generas libros completos, bien estructurados, con contenido de valor real, listos para publicar sin edición adicional. Escribe como experto humano, no como IA. SIEMPRE responde en JSON válido sin texto adicional fuera del JSON.";

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
      if (request.method === "GET" && url.pathname.includes("health")) return health(env);
      if (request.method === "GET") return await listBooks(request, env);
      if (request.method === "POST" && url.pathname.includes("regenerate-section")) return await regenerateSection(request, env);
      if (request.method === "POST") return await generateBook(request, env);
      return json({ error: "Method not allowed" }, 405);
    } catch (error) {
      const status = Number(error.status || 500);
      return json({ error: error.message || "Unexpected server error" }, status);
    }
  }
};

async function generateBook(request, env) {
  const input = await readJson(request);

  if (input.topic) {
    return await generateStudioBook(input, env);
  }

  assertEnv(env, ["ANTHROPIC_API_KEY"]);
  const user = await requireSession(request, env);
  const clean = validateInput(input);
  const plan = await getPlan(env, user.email);
  const bookCount = Number((await env.BOOKFORGE_KV.get(`usage:${user.email}:books`)) || "0");

  if (plan === "free" && bookCount >= Number(env.FREE_BOOK_LIMIT || "1")) {
    return json({ error: "Tu plan Free permite 1 libro. Actualiza a Pro para crear más libros." }, 402);
  }

  const prompt = buildPrompt(clean);
  const ai = await callClaude(env, prompt, clean.pages);
  const book = parseClaudeJson(ai);
  const reviewedBook = await qualityPass(env, book, clean);
  const completed = normalizeBook(reviewedBook, clean, user.email);
  const id = crypto.randomUUID();

  await env.BOOKFORGE_KV.put(`book:${user.email}:${id}`, JSON.stringify(completed));
  await env.BOOKFORGE_KV.put(`usage:${user.email}:books`, String(bookCount + 1));
  await addToIndex(env, user.email, id, completed);

  return json({ id, book: completed });
}

async function generateStudioBook(input, env) {
  await ensureAiConfigured(env);
  const clean = validateStudioInput(input);
  const chaptersCount = clean.chaptersCount;
  const targetWords = Math.max(2500, clean.targetPages * 260);
  const wordsPerChapter = Math.max(650, Math.ceil(targetWords / chaptersCount));
  const prompt = `Crea un libro profesional completo en JSON válido.
Tema: ${clean.topic}
Género: ${clean.genre}
Audiencia: ${clean.audience}
Tono: ${clean.tone}
Capítulos: ${chaptersCount}
Idioma: ${clean.language}
Autor: ${clean.author}
Páginas objetivo: ${clean.targetPages}
Plataforma: ${clean.targetPlatform}
Extensión objetivo: mínimo ${targetWords} palabras totales, con ${wordsPerChapter}+ palabras por capítulo.

Reglas:
- Escribe todo en el idioma solicitado.
- Capítulos ordenados, coherentes y sin relleno.
- Cada capítulo debe tener contenido largo, dividido en párrafos claros y humanos.
- Evita frases robóticas como "en este capítulo exploraremos" repetidas.
- Incluye detalles prácticos, ejemplos concretos y transición natural entre ideas.
- No incluyas texto fuera del JSON.

Devuelve exactamente:
{
  "title": "string",
  "subtitle": "string",
  "genre": "string",
  "author": "string",
  "language": "string",
  "introduction": "string",
  "tableOfContents": ["string"],
  "chapters": [{"number": 1, "title": "string", "content": "string"}],
  "conclusion": "string"
}`;

  const aiText = await callBookAi(env, prompt);
  const parsed = parseJson(aiText.text, aiText.provider);
  const id = "bf-" + crypto.randomUUID().slice(0, 9);
  const book = normalizeStudioBook(parsed, clean, id);

  if (env.BOOKFORGE_KV) {
    await env.BOOKFORGE_KV.put(`studio:${id}`, JSON.stringify(book));
  }

  return json({ success: true, book });
}

function validateStudioInput(input) {
  if (!input.topic || String(input.topic).trim().length < 3) {
    throw httpError("Introduce una idea o tema para conectar con Gemini.", 400);
  }

  const chaptersCount = Math.max(1, Math.min(40, Number(input.chaptersCount || 4)));
  const targetPages = Math.max(10, Math.min(500, Number(input.targetPages || 20)));
  const language = String(input.language || "Español").slice(0, 80);

  return {
    topic: String(input.topic).trim().slice(0, 3000),
    genre: String(input.genre || "No ficción").slice(0, 100),
    audience: String(input.audience || "Lectores generales").slice(0, 180),
    tone: String(input.tone || "Profesional y práctico").slice(0, 120),
    chaptersCount,
    language,
    author: String(input.author || "Autor IA").slice(0, 120),
    targetPages,
    targetPlatform: String(input.targetPlatform || "kdp").slice(0, 40)
  };
}

function normalizeStudioBook(book, input, id) {
  const rawChapters = Array.isArray(book.chapters) ? book.chapters : [];
  const chapters = rawChapters.map((chapter, index) => ({
    number: Number(chapter.number || index + 1),
    title: String(chapter.title || `Capítulo ${index + 1}`).trim(),
    content: String(chapter.content || "").trim()
  })).filter((chapter) => chapter.content);

  if (!chapters.length) {
    throw httpError("Gemini no devolvió capítulos válidos. Prueba otra vez con más detalle en el tema.", 502);
  }

  return {
    title: String(book.title || input.topic).trim(),
    subtitle: String(book.subtitle || `Una guía profesional sobre ${input.topic}`).trim(),
    genre: String(book.genre || input.genre).trim(),
    author: String(book.author || input.author).trim(),
    language: String(book.language || input.language).trim(),
    introduction: String(book.introduction || "").trim(),
    tableOfContents: Array.isArray(book.tableOfContents) && book.tableOfContents.length
      ? book.tableOfContents.map((item) => String(item))
      : chapters.map((chapter) => `Capítulo ${chapter.number}: ${chapter.title}`),
    chapters,
    conclusion: String(book.conclusion || "").trim(),
    id,
    targetPages: input.targetPages,
    targetPlatform: input.targetPlatform,
    createdAt: new Date().toISOString()
  };
}

async function regenerateSection(request, env) {
  assertEnv(env, ["ANTHROPIC_API_KEY"]);
  const user = await requireSession(request, env);
  const { bookId, chapter, sectionTitle, instruction } = await readJson(request);
  if (!bookId || !chapter || !sectionTitle) return json({ error: "bookId, chapter and sectionTitle are required" }, 400);

  const existing = await env.BOOKFORGE_KV.get(`book:${user.email}:${bookId}`, "json");
  if (!existing) return json({ error: "Book not found" }, 404);

  const prompt = `Reescribe una sección de este libro manteniendo idioma, estilo y nivel editorial.
Libro: ${existing.titulo}
Capítulo: ${chapter}
Sección: ${sectionTitle}
Instrucción adicional: ${instruction || "Mejorar claridad, profundidad y valor práctico."}

Devuelve SOLO JSON válido:
{ "subtitulo": "${sectionTitle}", "contenido": "texto completo de 700+ palabras listo para publicar" }`;

  const ai = await callClaude(env, prompt, 25);
  return json({ section: parseJson(ai, "Claude") });
}

async function qualityPass(env, book, input) {
  const prompt = `Actúa como editor humano senior, corrector ortotipográfico y editor comercial de KDP.
Revisa este libro completo en ${input.idioma} y devuelve el MISMO JSON completo, corregido y mejorado.

Objetivo editorial:
- Que el libro parezca escrito por un humano experto, no por IA.
- Eliminar frases robóticas, relleno, repeticiones, contradicciones y conclusiones genéricas.
- Corregir gramática, ortografía, puntuación, concordancia, tono y fluidez.
- Mantener contenido útil, específico y publicable.
- Mejorar títulos de capítulos, subtítulo, descripción KDP, keywords y portada.
- Mantener o ampliar el valor de cada sección; no resumir el libro.
- Respetar idioma: ${input.idioma}.
- Respetar plataforma: ${input.plataforma}.
- Respetar páginas estimadas: ${input.pages}+.

Reglas estrictas:
- Devuelve SOLO JSON válido.
- Conserva exactamente estas claves principales:
titulo, subtitulo, autor, idioma, plataforma, tipo, descripcion_kdp, keywords, categoria_kdp, portada, indice, contenido, recursos_extra, conclusion_final, sobre_el_autor, paginas_estimadas, control_calidad
- Añade "control_calidad" con:
{
  "estado": "revisado",
  "errores_corregidos": ["lista breve"],
  "tono_humano": "alto",
  "listo_para_publicar": true
}

JSON a revisar:
${JSON.stringify(book)}`;

  const ai = await callClaude(env, prompt, input.pages, 0.35);
  return parseJson(ai, "Claude");
}

async function listBooks(request, env) {
  const user = await requireSession(request, env);
  const ids = await env.BOOKFORGE_KV.get(`books:${user.email}`, "json") || [];
  const items = [];
  for (const id of ids.slice(0, 25)) {
    const book = await env.BOOKFORGE_KV.get(`book:${user.email}:${id}`, "json");
    if (book) items.push({ id, titulo: book.titulo, idioma: book.idioma, plataforma: book.plataforma, paginas_estimadas: book.paginas_estimadas, created_at: book.created_at });
  }
  return json({ books: items });
}

function validateInput(input) {
  const required = ["titulo", "tema", "tipo", "capitulos", "idioma", "plataforma", "estilo", "pages"];
  for (const key of required) {
    if (!input[key]) throw new Error(`Missing field: ${key}`);
  }
  const chapters = Number(input.capitulos);
  const pages = Number(input.pages);
  if (![5, 10, 15, 20, 30, 40].includes(chapters)) throw new Error("Invalid chapter count");
  if (![50, 100, 150, 200, 250, 300].includes(pages)) throw new Error("Invalid page target");
  return {
    titulo: String(input.titulo).slice(0, 140),
    tema: String(input.tema).slice(0, 3000),
    tipo: String(input.tipo).slice(0, 60),
    capitulos: chapters,
    idioma: String(input.idioma).slice(0, 60),
    plataforma: String(input.plataforma).slice(0, 60),
    estilo: String(input.estilo).slice(0, 60),
    pages,
    autor: String(input.autor || "BookForge AI Studio").slice(0, 120),
    publico: String(input.publico || "Lectores interesados en aprender y aplicar el tema").slice(0, 600),
    coverMood: String(input.coverMood || "premium, claro, comercial").slice(0, 300)
  };
}

function buildPrompt(data) {
  const words = Math.max(12000, data.pages * 280);
  return `Crea un libro profesional completo:
- Título: ${data.titulo}
- Autor: ${data.autor}
- Tema: ${data.tema}
- Tipo: ${data.tipo}
- Capítulos: ${data.capitulos}
- Idioma: ${data.idioma}
- Plataforma: ${data.plataforma}
- Estilo interior: ${data.estilo}
- Páginas objetivo: ${data.pages}+ páginas
- Público objetivo: ${data.publico}
- Extensión objetivo: mínimo ${words} palabras totales
- Dirección de portada: ${data.coverMood}
- Portada: incluye concepto visual completo, título, subtítulo, autor, paleta, composición y prompt para generar imagen

Devuelve SOLO este JSON:
{
  "titulo": "string",
  "subtitulo": "string",
  "autor": "string",
  "idioma": "string",
  "plataforma": "string",
  "tipo": "string",
  "descripcion_kdp": "200 palabras optimizada para Amazon",
  "keywords": ["7 keywords"],
  "categoria_kdp": "string",
  "portada": {
    "titulo_portada": "string",
    "subtitulo_portada": "string",
    "autor_portada": "string",
    "concepto": "descripción profesional de portada",
    "paleta": ["#0a0a0f", "#6366f1", "#f59e0b"],
    "tipografia": "string",
    "prompt_imagen": "prompt detallado para generar la imagen de portada sin texto incrustado",
    "texto_contraportada": "texto comercial de contraportada"
  },
  "indice": [{"capitulo": 1, "titulo": "string", "descripcion": "string"}],
  "contenido": [
    {
      "capitulo": 1,
      "titulo": "string",
      "introduccion": "string de 300+ palabras",
      "secciones": [{"subtitulo": "string", "contenido": "string de 700+ palabras"}],
      "conclusion": "string de 250+ palabras",
      "ejercicio": "actividad, reflexión, plantilla o tarea práctica"
    }
  ],
  "recursos_extra": [{"titulo": "string", "contenido": "string"}],
  "conclusion_final": "string de 600+ palabras",
  "sobre_el_autor": "string",
  "paginas_estimadas": ${data.pages}
}`;
}

async function callClaude(env, prompt, pages, temperature = 0.7) {
  const maxTokens = pages >= 200 ? 64000 : pages >= 100 ? 48000 : 24000;
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model: env.ANTHROPIC_MODEL || "claude-sonnet-4-20250514",
      max_tokens: maxTokens,
      temperature,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: prompt }]
    })
  });

  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.error?.message || "Claude API request failed");
  return data?.content?.map((part) => part.text || "").join("").trim();
}

async function callGemini(env, prompt) {
  const config = await getAdminConfig(env);
  const apiKey = env.GEMINI_API_KEY || config.geminiApiKey;
  const model = config.geminiModel || env.GEMINI_MODEL || "gemini-2.0-flash";
  const maxTokens = Number(config.geminiMaxTokens || env.GEMINI_MAX_TOKENS || "12000");
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.72,
        maxOutputTokens: maxTokens,
        responseMimeType: "application/json"
      }
    })
  });

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const message = data?.error?.message || "Gemini API request failed";
    throw httpError(`Gemini API: ${message}`, response.status);
  }

  const blocked = data?.promptFeedback?.blockReason || data?.candidates?.[0]?.finishReason;
  const text = data?.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("").trim();
  if (!text) {
    throw httpError(`Gemini no devolvió contenido. Motivo: ${blocked || "respuesta vacía"}`, 502);
  }
  return text;
}

async function callOpenRouter(env, prompt) {
  const config = await getAdminConfig(env);
  const apiKey = env.OPENROUTER_API_KEY || config.openRouterApiKey;
  const model = config.openRouterModel || env.OPENROUTER_MODEL || "openai/gpt-4o-mini";
  const maxTokens = Number(config.openRouterMaxTokens || env.OPENROUTER_MAX_TOKENS || "4096");
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
        { role: "system", content: "Eres un autor y editor profesional. Devuelve solo JSON valido." },
        { role: "user", content: prompt }
      ],
      temperature: 0.72,
      max_tokens: maxTokens,
      response_format: { type: "json_object" }
    })
  });

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const message = data?.error?.message || "OpenRouter API request failed";
    throw httpError(`OpenRouter API: ${message}`, response.status);
  }

  const text = data?.choices?.[0]?.message?.content?.trim();
  if (!text) throw httpError("OpenRouter no devolvio contenido.", 502);
  return text;
}

async function callBookAi(env, prompt) {
  const config = await getAdminConfig(env);
  const provider = String(config.aiProvider || env.AI_PROVIDER || "gemini").toLowerCase();
  if (provider === "openrouter") return { provider: "OpenRouter", text: await callOpenRouter(env, prompt) };
  return { provider: "Gemini", text: await callGemini(env, prompt) };
}

function parseClaudeJson(text) {
  return parseJson(text, "Claude");
}

function parseJson(text, provider = "AI") {
  if (!text) throw new Error(`${provider} returned an empty response`);
  const cleaned = String(text).trim().replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) throw new Error(`${provider} response was not valid JSON`);
    return JSON.parse(match[0]);
  }
}

function normalizeBook(book, input, email) {
  return {
    ...book,
    titulo: book.titulo || input.titulo,
    autor: book.autor || input.autor,
    idioma: book.idioma || input.idioma,
    plataforma: book.plataforma || input.plataforma,
    tipo: book.tipo || input.tipo,
    paginas_estimadas: Number(book.paginas_estimadas || input.pages),
    owner: email,
    created_at: new Date().toISOString()
  };
}

async function addToIndex(env, email, id) {
  const key = `books:${email}`;
  const ids = await env.BOOKFORGE_KV.get(key, "json") || [];
  await env.BOOKFORGE_KV.put(key, JSON.stringify([id, ...ids.filter((item) => item !== id)].slice(0, 100)));
}

async function requireSession(request, env) {
  const header = request.headers.get("authorization") || "";
  const token = header.replace(/^Bearer\s+/i, "");
  if (!token) throw new Error("Unauthorized");
  const session = await env.BOOKFORGE_KV.get(`session:${token}`, "json");
  if (!session?.email) throw new Error("Invalid session");
  return session;
}

async function getPlan(env, email) {
  const user = await env.BOOKFORGE_KV.get(`user:${email}`, "json");
  return user?.plan || "free";
}

async function readJson(request) {
  try {
    return await request.json();
  } catch {
    throw new Error("Invalid JSON body");
  }
}

function assertEnv(env, keys) {
  for (const key of keys) {
    if (!env[key]) throw httpError(`Missing environment variable: ${key}`, 500);
  }
}

async function ensureAiConfigured(env) {
  const config = await getAdminConfig(env);
  const provider = String(config.aiProvider || env.AI_PROVIDER || "gemini").toLowerCase();
  if (provider === "openrouter" && !env.OPENROUTER_API_KEY && !config.openRouterApiKey) {
    throw httpError("Falta OPENROUTER_API_KEY. Configurala en Cloudflare o en el panel admin.", 500);
  }
  if (provider !== "openrouter" && !env.GEMINI_API_KEY && !config.geminiApiKey) {
    throw httpError("Falta GEMINI_API_KEY. Configúrala en Cloudflare Secrets o en el panel admin.", 500);
  }
}

async function getAdminConfig(env) {
  if (!env.BOOKFORGE_KV) return {};
  return await env.BOOKFORGE_KV.get("admin:config", "json") || {};
}

async function health(env) {
  const config = await getAdminConfig(env);
  return json({
    ok: true,
    geminiConfigured: Boolean(env.GEMINI_API_KEY || config.geminiApiKey),
    geminiModel: config.geminiModel || env.GEMINI_MODEL || "gemini-2.0-flash",
    openRouterConfigured: Boolean(env.OPENROUTER_API_KEY || config.openRouterApiKey),
    openRouterModel: config.openRouterModel || env.OPENROUTER_MODEL || "openai/gpt-4o-mini",
    aiProvider: config.aiProvider || env.AI_PROVIDER || "gemini",
    kvConfigured: Boolean(env.BOOKFORGE_KV)
  });
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
