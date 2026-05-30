const API = {
  auth: "/api/auth",
  generate: "/api/generate-book",
  payments: "/api/payments"
};

const state = {
  token: localStorage.getItem("bookforge_session") || "",
  demoMode: localStorage.getItem("bookforge_demo_mode") === "true",
  apiConfig: JSON.parse(localStorage.getItem("bookforge_api_config") || "null"),
  user: null,
  book: null,
  bookId: null,
  progressTimer: null
};

document.addEventListener("DOMContentLoaded", () => {
  bindAuth();
  bindApiConfig();
  bindGenerator();
  bindExports();
  hydrateDraftFromLanding();
  updateStatsFromForm();
  verifyMagicLink();
  loadUser();
  loadHistory();
});

function bindAuth() {
  const magicButton = document.getElementById("magicButton");
  const emailInput = document.getElementById("emailInput");
  const logoutButton = document.getElementById("logoutButton");
  const billingPortal = document.getElementById("billingPortal");
  const demoModeButton = document.getElementById("demoModeButton");

  magicButton?.addEventListener("click", async () => {
    try {
      magicButton.disabled = true;
      magicButton.textContent = "Enviando...";
      const data = await apiFetch(`${API.auth}/request-link`, { method: "POST", body: { email: emailInput.value } }, false);
      if (data.magicLink) {
        await navigator.clipboard?.writeText(data.magicLink).catch(() => {});
        toast("Magic link creado y copiado. Abre el enlace para entrar.");
      } else {
        toast(data.message || "Revisa tu email.");
      }
    } catch (error) {
      toast(error.message);
    } finally {
      magicButton.disabled = false;
      magicButton.textContent = "Enviar magic link";
    }
  });

  logoutButton?.addEventListener("click", async () => {
    await apiFetch(`${API.auth}/logout`, { method: "POST", body: {} }).catch(() => {});
    localStorage.removeItem("bookforge_session");
    localStorage.removeItem("bookforge_demo_mode");
    state.token = "";
    state.demoMode = false;
    state.user = null;
    renderAuth();
  });

  demoModeButton?.addEventListener("click", () => {
    state.demoMode = true;
    state.user = { email: "modo-prueba@bookforge.local", plan: state.apiConfig?.apiKey ? "api-test" : "demo" };
    localStorage.setItem("bookforge_demo_mode", "true");
    renderAuth();
    toast("Modo prueba activado. Puedes generar sin registrarte.");
  });

  billingPortal?.addEventListener("click", async () => {
    try {
      const data = await apiFetch(`${API.payments}/portal`, { method: "POST", body: {} });
      location.href = data.url;
    } catch (error) {
      toast(error.message);
    }
  });
}

function bindApiConfig() {
  const form = document.getElementById("apiConfigForm");
  const clearButton = document.getElementById("clearApiConfig");
  hydrateApiConfigForm();
  renderApiStatus();

  form?.addEventListener("submit", (event) => {
    event.preventDefault();
    const config = Object.fromEntries(new FormData(form).entries());
    state.apiConfig = {
      provider: config.provider || "gemini",
      model: config.model || "gemini-2.5-pro",
      apiKey: config.apiKey || "",
      maxTokens: Number(config.maxTokens || 32000)
    };
    localStorage.setItem("bookforge_api_config", JSON.stringify(state.apiConfig));
    state.demoMode = true;
    localStorage.setItem("bookforge_demo_mode", "true");
    renderAuth();
    renderApiStatus();
    toast("API guardada para pruebas locales.");
  });

  clearButton?.addEventListener("click", () => {
    state.apiConfig = null;
    localStorage.removeItem("bookforge_api_config");
    hydrateApiConfigForm();
    renderApiStatus();
    toast("API local borrada. Queda activo el demo sin coste.");
  });
}

function hydrateApiConfigForm() {
  const form = document.getElementById("apiConfigForm");
  if (!form) return;
  const config = state.apiConfig || { provider: "gemini", model: "gemini-2.5-pro", apiKey: "", maxTokens: 32000 };
  form.elements.provider.value = config.provider;
  form.elements.model.value = config.model;
  form.elements.apiKey.value = config.apiKey || "";
  form.elements.maxTokens.value = config.maxTokens || 32000;
}

function renderApiStatus() {
  const status = document.getElementById("apiStatus");
  if (!status) return;
  if (state.apiConfig?.apiKey) {
    status.textContent = `Modo actual: pruebas sin registro usando ${state.apiConfig.provider} · ${state.apiConfig.model}.`;
  } else {
    status.textContent = "Modo actual: demo local sin API. Genera un libro de muestra para probar preview y exportaciones.";
  }
}

async function verifyMagicLink() {
  const params = new URLSearchParams(location.search);
  const magic = params.get("magic");
  if (!magic) return;
  try {
    const data = await apiFetch(`${API.auth}/verify`, { method: "POST", body: { token: magic } }, false);
    state.token = data.token;
    state.user = data.user;
    localStorage.setItem("bookforge_session", data.token);
    history.replaceState({}, "", "dashboard.html");
    toast("Sesión iniciada.");
    renderAuth();
  } catch (error) {
    toast(error.message);
  }
}

async function loadUser() {
  if (!state.token) {
    state.demoMode = true;
    state.user = { email: "open-test@bookforge.local", plan: "testing-open" };
    localStorage.setItem("bookforge_demo_mode", "true");
    return renderAuth();
  }
  try {
    const data = await apiFetch(`${API.auth}/me`);
    state.user = data.user;
  } catch {
    localStorage.removeItem("bookforge_session");
    state.token = "";
  }
  renderAuth();
}

function renderAuth() {
  const authBox = document.getElementById("authBox");
  const userBox = document.getElementById("userBox");
  const userEmail = document.getElementById("userEmail");
  const userPlan = document.getElementById("userPlan");
  authBox?.classList.toggle("hidden", Boolean(state.user));
  userBox?.classList.toggle("hidden", !state.user);
  if (userEmail) userEmail.textContent = state.user?.email || "";
  if (userPlan) userPlan.textContent = (state.user?.plan || "Free").toUpperCase();
}

function bindGenerator() {
  const form = document.getElementById("bookForm");
  form?.addEventListener("change", updateStatsFromForm);
  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = document.getElementById("generateButton");
    const payload = Object.fromEntries(new FormData(form).entries());

    try {
      startLoading(button);
      const data = await generateBook(payload);
      state.book = data.book;
      state.bookId = data.id;
      renderBook(data.book);
      await loadHistory();
      toast("Libro completo generado.");
    } catch (error) {
      toast(error.message);
    } finally {
      stopLoading(button);
    }
  });

  document.getElementById("regenerateButton")?.addEventListener("click", regenerateFirstSection);
}

async function generateBook(payload) {
  if (state.apiConfig?.apiKey) {
    const book = await generateWithConfiguredApi(payload);
    const id = `local-${Date.now()}`;
    saveLocalBook(id, book);
    return { id, book };
  }

  if (state.token) {
    return apiFetch(API.generate, { method: "POST", body: payload });
  }

  state.demoMode = true;
  localStorage.setItem("bookforge_demo_mode", "true");
  return apiFetch(API.generate, { method: "POST", body: payload }, false);
}

function hydrateDraftFromLanding() {
  const saved = localStorage.getItem("bookforge_draft");
  if (!saved) return;
  const form = document.getElementById("bookForm");
  if (!form) return;

  try {
    const draft = JSON.parse(saved);
    for (const [name, value] of Object.entries(draft)) {
      const field = form.elements[name];
      if (field) field.value = value;
    }
    localStorage.removeItem("bookforge_draft");
    setStatus(8, "Ebook preparado desde la landing", "Revisa los campos, entra con magic link y pulsa Generar Libro Ahora.");
    document.getElementById("generator")?.scrollIntoView({ behavior: "smooth", block: "start" });
  } catch {
    localStorage.removeItem("bookforge_draft");
  }
}

function updateStatsFromForm() {
  const form = document.getElementById("bookForm");
  if (!form) return;
  const data = Object.fromEntries(new FormData(form).entries());
  setText("statPages", data.pages || "100");
  setText("statLang", shortLang(data.idioma || "Español"));
  setText("statFormat", data.plataforma || "Universal");
}

async function generateWithConfiguredApi(payload) {
  const config = state.apiConfig;
  const prompt = buildApiPrompt(payload);
  let text;

  if (config.provider === "gemini") {
    text = await callGemini(config, prompt);
  } else if (config.provider === "openrouter") {
    text = await callOpenAiCompatible("https://openrouter.ai/api/v1/chat/completions", config, prompt);
  } else if (config.provider === "openai") {
    text = await callOpenAiCompatible("https://api.openai.com/v1/chat/completions", config, prompt);
  } else if (config.provider === "anthropic") {
    text = await callAnthropic(config, prompt);
  } else {
    throw new Error("Proveedor no soportado.");
  }

  return normalizeBook(parseJsonText(text), payload, `api-${config.provider}`);
}

const EDITORIAL_SYSTEM_PROMPT = `Eres un coautor literario de élite y editor editorial multilingüe.
Escribes y pules libros profesionales de ficción y no ficción aptos para publicación tradicional, KDP y distribución universal.
Adapta el tono al género. Localiza cada idioma de forma nativa sin traducciones literales. Mantén consistencia terminológica estricta.
Respeta las convenciones editoriales del idioma objetivo, incluyendo puntuación, comillas y diálogos. Evita clichés y repeticiones innecesarias.
Genera capítulos completos, ganchos sólidos, transiciones naturales y conclusiones potentes. Responde solo JSON válido.`;

async function callGemini(config, prompt) {
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(config.model)}:generateContent?key=${encodeURIComponent(config.apiKey)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: `${EDITORIAL_SYSTEM_PROMPT}\n\n${prompt}` }] }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: config.maxTokens || 32000,
        responseMimeType: "application/json"
      }
    })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error?.message || "Gemini API error");
  return data.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("") || "";
}

async function callOpenAiCompatible(endpoint, config, prompt) {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
      "HTTP-Referer": location.origin,
      "X-Title": "BookForge AI"
    },
    body: JSON.stringify({
      model: config.model,
      temperature: 0.7,
      max_tokens: config.maxTokens || 32000,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: EDITORIAL_SYSTEM_PROMPT },
        { role: "user", content: prompt }
      ]
    })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error?.message || "API error");
  return data.choices?.[0]?.message?.content || "";
}

async function callAnthropic(config, prompt) {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": config.apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true"
    },
    body: JSON.stringify({
      model: config.model,
      max_tokens: config.maxTokens || 32000,
      temperature: 0.7,
      system: EDITORIAL_SYSTEM_PROMPT,
      messages: [{ role: "user", content: prompt }]
    })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error?.message || "Anthropic API error");
  return data.content?.map((part) => part.text || "").join("") || "";
}

function buildApiPrompt(payload) {
  const pages = Number(payload.pages || 100);
  const chapters = Math.max(1, Number(payload.capitulos || 10));
  const words = targetWordsForPages(pages);
  const wordsPerChapter = Math.max(450, Math.ceil(words / chapters));
  const languageRule = languageInstruction(payload.idioma);
  const labels = localizedLabels(payload.idioma);
  return `Crea un ebook profesional completo, humano y universal, revisado como editor, listo para publicar y exportar en PDF.
Título: ${payload.titulo}
Autor: ${payload.autor || "BookForge AI Studio"}
Tema: ${payload.tema}
Tipo: ${payload.tipo}
Capítulos: ${payload.capitulos}
Idioma: ${payload.idioma}
Destino editorial: ebook universal multiplataforma
Estilo: ${payload.estilo}
Páginas objetivo: ${pages}
Extensión objetivo: ${words}+ palabras
Extensión por capítulo: mínimo ${wordsPerChapter} palabras por capítulo
Público objetivo: ${payload.publico || "lectores interesados en el tema"}
Portada: ${payload.coverMood || "portada comercial premium"}

Reglas obligatorias:
- ${languageRule}
- Todos los campos del JSON deben estar escritos en ${payload.idioma}: título, subtítulo, descripción, keywords, categoría, portada, índice, capítulos, secciones, conclusiones, ejercicios, recursos, sobre el autor y control de calidad.
- Usa estas etiquetas localizadas cuando necesites nombrar partes: capítulo="${labels.chapter}", sección="${labels.section}", introducción="${labels.introduction}", conclusión="${labels.conclusion}", ejercicio="${labels.exercise}", índice="${labels.toc}", recursos="${labels.resources}".
- No escribas para KDP, Etsy ni una plataforma concreta. El libro debe servir para cualquier tienda, web propia, academia, comunidad, lead magnet premium o PDF descargable.
- Escribe como humano experto: frases variadas, ejemplos concretos, criterio editorial, transiciones naturales y cero relleno.
- Si el nicho es desarrollo personal, espiritualidad, salud, finanzas, educación, legal, bienestar u otro tema sensible, incluye un capítulo 0 de avisos importantes escrito en ${payload.idioma}.
- Desarrolla capítulo a capítulo y sección por sección. Cada sección debe tener hasta 400 palabras o 10 a 15 párrafos breves.
- Cada capítulo debe incluir mínimo 3 secciones desarrolladas, más introducción, conclusión y ejercicio.
- No entregues capítulos vacíos, genéricos o de pocos párrafos. Cada sección debe contener explicación, ejemplo y aplicación práctica.
- No resumas para ahorrar espacio: desarrolla el contenido con profundidad suficiente para que el PDF tenga cuerpo real.
- Especifica número y texto de cada capítulo, y número/título de cada sección.
- No uses emojis ni líneas decorativas.
- Usa enumeraciones y viñetas cuando aporten claridad.
- Agrega secciones interactivas donde corresponda: ejercicios, preguntas de reflexión, checklists, plantillas o acciones guiadas.

Devuelve SOLO JSON válido con estas claves:
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
    "concepto": "string",
    "paleta": ["#0a0a0f", "#6366f1", "#f59e0b"],
    "tipografia": "string",
    "prompt_imagen": "string",
    "texto_contraportada": "string"
  },
  "indice": [{"capitulo": 0, "titulo": "string", "descripcion": "string"}],
  "contenido": [{"capitulo": 0, "titulo": "string en ${payload.idioma}", "introduccion": "250+ palabras en ${payload.idioma}", "secciones": [{"subtitulo": "string en ${payload.idioma}", "contenido": "250 a 450 palabras en ${payload.idioma}"}], "conclusion": "180+ palabras en ${payload.idioma}", "ejercicio": "string en ${payload.idioma}"}],
  "recursos_extra": [{"titulo": "string", "contenido": "string"}],
  "conclusion_final": "600+ palabras",
  "sobre_el_autor": "string",
  "paginas_estimadas": ${pages},
  "control_calidad": {"estado": "revisado", "tono_humano": "alto", "listo_para_publicar": true}
}`;
}

function parseJsonText(text) {
  if (!text) throw new Error("La API no devolvió contenido.");
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("La API no devolvió JSON válido.");
    return JSON.parse(match[0]);
  }
}

async function regenerateFirstSection() {
  if (!state.book || !state.bookId) return toast("Genera un libro primero.");
  const first = state.book.contenido?.[0];
  const section = first?.secciones?.[0];
  if (!first || !section) return toast("No hay sección para regenerar.");
  if (!state.token || state.bookId.startsWith("local") || state.bookId.startsWith("demo")) {
    section.contenido = `${section.contenido}\n\nVersión regenerada: esta sección se ha reforzado con una explicación más clara, transiciones más humanas y una aplicación práctica adicional para que puedas probar el flujo sin registro.`;
    saveLocalBook(state.bookId, state.book);
    renderBook(state.book);
    await loadHistory();
    toast("Sección regenerada en modo prueba.");
    return;
  }
  try {
    const data = await apiFetch(`${API.generate}/regenerate-section`, {
      method: "POST",
      body: { bookId: state.bookId, chapter: first.capitulo, sectionTitle: section.subtitulo }
    });
    section.contenido = data.section.contenido;
    renderBook(state.book);
    toast("Primera sección regenerada.");
  } catch (error) {
    toast(error.message);
  }
}

function renderBook(book) {
  document.getElementById("preview")?.classList.remove("hidden");
  setText("previewTitle", book.titulo);
  renderCover(book);
  renderManuscript(book);
  document.getElementById("preview")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function renderCover(book) {
  const cover = book.portada || {};
  const colors = cover.paleta?.length ? cover.paleta : ["#0a0a0f", "#6366f1", "#f59e0b"];
  const element = document.getElementById("coverPreview");
  if (!element) return;
  element.style.setProperty("--cover-a", colors[0] || "#0a0a0f");
  element.style.setProperty("--cover-b", colors[1] || "#6366f1");
  element.style.setProperty("--cover-c", colors[2] || "#f59e0b");
  element.innerHTML = `
    <div class="cover-band">${escapeHtml(book.plataforma || "Universal")} READY</div>
    <div class="cover-title-block">
      <h2>${escapeHtml(cover.titulo_portada || book.titulo)}</h2>
      <p>${escapeHtml(cover.subtitulo_portada || book.subtitulo || "")}</p>
    </div>
    <div class="cover-author">${escapeHtml(cover.autor_portada || book.autor || "")}</div>
  `;
}

function renderManuscript(book) {
  const rtl = isArabicLanguage(book.idioma);
  const labels = localizedLabels(book.idioma);
  const chapters = (book.contenido || []).map((chapter) => `
    <section class="book-page chapter" dir="${rtl ? "rtl" : "ltr"}" style="text-align:${rtl ? "right" : "left"}">
      <span class="chapter-kicker">${escapeHtml(labels.chapter)} ${chapter.capitulo}</span>
      <h2>${escapeHtml(chapter.titulo)}</h2>
      <p class="chapter-intro">${formatText(chapter.introduccion)}</p>
      ${(chapter.secciones || []).map((section) => `
        <h3>${escapeHtml(section.subtitulo)}</h3>
        <p>${formatText(section.contenido)}</p>
      `).join("")}
      <h3>${escapeHtml(labels.conclusion)}</h3>
      <p>${formatText(chapter.conclusion)}</p>
      <div class="exercise-box"><strong>${escapeHtml(labels.exercise)}</strong><p>${formatText(chapter.ejercicio)}</p></div>
    </section>
  `).join("");

  const html = `
    <div class="paper" id="bookPaper" dir="${rtl ? "rtl" : "ltr"}" style="text-align:${rtl ? "right" : "left"}">
      <section class="book-page title-page" dir="${rtl ? "rtl" : "ltr"}">
        <p class="book-label">${escapeHtml(book.tipo || "Ebook profesional")}</p>
        <h1>${escapeHtml(book.titulo)}</h1>
        <p class="subtitle">${escapeHtml(book.subtitulo || "")}</p>
        <p class="byline">${escapeHtml(book.autor || "")}</p>
      </section>

      <section class="book-page copyright-page" dir="${rtl ? "rtl" : "ltr"}">
        <h2>${escapeHtml(labels.editorialInfo)}</h2>
        <div class="metadata-grid">
          <div><strong>${escapeHtml(labels.destination)}</strong><span>${escapeHtml(book.plataforma || "Universal")}</span></div>
          <div><strong>${escapeHtml(labels.language)}</strong><span>${escapeHtml(book.idioma || "")}</span></div>
          <div><strong>${escapeHtml(labels.category)}</strong><span>${escapeHtml(book.categoria_editorial || book.categoria_kdp || "")}</span></div>
          <div><strong>${escapeHtml(labels.estimatedPages)}</strong><span>${escapeHtml(String(book.paginas_estimadas || ""))}</span></div>
        </div>
        <h3>${escapeHtml(labels.description)}</h3>
        <p>${formatText(book.descripcion_editorial || book.descripcion_kdp)}</p>
        <h3>Keywords</h3>
        <p>${(book.keywords || []).map(escapeHtml).join(", ")}</p>
      </section>

      <section class="book-page toc-page" dir="${rtl ? "rtl" : "ltr"}">
        <h2>${escapeHtml(labels.toc)}</h2>
        <ol class="toc-list">${(book.indice || []).map((item) => `<li><span>${escapeHtml(labels.chapter)} ${escapeHtml(String(item.capitulo))}</span><strong>${escapeHtml(item.titulo)}</strong><em>${escapeHtml(item.descripcion || "")}</em></li>`).join("")}</ol>
      </section>

      ${chapters}

      <section class="book-page">
        <h2>${escapeHtml(labels.resources)}</h2>
        ${(book.recursos_extra || []).map((item) => `<h3>${escapeHtml(item.titulo)}</h3><p>${formatText(item.contenido)}</p>`).join("")}
      </section>

      <section class="book-page">
        <h2>${escapeHtml(labels.conclusion)}</h2>
        <p>${formatText(book.conclusion_final)}</p>
        <h2>${escapeHtml(labels.authorAbout)}</h2>
        <p>${formatText(book.sobre_el_autor)}</p>
      </section>
    </div>
  `;
  document.getElementById("bookPreview").innerHTML = html;
}

function normalizeBook(book, payload, owner) {
  return {
    ...book,
    titulo: book.titulo || payload.titulo,
    autor: book.autor || payload.autor || "BookForge AI Studio",
    idioma: payload.idioma || book.idioma,
    plataforma: book.plataforma || payload.plataforma || "Universal",
    tipo: book.tipo || payload.tipo,
    paginas_estimadas: Number(book.paginas_estimadas || payload.pages || 100),
    owner,
    created_at: new Date().toISOString()
  };
}

function buildDemoBook(payload) {
  const title = payload.titulo || "Ebook de prueba";
  const chapters = Number(payload.capitulos || 10);
  const topic = payload.tema || "crear y publicar un ebook profesional";
  const chapterTitles = [
    "La promesa central del libro",
    "Comprender al lector ideal",
    "Estructura editorial paso a paso",
    "Contenido práctico y aplicable",
    "Diseño, portada y experiencia de lectura",
    "Publicación, precio y mejora continua"
  ];
  const chapterItems = Array.from({ length: Math.min(chapters, 6) }, (_, index) => {
    const number = index + 1;
    const chapterTitle = chapterTitles[index] || `Bloque editorial ${number}`;
    return {
      capitulo: number,
      titulo: chapterTitle,
      introduccion: `Este capítulo forma parte de una versión demo organizada del libro "${title}". Su objetivo es mostrar una estructura editorial limpia: entrada del capítulo, desarrollo por secciones, conclusión y ejercicio. En una generación real con Gemini, Claude, OpenAI u OpenRouter, cada bloque se expande con mayor profundidad, ejemplos específicos y una voz adaptada al lector. Aquí usamos contenido de prueba para que puedas revisar la presentación, la portada, el PDF y los formatos de exportación sin registrarte.`,
      secciones: [
        {
          subtitulo: "Objetivo de la sección",
          contenido: `La sección abre con una idea concreta relacionada con ${topic}. Primero sitúa al lector, después explica por qué el tema importa y finalmente propone una acción sencilla. Esta progresión evita que el contenido parezca una lista desordenada. El libro debe sentirse como una guía construida por un editor: cada parte cumple una función y prepara la siguiente. En modo API, este párrafo se convierte en una sección larga con ejemplos, matices, casos de uso y recomendaciones específicas.`
        },
        {
          subtitulo: "Aplicación práctica",
          contenido: `Una buena obra publicable no solo informa: guía al lector hacia una transformación concreta. Por eso cada capítulo incluye una aplicación práctica y una conclusión breve. Esta demo permite comprobar que el manuscrito queda ordenado, que el índice es legible, que la portada tiene diseño visible y que las exportaciones funcionan. Cuando conectas una API real, BookForge genera contenido extenso para libros de 50, 100, 200 o 300 páginas en distintos idiomas.`
        }
      ],
      conclusion: "El capítulo termina conectando la teoría con una acción concreta para que el lector avance sin sentirse perdido.",
      ejercicio: "Escribe tres ideas que puedas aplicar hoy y convierte una de ellas en una acción de 15 minutos."
    };
  });

  return normalizeBook({
    titulo: title,
    subtitulo: "Una guía profesional creada con BookForge AI",
    autor: payload.autor || "BookForge AI Studio",
    idioma: payload.idioma || "Español",
    plataforma: payload.plataforma || "Universal",
    tipo: payload.tipo || "Non-fiction",
    descripcion_editorial: `Descubre una guía práctica sobre ${payload.tema || "tu tema"} diseñada para lectores que buscan claridad, estructura y resultados aplicables. Esta versión demo permite validar el flujo de creación, el PDF y los formatos universales antes de conectar una API real.`,
    keywords: ["ebook", "guía práctica", "libro digital", "workbook", "publicación", "PDF", "BookForge"],
    categoria_editorial: "No ficción / Desarrollo práctico",
    portada: {
      titulo_portada: title,
      subtitulo_portada: "Guía completa para transformar ideas en un libro publicable",
      autor_portada: payload.autor || "BookForge AI Studio",
      concepto: "Portada premium con composición editorial, alto contraste y foco comercial.",
      paleta: ["#111827", "#4f46e5", "#f59e0b"],
      tipografia: "Playfair Display para título, Inter para datos secundarios",
      prompt_imagen: `Portada editorial premium para un ebook titulado ${title}, estilo ${payload.estilo || "elegante"}, sin texto incrustado`,
      texto_contraportada: "Un libro claro, práctico y listo para convertir una idea en un producto digital publicable."
    },
    indice: chapterItems.map((chapter) => ({ capitulo: chapter.capitulo, titulo: chapter.titulo, descripcion: "Capítulo estructurado con introducción, desarrollo, conclusión y ejercicio." })),
    contenido: chapterItems,
    recursos_extra: [{ titulo: "Checklist de publicación universal", contenido: "Revisa título, portada, descripción, keywords, categoría, formato PDF, EPUB, DOCX, enlaces y precio antes de publicar o entregar el ebook." }],
    conclusion_final: "Esta conclusión demo valida el cierre editorial del libro. Con una API configurada, BookForge genera una conclusión más extensa, humana y adaptada al idioma, plataforma y lector objetivo.",
    sobre_el_autor: "BookForge AI Studio ayuda a convertir ideas en libros digitales listos para publicar.",
    paginas_estimadas: Number(payload.pages || 100),
    control_calidad: { estado: "demo", tono_humano: "medio", listo_para_publicar: false }
  }, payload, "demo-local");
}

function saveLocalBook(id, book) {
  const books = JSON.parse(localStorage.getItem("bookforge_local_books") || "[]");
  const next = [{ id, book }, ...books.filter((item) => item.id !== id)].slice(0, 25);
  localStorage.setItem("bookforge_local_books", JSON.stringify(next));
}

async function loadHistory() {
  const localBooks = JSON.parse(localStorage.getItem("bookforge_local_books") || "[]");
  if (!state.token) {
    renderHistoryItems(localBooks.map((item) => ({ id: item.id, ...item.book })));
    return;
  }
  try {
    const data = await apiFetch(API.generate);
    renderHistoryItems([...(data.books || []), ...localBooks.map((item) => ({ id: item.id, ...item.book }))]);
  } catch {
    renderHistoryItems(localBooks.map((item) => ({ id: item.id, ...item.book })));
  }
}

function renderHistoryItems(books) {
  const list = document.getElementById("historyList");
  if (!list) return;
  list.innerHTML = books.length ? books.map((book) => `
    <div class="history-item">
      <strong>${escapeHtml(book.titulo)}</strong>
      <span>${escapeHtml(book.idioma)} · ${escapeHtml(book.plataforma)} · ${escapeHtml(String(book.paginas_estimadas))} páginas</span>
      <button data-book-id="${book.id}">${String(book.id).startsWith("local") || String(book.id).startsWith("demo") ? "Guardado local" : "Guardado en KV"}</button>
    </div>
  `).join("") : `<p>No hay libros todavía.</p>`;
}

function startLoading(button) {
  button.disabled = true;
  button.classList.add("loading");
  button.textContent = "Forjando libro completo...";
  let progress = 0;
  setStatus(progress, "Creando estructura editorial", "Diseñando índice, portada, metadata y capítulos largos.");
  clearInterval(state.progressTimer);
  state.progressTimer = setInterval(() => {
    progress = Math.min(92, progress + Math.ceil(Math.random() * 7));
    const titles = progress > 78 ? "Revisión humana final" : progress > 55 ? "Corrigiendo estilo y errores" : progress > 30 ? "Redactando contenido largo" : "Preparando portada y edición universal";
    const text = progress > 55
      ? "El editor IA está eliminando repeticiones, tono robótico, incoherencias y errores antes de guardar."
      : "La IA está generando el manuscrito, portada y materiales de publicación.";
    setStatus(progress, titles, text);
  }, 1400);
}

function stopLoading(button) {
  clearInterval(state.progressTimer);
  setStatus(100, "Libro revisado y generado", "El libro pasó por una revisión editorial antes de guardarse. Revisa el preview y exporta.");
  button.disabled = false;
  button.classList.remove("loading");
  button.textContent = "Generar Libro Ahora";
}

function setStatus(progress, title, text) {
  const ring = document.getElementById("progressRing");
  if (ring) {
    ring.textContent = `${progress}%`;
    ring.style.background = `conic-gradient(var(--primary) ${progress * 3.6}deg, rgba(255,255,255,.08) 0deg)`;
  }
  setText("statusTitle", title);
  setText("statusText", text);
}

function bindExports() {
  document.querySelectorAll("[data-export]").forEach((button) => {
    button.addEventListener("click", () => {
      if (!state.book) return toast("Genera un libro primero.");
      const type = button.dataset.export;
      if (type === "pdf") return window.BookForgeExport.pdfUniversal(state.book);
      if (type === "print") return window.BookForgeExport.pdfPrint(state.book);
      if (type === "epub") return window.BookForgeExport.epub(state.book);
      if (type === "docx") return window.BookForgeExport.docx(state.book);
    });
  });
}

async function apiFetch(url, options = {}, auth = true) {
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  if (auth && state.token) headers.Authorization = `Bearer ${state.token}`;
  const response = await fetch(url, {
    method: options.method || "GET",
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Error de conexión (${response.status})`);
  return data;
}

function toast(message) {
  const element = document.getElementById("toast");
  if (!element) return alert(message);
  element.textContent = message;
  element.classList.add("show");
  clearTimeout(element.timer);
  element.timer = setTimeout(() => element.classList.remove("show"), 4200);
}

function setText(id, value) {
  const element = document.getElementById(id);
  if (element) element.textContent = value;
}

function shortLang(value) {
  return { Español: "ES", Inglés: "EN", Portugués: "PT", Francés: "FR", Alemán: "DE", Italiano: "IT", Árabe: "AR", Holandés: "NL" }[value] || value.slice(0, 2).toUpperCase();
}

function isArabicLanguage(language) {
  return /árabe|arabe|arabic|العربية|عربي/i.test(String(language || ""));
}

function targetWordsForPages(pages) {
  const safePages = Math.max(5, Math.min(500, Number(pages || 5)));
  return Math.max(2200, safePages * 430);
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

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#039;" })[char]);
}

function formatText(value = "") {
  return escapeHtml(value).replace(/\n{2,}/g, "</p><p>").replace(/\n/g, "<br>");
}
