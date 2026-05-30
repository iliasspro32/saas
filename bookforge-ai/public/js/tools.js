const toolsApi = "/api/tools";
const baseVoices = [
  { id: "Kore", name: "Kore", description: "Narración firme y profesional" },
  { id: "Puck", name: "Puck", description: "Tono dinámico y cercano" },
  { id: "Charon", name: "Charon", description: "Voz cálida y conversacional" },
  { id: "Fenrir", name: "Fenrir", description: "Dicción clara y analítica" },
  { id: "Zephyr", name: "Zephyr", description: "Voz neutra y equilibrada" }
];
let landingHtml = "";
let customVoices = JSON.parse(localStorage.getItem("bookforge_custom_voices") || "[]");

document.addEventListener("DOMContentLoaded", () => {
  bindTabs();
  bindVoice();
  bindClone();
  bindLanding();
  renderVoices();
});

function bindTabs() {
  document.querySelectorAll("[data-tab]").forEach((button) => button.addEventListener("click", () => {
    document.querySelectorAll("[data-tab]").forEach((item) => item.classList.toggle("active", item === button));
    document.getElementById("voiceView").classList.toggle("hidden", button.dataset.tab !== "voice");
    document.getElementById("landingView").classList.toggle("hidden", button.dataset.tab !== "landing");
  }));
}

function bindVoice() {
  document.getElementById("voiceSelect").addEventListener("change", applySelectedVoiceGuide);
  document.getElementById("voiceForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = event.currentTarget.querySelector("button");
    const payload = Object.fromEntries(new FormData(event.currentTarget).entries());
    try {
      setLoading(button, true, "Generando...");
      const data = await post(`${toolsApi}/voice-synthesize`, payload);
      document.getElementById("voiceAudio").src = data.audioData;
      document.getElementById("voiceDownload").href = data.audioData;
      document.getElementById("voiceEmpty").classList.add("hidden");
      document.getElementById("voiceResult").classList.remove("hidden");
      toast("Audio generado correctamente.");
    } catch (error) {
      toast(error.message);
    } finally {
      setLoading(button, false, "Generar audio");
    }
  });
}

function bindClone() {
  document.getElementById("cloneForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = event.currentTarget.querySelector("button");
    const form = new FormData(event.currentTarget);
    const file = form.get("audio");
    try {
      setLoading(button, true, "Analizando...");
      const audioData = await readFile(file);
      const data = await post(`${toolsApi}/voice-clone`, { voiceName: form.get("voiceName"), mimeType: file.type, audioData });
      customVoices.unshift(data.profile);
      customVoices = customVoices.slice(0, 12);
      localStorage.setItem("bookforge_custom_voices", JSON.stringify(customVoices));
      event.currentTarget.reset();
      renderVoices();
      toast("Firma vocal aproximada guardada.");
    } catch (error) {
      toast(error.message);
    } finally {
      setLoading(button, false, "Crear firma vocal");
    }
  });
}

function bindLanding() {
  document.getElementById("landingForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = event.currentTarget.querySelector("button");
    try {
      setLoading(button, true, "Generando...");
      const data = await post(`${toolsApi}/landing`, Object.fromEntries(new FormData(event.currentTarget).entries()));
      landingHtml = data.html;
      document.getElementById("landingEmpty").classList.add("hidden");
      showLandingPreview();
      toast("Landing HTML generada.");
    } catch (error) {
      toast(error.message);
    } finally {
      setLoading(button, false, "Generar landing HTML");
    }
  });
  document.getElementById("previewLanding").addEventListener("click", toggleLandingView);
  document.getElementById("copyLanding").addEventListener("click", async () => {
    if (!landingHtml) return toast("Genera una landing primero.");
    await navigator.clipboard.writeText(landingHtml);
    toast("HTML copiado.");
  });
  document.getElementById("downloadLanding").addEventListener("click", () => {
    if (!landingHtml) return toast("Genera una landing primero.");
    const url = URL.createObjectURL(new Blob([landingHtml], { type: "text/html;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "landing-page.html";
    link.click();
    URL.revokeObjectURL(url);
  });
}

function showLandingPreview() {
  if (!landingHtml) return toast("Genera una landing primero.");
  const preview = document.getElementById("landingPreview");
  preview.srcdoc = landingHtml;
  preview.classList.remove("hidden");
  document.getElementById("landingCode").classList.add("hidden");
  document.getElementById("previewLanding").textContent = "Ver código";
}

function toggleLandingView() {
  if (!landingHtml) return toast("Genera una landing primero.");
  const preview = document.getElementById("landingPreview");
  const code = document.getElementById("landingCode");
  const showingPreview = !preview.classList.contains("hidden");
  preview.classList.toggle("hidden", showingPreview);
  code.classList.toggle("hidden", !showingPreview);
  code.textContent = landingHtml;
  document.getElementById("previewLanding").textContent = showingPreview ? "Preview" : "Ver código";
}

function renderVoices() {
  const select = document.getElementById("voiceSelect");
  select.innerHTML = [
    ...baseVoices.map((voice) => `<option value="${voice.id}">${voice.name} · ${voice.description}</option>`),
    ...customVoices.map((voice) => `<option value="${voice.baseVoice}" data-guide="${escapeHtml(voice.speechGuide)}">${escapeHtml(voice.name)} · firma personalizada</option>`)
  ].join("");
  document.getElementById("profileList").innerHTML = customVoices.length
    ? customVoices.map((voice, index) => `<div class="voice-profile"><strong>${escapeHtml(voice.name)}</strong><span>${escapeHtml(voice.descriptor)}</span><button type="button" data-profile="${index}">Usar esta firma</button></div>`).join("")
    : `<div class="empty-result">Todavía no has guardado firmas vocales.</div>`;
  document.querySelectorAll("[data-profile]").forEach((button) => button.addEventListener("click", () => {
    const voice = customVoices[Number(button.dataset.profile)];
    select.value = voice.baseVoice;
    document.getElementById("speechGuide").value = voice.speechGuide;
    toast(`Firma "${voice.name}" seleccionada.`);
  }));
}

function applySelectedVoiceGuide() {
  const option = document.getElementById("voiceSelect").selectedOptions[0];
  document.getElementById("speechGuide").value = option?.dataset.guide || "";
}

async function post(url, body) {
  const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "No se pudo completar la solicitud.");
  return data;
}

function readFile(file) {
  return new Promise((resolve, reject) => {
    if (!file) return reject(new Error("Selecciona un archivo de audio."));
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("No se pudo leer el audio."));
    reader.readAsDataURL(file);
  });
}

function setLoading(button, loading, text) {
  button.disabled = loading;
  button.textContent = text;
}

function toast(message) {
  const element = document.getElementById("toast");
  element.textContent = message;
  element.classList.add("show");
  clearTimeout(element.timer);
  element.timer = setTimeout(() => element.classList.remove("show"), 4200);
}

function escapeHtml(value) {
  return String(value || "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[char]);
}
