const API = {
  auth: "/api/auth",
  generate: "/api/generate-book",
  payments: "/api/payments"
};

const state = {
  token: localStorage.getItem("bookforge_session") || "",
  user: null,
  book: null,
  bookId: null,
  progressTimer: null
};

document.addEventListener("DOMContentLoaded", () => {
  bindAuth();
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
    state.token = "";
    state.user = null;
    renderAuth();
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
  if (!state.token) return renderAuth();
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
    if (!state.token) return toast("Entra con magic link antes de generar.");
    const button = document.getElementById("generateButton");
    const payload = Object.fromEntries(new FormData(form).entries());

    try {
      startLoading(button);
      const data = await apiFetch(API.generate, { method: "POST", body: payload });
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
  setText("statFormat", data.plataforma || "KDP");
}

async function regenerateFirstSection() {
  if (!state.book || !state.bookId) return toast("Genera un libro primero.");
  const first = state.book.contenido?.[0];
  const section = first?.secciones?.[0];
  if (!first || !section) return toast("No hay sección para regenerar.");
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
  element.style.background = `linear-gradient(145deg, ${colors[0]}, ${colors[1]} 62%, ${colors[2]})`;
  element.innerHTML = `
    <strong>${escapeHtml(cover.titulo_portada || book.titulo)}</strong>
    <div>
      <h2>${escapeHtml(cover.titulo_portada || book.titulo)}</h2>
      <p>${escapeHtml(cover.subtitulo_portada || book.subtitulo || "")}</p>
    </div>
    <strong>${escapeHtml(cover.autor_portada || book.autor || "")}</strong>
  `;
}

function renderManuscript(book) {
  const chapters = (book.contenido || []).map((chapter) => `
    <section class="chapter">
      <h2>Capítulo ${chapter.capitulo}: ${escapeHtml(chapter.titulo)}</h2>
      <p>${formatText(chapter.introduccion)}</p>
      ${(chapter.secciones || []).map((section) => `
        <h3>${escapeHtml(section.subtitulo)}</h3>
        <p>${formatText(section.contenido)}</p>
      `).join("")}
      <h3>Conclusión del capítulo</h3>
      <p>${formatText(chapter.conclusion)}</p>
      <div class="metadata"><strong>Ejercicio:</strong><p>${formatText(chapter.ejercicio)}</p></div>
    </section>
  `).join("");

  const html = `
    <div class="paper" id="bookPaper">
      <h1>${escapeHtml(book.titulo)}</h1>
      <p><strong>${escapeHtml(book.subtitulo || "")}</strong></p>
      <p>${escapeHtml(book.autor || "")}</p>
      <div class="metadata">
        <p><strong>Descripción KDP:</strong> ${formatText(book.descripcion_kdp)}</p>
        <p><strong>Categoría:</strong> ${escapeHtml(book.categoria_kdp || "")}</p>
        <p><strong>Keywords:</strong> ${(book.keywords || []).map(escapeHtml).join(", ")}</p>
        <p><strong>Páginas estimadas:</strong> ${escapeHtml(String(book.paginas_estimadas || ""))}</p>
      </div>
      <h2>Índice</h2>
      <ol>${(book.indice || []).map((item) => `<li><strong>${escapeHtml(item.titulo)}</strong> - ${escapeHtml(item.descripcion || "")}</li>`).join("")}</ol>
      ${chapters}
      <h2>Recursos extra</h2>
      ${(book.recursos_extra || []).map((item) => `<h3>${escapeHtml(item.titulo)}</h3><p>${formatText(item.contenido)}</p>`).join("")}
      <h2>Conclusión final</h2>
      <p>${formatText(book.conclusion_final)}</p>
      <h2>Sobre el autor</h2>
      <p>${formatText(book.sobre_el_autor)}</p>
    </div>
  `;
  document.getElementById("bookPreview").innerHTML = html;
}

async function loadHistory() {
  if (!state.token) return;
  try {
    const data = await apiFetch(API.generate);
    const list = document.getElementById("historyList");
    if (!list) return;
    list.innerHTML = data.books?.length ? data.books.map((book) => `
      <div class="history-item">
        <strong>${escapeHtml(book.titulo)}</strong>
        <span>${escapeHtml(book.idioma)} · ${escapeHtml(book.plataforma)} · ${escapeHtml(String(book.paginas_estimadas))} páginas</span>
        <button data-book-id="${book.id}">Guardado en KV</button>
      </div>
    `).join("") : `<p>No hay libros todavía.</p>`;
  } catch {
    const list = document.getElementById("historyList");
    if (list) list.innerHTML = `<p>Entra para ver tu historial.</p>`;
  }
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
    const titles = progress > 78 ? "Revisión humana final" : progress > 55 ? "Corrigiendo estilo y errores" : progress > 30 ? "Redactando contenido largo" : "Preparando portada y KDP";
    const text = progress > 55
      ? "El editor IA está eliminando repeticiones, tono robótico, incoherencias y errores antes de guardar."
      : "Claude está generando el manuscrito, portada y assets de publicación.";
    setStatus(progress, titles, text);
  }, 1400);
}

function stopLoading(button) {
  clearInterval(state.progressTimer);
  setStatus(100, "Libro revisado y generado", "El libro pasó por una revisión editorial antes de guardarse. Revisa el preview y exporta.");
  button.disabled = false;
  button.classList.remove("loading");
  button.textContent = "⚡ Generar Libro Ahora";
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
      if (type === "kdp") return window.BookForgeExport.pdfKdp(state.book);
      if (type === "etsy") return window.BookForgeExport.pdfEtsy(state.book);
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
  if (!response.ok) throw new Error(data.error || "Error de conexión");
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

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#039;" })[char]);
}

function formatText(value = "") {
  return escapeHtml(value).replace(/\n{2,}/g, "</p><p>").replace(/\n/g, "<br>");
}
