const toolsApi = "/api/tools";
const MB = 1024 * 1024;
const MAX_CONVERT_PAYLOAD_BYTES = 24 * MB;
const MAX_CONVERT_AUDIO_SOURCE_BYTES = 60 * MB;
const MAX_CONVERT_VIDEO_SOURCE_BYTES = 24 * MB;
const MAX_CLONE_PAYLOAD_BYTES = 9 * MB;
const MAX_CLONE_AUDIO_SOURCE_BYTES = 30 * MB;
const baseVoices = [
  { id: "Kore", name: "Kore", description: "Narración firme y profesional" },
  { id: "Puck", name: "Puck", description: "Tono dinámico y cercano" },
  { id: "Charon", name: "Charon", description: "Voz cálida y conversacional" },
  { id: "Fenrir", name: "Fenrir", description: "Dicción clara y analítica" },
  { id: "Zephyr", name: "Zephyr", description: "Voz neutra y equilibrada" },
  { id: "Yassine", name: "Yassine marroquí", description: "Voz masculina cálida con estilo darija marroquí", guide: "Entonación masculina marroquí natural, cálida y conversacional. Pronunciación magrebí fluida para darija." },
  { id: "Ibrahim", name: "Ibrahim árabe clásico", description: "Voz masculina árabe formal y profunda", guide: "Pronunciación árabe clara, resonante y formal, con dicción cuidada." },
  { id: "Omar", name: "Omar árabe", description: "Voz masculina árabe natural y cercana", guide: "Tono masculino árabe natural, cercano, fluido y expresivo." },
  { id: "Malika", name: "Malika marroquí", description: "Voz femenina marroquí elegante", guide: "Voz femenina marroquí con dicción clara, ritmo natural y pronunciación magrebí fluida." },
  { id: "Yasmin", name: "Yasmin magrebí", description: "Voz femenina juvenil del Magreb", guide: "Voz femenina juvenil, alegre y dinámica, con entonación magrebí natural." }
];
let landingHtml = "";
let customVoices = JSON.parse(localStorage.getItem("bookforge_custom_voices") || "[]");

document.addEventListener("DOMContentLoaded", () => {
  bindTabs();
  bindVoice();
  bindConvert();
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

function bindConvert() {
  document.getElementById("convertVoiceSelect").addEventListener("change", applySelectedConvertGuide);
  document.getElementById("convertForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = event.currentTarget.querySelector("button");
    const form = new FormData(event.currentTarget);
    const file = form.get("media");
    try {
      setLoading(button, true, "Preparando archivo...");
      const prepared = await prepareMediaFile(file);
      setLoading(button, true, "Procesando...");
      const data = await post(`${toolsApi}/voice-convert`, {
        mediaData: prepared.dataUrl,
        mimeType: prepared.mimeType,
        voiceName: form.get("voiceName"),
        language: form.get("language"),
        speechGuide: form.get("speechGuide")
      });
      document.getElementById("convertAudio").src = data.audioData;
      document.getElementById("convertDownload").href = data.audioData;
      document.getElementById("convertTranscription").textContent = data.transcription;
      document.getElementById("convertResult").classList.remove("hidden");
      toast("Voz cambiada correctamente.");
    } catch (error) {
      toast(error.message);
    } finally {
      setLoading(button, false, "Cambiar voz");
    }
  });
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
      setLoading(button, true, "Preparando audio...");
      const prepared = await prepareAudioFile(file, {
        maxPayloadBytes: MAX_CLONE_PAYLOAD_BYTES,
        maxSourceBytes: MAX_CLONE_AUDIO_SOURCE_BYTES,
        tooLargeMessage: "La muestra sigue siendo demasiado grande después de comprimirla. Usa una grabación más corta."
      });
      setLoading(button, true, "Analizando...");
      const data = await post(`${toolsApi}/voice-clone`, { voiceName: form.get("voiceName"), mimeType: prepared.mimeType, audioData: prepared.dataUrl });
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
  const voiceOptions = [
    ...baseVoices.map((voice) => `<option value="${voice.id}" data-guide="${escapeHtml(voice.guide || "")}">${voice.name} · ${voice.description}</option>`),
    ...customVoices.map((voice) => `<option value="${voice.baseVoice}" data-guide="${escapeHtml(voice.speechGuide)}">${escapeHtml(voice.name)} · firma personalizada</option>`)
  ].join("");
  select.innerHTML = voiceOptions;
  document.getElementById("convertVoiceSelect").innerHTML = voiceOptions;
  document.getElementById("profileList").innerHTML = customVoices.length
    ? customVoices.map((voice, index) => `<div class="voice-profile"><strong>${escapeHtml(voice.name)}</strong><span>${escapeHtml(voice.descriptor)}</span><button type="button" data-profile="${index}">Usar esta firma</button></div>`).join("")
    : `<div class="empty-result">Todavía no has guardado firmas vocales.</div>`;
  document.querySelectorAll("[data-profile]").forEach((button) => button.addEventListener("click", () => {
    const voice = customVoices[Number(button.dataset.profile)];
    select.value = voice.baseVoice;
    document.getElementById("speechGuide").value = voice.speechGuide;
    document.getElementById("convertVoiceSelect").value = voice.baseVoice;
    document.getElementById("convertSpeechGuide").value = voice.speechGuide;
    toast(`Firma "${voice.name}" seleccionada.`);
  }));
}

function applySelectedConvertGuide() {
  const option = document.getElementById("convertVoiceSelect").selectedOptions[0];
  document.getElementById("convertSpeechGuide").value = option?.dataset.guide || "";
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

async function prepareMediaFile(file) {
  if (!file) throw new Error("Selecciona un archivo de audio o vídeo.");
  if (!String(file.type || "").startsWith("audio/")) {
    if (file.size > MAX_CONVERT_VIDEO_SOURCE_BYTES) {
      throw new Error("El vídeo es demasiado grande. Usa un clip de hasta 24 MB o conviértelo a MP3.");
    }
    return { dataUrl: await readFile(file), mimeType: file.type || "video/mp4" };
  }
  return prepareAudioFile(file, {
    maxPayloadBytes: MAX_CONVERT_PAYLOAD_BYTES,
    maxSourceBytes: MAX_CONVERT_AUDIO_SOURCE_BYTES,
    tooLargeMessage: "El audio sigue siendo demasiado grande después de comprimirlo. Usa una grabación más corta."
  });
}

async function prepareAudioFile(file, options) {
  if (!file) throw new Error("Selecciona un archivo de audio.");
  if (!String(file.type || "").startsWith("audio/")) throw new Error("Selecciona un archivo de audio válido.");
  if (file.size > options.maxSourceBytes) {
    throw new Error(`El audio supera ${Math.round(options.maxSourceBytes / MB)} MB. Usa una grabación más corta.`);
  }
  if (file.size <= options.maxPayloadBytes) return { dataUrl: await readFile(file), mimeType: file.type || "audio/wav" };

  const compressed = await compressAudioFile(file);
  if (compressed.size > options.maxPayloadBytes) throw new Error(options.tooLargeMessage);
  return { dataUrl: await readFile(compressed), mimeType: "audio/wav" };
}

async function compressAudioFile(file) {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) throw new Error("Tu navegador no puede comprimir este audio. Conviértelo a MP3 e inténtalo de nuevo.");

  const context = new AudioContextClass();
  try {
    const audio = await context.decodeAudioData(await file.arrayBuffer());
    const sampleRate = 16000;
    const samples = new Float32Array(Math.ceil(audio.duration * sampleRate));
    const channels = Array.from({ length: audio.numberOfChannels }, (_, index) => audio.getChannelData(index));
    for (let index = 0; index < samples.length; index += 1) {
      const sourceIndex = Math.min(audio.length - 1, Math.floor(index * audio.sampleRate / sampleRate));
      samples[index] = channels.reduce((sum, channel) => sum + channel[sourceIndex], 0) / channels.length;
    }
    return new Blob([encodeWav(samples, sampleRate)], { type: "audio/wav" });
  } catch {
    throw new Error("No se pudo comprimir el audio. Usa un archivo MP3, WAV o M4A más corto.");
  } finally {
    await context.close().catch(() => {});
  }
}

function encodeWav(samples, sampleRate) {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const writeText = (offset, value) => {
    for (let index = 0; index < value.length; index += 1) view.setUint8(offset + index, value.charCodeAt(index));
  };
  writeText(0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  writeText(8, "WAVE");
  writeText(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeText(36, "data");
  view.setUint32(40, samples.length * 2, true);
  for (let index = 0; index < samples.length; index += 1) {
    const sample = Math.max(-1, Math.min(1, samples[index]));
    view.setInt16(44 + index * 2, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
  }
  return buffer;
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
