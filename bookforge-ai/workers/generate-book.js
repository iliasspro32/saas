const SYSTEM_PROMPT = `Eres un coautor literario de élite, editor editorial multilingüe y maquetador profesional con 20 años de experiencia.
Ayudas a conceptualizar, estructurar, escribir y pulir libros de alta calidad, de ficción y no ficción, aptos para publicación tradicional, Kindle Direct Publishing y distribución universal en PDF, EPUB y DOCX.

Reglas editoriales:
- Adapta el tono al género: literario, académico, persuasivo, técnico o práctico según corresponda.
- Localiza el texto de forma nativa. No traduzcas literalmente: adapta modismos, metáforas, ritmo y estructuras gramaticales al idioma objetivo.
- Mantén consistencia terminológica estricta en todo el manuscrito.
- Usa las convenciones editoriales propias del idioma objetivo, incluyendo puntuación, comillas y diálogos.
- Evita clichés salvo que el género los requiera.
- Usa vocabulario rico y variado sin repeticiones innecesarias.
- Genera capítulos completos, ganchos iniciales sólidos, transiciones naturales y conclusiones potentes.
- Escribe como experto humano, no como IA.
- Cuando se solicite JSON, responde siempre con JSON válido sin texto adicional fuera del JSON.`;

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

  await ensureAiConfigured(env);
  const user = await getOpenTestUser(request, env);
  const clean = validateInput(input);
  const plan = await getPlan(env, user.email);
  const bookCount = env.BOOKFORGE_KV ? Number((await env.BOOKFORGE_KV.get(`usage:${user.email}:books`)) || "0") : 0;

  if (!user.testMode && plan === "free" && bookCount >= Number(env.FREE_BOOK_LIMIT || "1")) {
    return json({ error: "Tu plan Free permite 1 libro. Actualiza a Pro para crear más libros." }, 402);
  }

  const prompt = buildPrompt(clean);
  const ai = await callBookAi(env, prompt);
  const book = parseJson(ai.text, ai.provider);
  const reviewedBook = await qualityPass(env, book, clean);
  const completed = normalizeBook(reviewedBook, clean, user.email);
  const id = crypto.randomUUID();

  if (env.BOOKFORGE_KV) {
    await env.BOOKFORGE_KV.put(`book:${user.email}:${id}`, JSON.stringify(completed));
    await env.BOOKFORGE_KV.put(`usage:${user.email}:books`, String(bookCount + 1));
    await addToIndex(env, user.email, id, completed);
  }

  return json({ id, book: completed });
}

async function generateStudioBook(input, env) {
  await ensureAiConfigured(env);
  const clean = validateStudioInput(input);
  const chaptersCount = clean.chaptersCount;
  const targetWords = targetWordsForPages(clean.targetPages);
  const wordsPerChapter = Math.max(450, Math.ceil(targetWords / chaptersCount));
  const sectionsPerChapter = Math.max(3, Math.min(5, Math.ceil(wordsPerChapter / 900)));
  const languageRule = languageInstruction(clean.language);
  const labels = localizedLabels(clean.language);
  const prompt = `Crea un ebook profesional completo en JSON válido.
Tema: ${clean.topic}
Género: ${clean.genre}
Audiencia: ${clean.audience}
Tono: ${clean.tone}
Capítulos: ${chaptersCount}
Idioma: ${clean.language}
Autor: ${clean.author}
Páginas objetivo: ${clean.targetPages}
Destino editorial: ebook universal multiplataforma
Extensión objetivo obligatoria: mínimo ${targetWords} palabras totales.
Cada capítulo debe tener como mínimo ${wordsPerChapter} palabras.
Cada capítulo debe incluir ${sectionsPerChapter} a 5 secciones internas desarrolladas dentro del campo "content".

Reglas:
- ${languageRule}
- Todos los títulos, subtítulos, índice, introducción, capítulos, secciones, conclusión, ejercicios, metadata y portada deben estar en ${clean.language}. No dejes etiquetas en español si el idioma elegido no es español.
- Usa estas etiquetas localizadas cuando necesites nombrar partes: capítulo="${labels.chapter}", sección="${labels.section}", introducción="${labels.introduction}", conclusión="${labels.conclusion}", ejercicio="${labels.exercise}", índice="${labels.toc}", recursos="${labels.resources}".
- No escribas para KDP, Etsy ni una plataforma concreta. El contenido debe ser válido para vender o entregar en cualquier plataforma, web propia, newsletter, academia, marketplace o PDF descargable.
- Capítulos ordenados, coherentes, largos y sin relleno, con voz humana, ejemplos concretos y matices propios de un experto.
- Incluye un capítulo 0 de avisos importantes, escrito en ${clean.language}, con mínimo 500 palabras cuando el tema lo requiera por salud, finanzas, espiritualidad, desarrollo personal, legal, educación o bienestar.
- Cada capítulo debe dividirse en secciones naturales usando encabezados claros dentro de "content" en ${clean.language}.
- Cada sección debe tener entre 300 y 450 palabras o 10 a 15 párrafos breves. No entregues secciones de 2 o 3 párrafos.
- Usa enumeraciones y viñetas cuando aporten claridad. No uses emojis ni líneas decorativas.
- Agrega secciones interactivas donde corresponda: ejercicios, preguntas de reflexión, checklists, plantillas o acciones guiadas.
- Evita frases robóticas como "en este capítulo exploraremos" repetidas.
- Incluye detalles prácticos, ejemplos concretos y transición natural entre ideas.
- No resumas. No cierres un capítulo hasta haber desarrollado ejemplos, explicación, aplicación práctica y reflexión guiada.
- Si el límite de salida te obliga a elegir, prioriza capítulos completos y densos sobre metadata larga.
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
  let book = normalizeStudioBook(parsed, clean, id);
  book = await expandShortStudioBook(env, book, clean);

  if (env.BOOKFORGE_KV) {
    await env.BOOKFORGE_KV.put(`studio:${id}`, JSON.stringify(book));
  }

  return json({ success: true, book });
}

async function expandShortStudioBook(env, book, input) {
  const targetPerChapter = Math.max(450, Math.ceil(targetWordsForPages(input.targetPages) / Math.max(1, input.chaptersCount)));
  const languageRule = languageInstruction(input.language);
  const labels = localizedLabels(input.language);
  const chapters = await Promise.all(book.chapters.map(async (chapter) => {
    if (wordCount(chapter.content) >= targetPerChapter) return chapter;
    const prompt = `Reescribe y amplía este capítulo para un ebook profesional.

Libro: ${book.title}
Tema: ${input.topic}
Audiencia: ${input.audience}
Tono: ${input.tone}
Capítulo ${chapter.number}: ${chapter.title}

Contenido actual:
${chapter.content}

Reglas obligatorias:
- ${languageRule}
- Todo el texto devuelto debe estar en ${input.language}, incluyendo subtítulos y etiquetas. Usa "${labels.section}" para secciones, "${labels.conclusion}" para conclusiones y "${labels.exercise}" para ejercicios.
- Escribe mínimo ${targetPerChapter} palabras.
- Divide el capítulo con subtítulos claros.
- Incluye explicación, ejemplos concretos, errores a evitar, pasos prácticos y un ejercicio final.
- No mezcles idiomas.
- No menciones que estás reescribiendo.
- Devuelve SOLO JSON válido: { "content": "texto completo del capítulo" }`;

    try {
      const aiText = await callBookAi(env, prompt);
      const expanded = parseJson(aiText.text, aiText.provider);
      const content = String(expanded.content || "").trim();
      return content ? { ...chapter, content } : chapter;
    } catch {
      return chapter;
    }
  }));

  return {
    ...book,
    introduction: ensureMinimumText(book.introduction, input, "introducción"),
    conclusion: ensureMinimumText(book.conclusion, input, "conclusión"),
    chapters
  };
}

function ensureMinimumText(value, input, label) {
  const text = String(value || "").trim();
  if (wordCount(text) >= 120) return text;
  if (isArabicLanguage(input.language)) {
    return label === "introducción"
      ? `هذا الكتاب صُمم ليمنح القارئ مسارا واضحا وعمليا حول ${input.topic}. ستجد داخله أفكارا مرتبة، أمثلة قابلة للتطبيق، وخطوات تساعدك على تحويل المعرفة إلى ممارسة يومية. الهدف ليس تقديم كلام عام، بل بناء دليل مفيد يمكن الرجوع إليه عند الحاجة.`
      : `في النهاية، قيمة هذا الكتاب لا تقاس بعدد الصفحات فقط، بل بقدرة القارئ على تطبيق ما تعلمه خطوة بعد خطوة. ارجع إلى الفصول، نفذ التمارين، وعدل الخطة بما يناسب واقعك حتى تحصل على نتيجة عملية ومستدامة.`;
  }
  return label === "introducción"
    ? `Este libro está diseñado para ofrecer una guía clara, práctica y bien organizada sobre ${input.topic}. A lo largo de sus capítulos encontrarás explicaciones, ejemplos y acciones concretas para convertir la información en aplicación real.`
    : `La mejor forma de aprovechar este libro es volver a sus capítulos, aplicar los ejercicios y convertir cada idea útil en una acción concreta. El progreso aparece cuando el lector deja de consumir información y empieza a practicarla con criterio.`;
}

function wordCount(value) {
  return String(value || "").trim().split(/\s+/).filter(Boolean).length;
}

function targetWordsForPages(pages) {
  const safePages = Math.max(5, Math.min(500, Number(pages || 5)));
  return Math.max(2200, safePages * 430);
}

function isArabicLanguage(language) {
  return /árabe|arabe|arabic|العربية|عربي/i.test(String(language || ""));
}

function languageInstruction(language) {
  if (isArabicLanguage(language)) {
    return "اكتب كل المحتوى النهائي باللغة العربية الفصحى الحديثة فقط. لا تستخدم الإسبانية أو الإنجليزية أو أي لغة أخرى إلا للأسماء الخاصة الضرورية. يجب أن تكون كل العناوين والفصول والفهارس والخاتمة والتمارين والبيانات الوصفية بالعربية، وبأسلوب طبيعي مناسب لاتجاه RTL.";
  }
  return `Escribe absolutamente todo el contenido final en ${language}. No mezcles idiomas salvo nombres propios inevitables.`;
}

function localizedLabels(language) {
  if (isArabicLanguage(language)) {
    return {
      chapter: "الفصل",
      section: "القسم",
      introduction: "المقدمة",
      conclusion: "الخاتمة",
      exercise: "تمرين عملي",
      toc: "الفهرس",
      resources: "موارد إضافية",
      editorialInfo: "معلومات النشر",
      destination: "الوجهة",
      language: "اللغة",
      category: "التصنيف التحريري",
      estimatedPages: "عدد الصفحات التقديري",
      description: "الوصف التحريري",
      authorAbout: "نبذة عن المؤلف"
    };
  }
  return {
    chapter: "Capítulo",
    section: "Sección",
    introduction: "Introducción",
    conclusion: "Conclusión",
    exercise: "Ejercicio práctico",
    toc: "Índice",
    resources: "Recursos extra",
    editorialInfo: "Información editorial",
    destination: "Destino",
    language: "Idioma",
    category: "Categoría editorial",
    estimatedPages: "Páginas estimadas",
    description: "Descripción editorial",
    authorAbout: "Sobre el autor"
  };
}

function validateStudioInput(input) {
  if (!input.topic || String(input.topic).trim().length < 3) {
    throw httpError("Introduce una idea o tema para conectar con Gemini.", 400);
  }

  const chaptersCount = Math.max(1, Math.min(80, Number(input.chaptersCount || 4)));
  const targetPages = Math.max(5, Math.min(500, Number(input.targetPages || 20)));
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
    targetPlatform: String(input.targetPlatform || "universal").slice(0, 40)
  };
}

function normalizeStudioBook(book, input, id) {
  const labels = localizedLabels(input.language);
  const rawChapters = Array.isArray(book.chapters) ? book.chapters : [];
  const chapters = rawChapters.map((chapter, index) => ({
    number: Number(chapter.number || index + 1),
    title: String(chapter.title || `${labels.chapter} ${index + 1}`).trim(),
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
      : chapters.map((chapter) => `${labels.chapter} ${chapter.number}: ${chapter.title}`),
    chapters,
    conclusion: String(book.conclusion || "").trim(),
    id,
    targetPages: input.targetPages,
    targetPlatform: input.targetPlatform,
    createdAt: new Date().toISOString()
  };
}

async function regenerateSection(request, env) {
  await ensureAiConfigured(env);
  const user = await getOpenTestUser(request, env);
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

  const ai = await callBookAi(env, prompt);
  return json({ section: parseJson(ai.text, ai.provider) });
}

async function qualityPass(env, book, input) {
  const prompt = `Actúa como editor humano senior, corrector ortotipográfico y editor comercial multiplataforma.
Revisa este libro completo en ${input.idioma} y devuelve el MISMO JSON completo, corregido y mejorado.

Objetivo editorial:
- Que el libro parezca escrito por un humano experto, no por IA.
- Eliminar frases robóticas, relleno, repeticiones, contradicciones y conclusiones genéricas.
- Corregir gramática, ortografía, puntuación, concordancia, tono y fluidez.
- Mantener contenido útil, específico y publicable en cualquier plataforma digital.
- Quitar sesgos hacia KDP, Etsy o tiendas concretas salvo que el usuario lo pida explícitamente.
- Mejorar títulos de capítulos, subtítulo, descripción editorial, keywords, categoría editorial y portada.
- Verificar que exista capítulo 0 de términos y avisos importantes cuando el nicho lo necesite.
- Confirmar que las secciones usen tono humano, máximo aproximado de 400 palabras, viñetas/enumeraciones donde convenga y ejercicios interactivos.
- Mantener o ampliar el valor de cada sección; no resumir el libro.
- Respetar idioma: ${input.idioma}.
- Respetar destino editorial universal multiplataforma.
- Respetar páginas estimadas: ${input.pages}+.

Reglas estrictas:
- Devuelve SOLO JSON válido.
- Conserva exactamente estas claves principales:
titulo, subtitulo, autor, idioma, plataforma, tipo, descripcion_editorial, keywords, categoria_editorial, portada, indice, contenido, recursos_extra, conclusion_final, sobre_el_autor, paginas_estimadas, control_calidad
- Añade "control_calidad" con:
{
  "estado": "revisado",
  "errores_corregidos": ["lista breve"],
  "tono_humano": "alto",
  "listo_para_publicar": true
}

JSON a revisar:
${JSON.stringify(book)}`;

  const ai = await callBookAi(env, prompt);
  return parseJson(ai.text, ai.provider);
}

async function listBooks(request, env) {
  const user = await getOpenTestUser(request, env);
  if (!env.BOOKFORGE_KV) return json({ books: [] });
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
  if (![5, 10, 15, 20, 30, 40, 50, 100, 150, 200, 250, 300].includes(pages)) throw new Error("Invalid page target");
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
  const words = targetWordsForPages(data.pages);
  const wordsPerChapter = Math.max(450, Math.ceil(words / data.capitulos));
  const labels = localizedLabels(data.idioma);
  return `Crea un ebook profesional completo, humano y universal:
- Título: ${data.titulo}
- Autor: ${data.autor}
- Tema: ${data.tema}
- Tipo: ${data.tipo}
- Capítulos: ${data.capitulos}
- Idioma: ${data.idioma}
- Destino editorial: ebook universal multiplataforma, exportable en PDF, EPUB y DOCX
- Estilo interior: ${data.estilo}
- Páginas objetivo: ${data.pages}+ páginas
- Público objetivo: ${data.publico}
- Extensión objetivo: mínimo ${words} palabras totales
- Extensión por capítulo: mínimo ${wordsPerChapter} palabras por capítulo
- Dirección de portada: ${data.coverMood}
- Portada: incluye concepto visual completo, título, subtítulo, autor, paleta, composición y prompt para generar imagen

Reglas editoriales obligatorias:
- ${languageInstruction(data.idioma)}
- Todos los campos del JSON deben estar escritos en ${data.idioma}: título, subtítulo, descripción, keywords, categoría, portada, índice, capítulos, secciones, conclusiones, ejercicios, recursos, sobre el autor y control de calidad.
- Usa estas etiquetas localizadas cuando necesites nombrar partes: capítulo="${labels.chapter}", sección="${labels.section}", introducción="${labels.introduction}", conclusión="${labels.conclusion}", ejercicio="${labels.exercise}", índice="${labels.toc}", recursos="${labels.resources}".
- No escribas para KDP, Etsy ni una plataforma concreta. El libro debe servir para cualquier tienda, web propia, academia, comunidad, lead magnet premium o descarga PDF.
- Escribe con voz humana: frases variadas, ejemplos realistas, criterio experto, transición natural entre ideas y cero relleno.
- Si el nicho toca desarrollo personal, espiritualidad, salud, finanzas, educación, legal, bienestar u otro tema sensible, crea un capítulo 0 de avisos importantes en ${data.idioma} con mínimo 500 palabras.
- Desarrolla capítulo a capítulo y sección por sección. Cada sección debe tener hasta 400 palabras o 10 a 15 párrafos breves.
- Cada capítulo debe incluir mínimo 3 secciones desarrolladas, más introducción, conclusión y ejercicio.
- No entregues capítulos vacíos, genéricos o de pocos párrafos. Cada sección debe contener explicación, ejemplo y aplicación práctica.
- Especifica siempre el número y texto de cada capítulo y cada sección.
- No uses emojis. No uses líneas decorativas.
- Usa enumeraciones y viñetas en lugar de emojis cuando ayuden a leer.
- Agrega secciones interactivas donde corresponda: ejercicios, preguntas de reflexión, checklists, plantillas, diarios de trabajo o acciones guiadas.
- Mantén continuidad para que el lector sepa dónde está y pueda continuar el libro sin perder el hilo.

Devuelve SOLO este JSON:
{
  "titulo": "string",
  "subtitulo": "string",
  "autor": "string",
  "idioma": "string",
  "plataforma": "Universal",
  "tipo": "string",
  "descripcion_editorial": "200 palabras válidas para cualquier plataforma",
  "keywords": ["7 keywords"],
  "categoria_editorial": "string",
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
  "indice": [{"capitulo": 0, "titulo": "string en ${data.idioma}", "descripcion": "string en ${data.idioma}"}],
  "contenido": [
    {
      "capitulo": 0,
      "titulo": "string en ${data.idioma}",
      "introduccion": "string de 250+ palabras en ${data.idioma}",
      "secciones": [{"subtitulo": "string en ${data.idioma}", "contenido": "string de 250 a 450 palabras en ${data.idioma}, con párrafos humanos y viñetas si corresponde"}],
      "conclusion": "string de 180+ palabras en ${data.idioma}",
      "ejercicio": "actividad, reflexión, checklist, plantilla o tarea práctica en ${data.idioma}"
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
  const model = professionalModel(config.geminiModel || env.GEMINI_MODEL || "gemini-2.5-pro", "gemini");
  const maxTokens = Math.max(24000, Number(config.geminiMaxTokens || env.GEMINI_MAX_TOKENS || "32000"));
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: `${SYSTEM_PROMPT}\n\n${prompt}` }] }],
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
  const model = professionalModel(config.openRouterModel || env.OPENROUTER_MODEL || "openai/gpt-4.1", "openrouter");
  const maxTokens = Math.max(18000, Number(config.openRouterMaxTokens || env.OPENROUTER_MAX_TOKENS || "24000"));
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
        { role: "system", content: SYSTEM_PROMPT },
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
  const hasGemini = Boolean(env.GEMINI_API_KEY || config.geminiApiKey);
  const hasOpenRouter = Boolean(env.OPENROUTER_API_KEY || config.openRouterApiKey);
  if (hasGemini && provider !== "openrouter-only") {
    try {
      return { provider: "Gemini", text: await callGemini(env, prompt) };
    } catch (error) {
      if (!hasOpenRouter || !isRetryableProviderError(error)) throw error;
    }
  }
  if (hasOpenRouter) return { provider: "OpenRouter", text: await callOpenRouter(env, prompt) };
  return { provider: "Gemini", text: await callGemini(env, prompt) };
}

function professionalModel(model, provider) {
  const value = String(model || "").trim();
  const weak = /gpt-4o-mini|flash-lite|gemini-2\.0-flash|gemini-flash-1\.5|deepseek-chat/i.test(value);
  if (!value || weak) {
    return provider === "openrouter" ? "openai/gpt-4.1" : "gemini-2.5-pro";
  }
  return value;
}

function isRetryableProviderError(error) {
  const message = String(error?.message || "");
  return /quota|rate|limit|429|overloaded|temporarily|timeout/i.test(message);
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

async function getOpenTestUser(request, env) {
  try {
    return await requireSession(request, env);
  } catch {
    return {
      email: env.TEST_USER_EMAIL || "open-test@bookforge.local",
      plan: "testing",
      testMode: true
    };
  }
}

async function getPlan(env, email) {
  if (!env.BOOKFORGE_KV) return "testing";
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
    geminiModel: professionalModel(config.geminiModel || env.GEMINI_MODEL || "gemini-2.5-pro", "gemini"),
    openRouterConfigured: Boolean(env.OPENROUTER_API_KEY || config.openRouterApiKey),
    openRouterModel: professionalModel(config.openRouterModel || env.OPENROUTER_MODEL || "openai/gpt-4.1", "openrouter"),
    aiProvider: Boolean(env.GEMINI_API_KEY || config.geminiApiKey) ? "gemini" : (config.aiProvider || env.AI_PROVIDER || "gemini"),
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
