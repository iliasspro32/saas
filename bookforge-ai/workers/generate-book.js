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
      if (request.method === "GET") return await listBooks(request, env);
      if (request.method === "POST" && url.pathname.includes("regenerate-section")) return await regenerateSection(request, env);
      if (request.method === "POST") return await generateBook(request, env);
      return json({ error: "Method not allowed" }, 405);
    } catch (error) {
      return json({ error: error.message || "Unexpected server error" }, 500);
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
  assertEnv(env, ["GEMINI_API_KEY"]);
  const chaptersCount = Number(input.chaptersCount || 4);
  const language = String(input.language || "Español");
  const prompt = `Crea un libro profesional completo en JSON válido.
Tema: ${input.topic}
Género: ${input.genre || "No ficción"}
Audiencia: ${input.audience || "Lectores generales"}
Tono: ${input.tone || "Profesional y práctico"}
Capítulos: ${chaptersCount}
Idioma: ${language}
Autor: ${input.author || "Autor IA"}
Páginas objetivo: ${input.targetPages || 20}
Plataforma: ${input.targetPlatform || "kdp"}

Reglas:
- Escribe todo en el idioma solicitado.
- Capítulos ordenados, coherentes y sin relleno.
- Cada capítulo debe tener varios párrafos.
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

  const aiText = await callGemini(env, prompt);
  const parsed = parseClaudeJson(aiText);
  const id = "bf-" + crypto.randomUUID().slice(0, 9);
  const book = {
    ...parsed,
    id,
    targetPages: Number(input.targetPages || 20),
    targetPlatform: input.targetPlatform || "kdp",
    createdAt: new Date().toISOString()
  };

  if (env.BOOKFORGE_KV) {
    await env.BOOKFORGE_KV.put(`studio:${id}`, JSON.stringify(book));
  }

  return json({ success: true, book });
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
  return json({ section: parseClaudeJson(ai) });
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
  return parseClaudeJson(ai);
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
  const model = env.GEMINI_MODEL || "gemini-2.0-flash";
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(env.GEMINI_API_KEY)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.72,
        maxOutputTokens: Number(env.GEMINI_MAX_TOKENS || "12000"),
        responseMimeType: "application/json"
      }
    })
  });

  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.error?.message || "Gemini API request failed");
  return data?.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("").trim();
}

function parseClaudeJson(text) {
  if (!text) throw new Error("Claude returned an empty response");
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("Claude response was not valid JSON");
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
    if (!env[key]) throw new Error(`Missing environment variable: ${key}`);
  }
}

function json(data, status = 200) {
  return new Response(status === 204 ? null : JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
}
