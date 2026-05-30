import { GoogleGenAI, Modality } from "@google/genai";

type VoiceGender = "masculino" | "femenino" | "neutro";
type BaseVoiceName = "Kore" | "Puck" | "Charon" | "Fenrir" | "Zephyr";

export interface VoiceProfile {
  id: string;
  name: string;
  type: "prebuilt" | "cloned";
  gender: VoiceGender;
  baseVoiceName?: BaseVoiceName;
  descriptor: string;
  pitchShift?: number;
  audioSampleData?: string;
  tags: string[];
  isCustom?: boolean;
  speechGuide?: string;
}

const prebuiltVoices: VoiceProfile[] = [
  {
    id: "prebuilt-kore",
    name: "Kore (Masculina Profunda)",
    type: "prebuilt",
    gender: "masculino",
    baseVoiceName: "Kore",
    descriptor: "Tono formal, estable y masculino, ideal para narraciones, audiolibros o explicaciones tecnicas.",
    tags: ["Claro", "Corporativo", "Profesional"],
  },
  {
    id: "prebuilt-puck",
    name: "Puck (Femenina Energetica)",
    type: "prebuilt",
    gender: "femenino",
    baseVoiceName: "Puck",
    descriptor: "Estilo jovial, amigable, energico y conversacional. Excelente para tutoriales y contenidos creativos.",
    tags: ["Entusiasta", "Juvenil", "Agil"],
  },
  {
    id: "prebuilt-charon",
    name: "Charon (Masculina Natural)",
    type: "prebuilt",
    gender: "masculino",
    baseVoiceName: "Charon",
    descriptor: "Estilo reflexivo, un poco grave pero muy calido y humano. Ideal para podcast y dialogos informales.",
    tags: ["Calido", "Conversacional", "Podcast"],
  },
  {
    id: "prebuilt-fenrir",
    name: "Fenrir (Femenina Profesional)",
    type: "prebuilt",
    gender: "femenino",
    baseVoiceName: "Fenrir",
    descriptor: "Voz femenina articulada con excelente diccion, seria y con un temperamento analitico y calmado.",
    tags: ["Serio", "Noticias", "Educativo"],
  },
  {
    id: "prebuilt-zephyr",
    name: "Zephyr (Voz Neutra / Inteligente)",
    type: "prebuilt",
    gender: "neutro",
    baseVoiceName: "Zephyr",
    descriptor: "Voz androgina sumamente fluida y balanceada que destaca por su inteligencia analitica y ritmo limpio.",
    tags: ["Futurista", "Neutro", "Moderno"],
  },
  {
    id: "prebuilt-yassine",
    name: "Yassine (Persona Marroqui)",
    type: "prebuilt",
    gender: "masculino",
    baseVoiceName: "Charon",
    descriptor: "Voz con profundo acento marroqui natural, pronunciacion conversacional calida con influencias del dialecto Darija magrebi.",
    tags: ["Marroqui", "Magrebi", "Calido", "Arabe"],
  },
  {
    id: "prebuilt-malika",
    name: "Malika (Femenina Marroqui)",
    type: "prebuilt",
    gender: "femenino",
    baseVoiceName: "Fenrir",
    descriptor: "Voz femenina con un distinguido acento magrebi, diccion clara, entonacion calida, pausada y acogedora.",
    tags: ["Marroqui", "Magrebi", "Femenino", "Elegante"],
  },
  {
    id: "prebuilt-ibrahim",
    name: "Ibrahim (Arabe Clasico)",
    type: "prebuilt",
    gender: "masculino",
    baseVoiceName: "Kore",
    descriptor: "Voz masculina profunda y resonante inspirada en la elocuencia de Oriente Medio, con un tono formal y solemne.",
    tags: ["Arabe", "Solemne", "Profundo", "Formal"],
  },
  {
    id: "prebuilt-yasmin",
    name: "Yasmin (Juvenil Magrebi)",
    type: "prebuilt",
    gender: "femenino",
    baseVoiceName: "Puck",
    descriptor: "Voz femenina alegre, dinamica y juvenil con acento fresco del norte de Africa, ideal para explicaciones divertidas.",
    tags: ["Magrebi", "Juvenil", "Femenino", "Dinamico"],
  },
];

let clonedVoices: VoiceProfile[] = [
  {
    id: "cloned-narrator",
    name: "Narrador de Telenovela",
    type: "cloned",
    gender: "masculino",
    baseVoiceName: "Charon",
    descriptor: "Una voz profunda, dramatica y melodiosa, tipica de grandes producciones televisivas de los 90.",
    pitchShift: -2,
    tags: ["Dramatico", "Profundo", "Espanol"],
    isCustom: false,
    speechGuide: "Habla con tono grave, pausas dramaticas y gran fuerza emocional.",
  },
];

function getAi() {
  const apiKey = process.env.GEMINI_API_KEY;
  return apiKey ? new GoogleGenAI({ apiKey }) : null;
}

export function getSetupStatus() {
  const hasKey = Boolean(process.env.GEMINI_API_KEY);
  return {
    hasKey,
    status: hasKey ? "ready" : "missing",
    message: hasKey ? "Servicio de clonacion activo con Gemini conectado." : "Falta configurar GEMINI_API_KEY.",
  };
}

export function listVoices() {
  return { prebuilt: prebuiltVoices, cloned: clonedVoices };
}

export function deleteClonedVoice(id: string) {
  const initialLength = clonedVoices.length;
  clonedVoices = clonedVoices.filter((voice) => voice.id !== id);
  return clonedVoices.length < initialLength;
}

function normalizeMimeType(mimeType?: string) {
  if (!mimeType) return "audio/wav";
  const normalized = mimeType.toLowerCase().trim();
  if (normalized.startsWith("video/")) return normalized.includes("mp4") ? "video/mp4" : normalized;
  if (normalized.includes("wav") || normalized.includes("wave")) return "audio/wav";
  if (normalized.includes("mp3") || normalized.includes("mpeg")) return "audio/mp3";
  if (normalized.includes("m4a") || normalized.includes("aac") || normalized.includes("mp4")) return "audio/m4a";
  if (normalized.includes("webm")) return "audio/webm";
  if (normalized.includes("ogg")) return "audio/ogg";
  return normalized;
}

function addWavHeader(pcmBuffer: Buffer, sampleRate = 24000) {
  const header = Buffer.alloc(44);
  const dataSize = pcmBuffer.length;
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + dataSize, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(dataSize, 40);
  return Buffer.concat([header, pcmBuffer]);
}

function cleanBase64(data: string) {
  return data.includes(";base64,") ? data.split(";base64,")[1] : data;
}

export async function cloneVoice(input: { audioData?: string; mimeType?: string; voiceName?: string }) {
  const ai = getAi();
  if (!ai) throw new Error("API Key de Gemini no configurada");
  if (!input.audioData) throw new Error("Faltan los datos del audio de referencia");
  if (!input.voiceName) throw new Error("Por favor, asigna un nombre para la voz clonada");

  const response = await ai.models.generateContent({
    model: "gemini-3.5-flash",
    contents: [
      { inlineData: { data: cleanBase64(input.audioData), mimeType: normalizeMimeType(input.mimeType) } },
      `Analiza esta muestra de voz y devuelve solo JSON valido con gender, suggestedBaseVoice, descriptor, speechGuide y pitchShift. Usa gender masculino, femenino o neutro. Usa suggestedBaseVoice Kore, Puck, Charon, Fenrir o Zephyr. Responde en espanol.`,
    ],
    config: { responseMimeType: "application/json" },
  });

  const parsed = JSON.parse(response.text || "{}");
  const profile: VoiceProfile = {
    id: `cloned-${Date.now()}`,
    name: input.voiceName,
    type: "cloned",
    gender: parsed.gender || "neutro",
    baseVoiceName: parsed.suggestedBaseVoice || "Zephyr",
    descriptor: parsed.descriptor || "Voz personalizada clonada mediante analisis acustico.",
    pitchShift: Number(parsed.pitchShift) || 0,
    tags: ["Clonada"],
    isCustom: true,
    speechGuide: parsed.speechGuide || "Habla con naturalidad.",
    audioSampleData: input.audioData,
  };
  clonedVoices.unshift(profile);
  return profile;
}

export async function convertVoice(input: {
  audioData?: string;
  mimeType?: string;
  targetVoiceId?: string;
  translationLanguage?: string;
  emotionModifier?: string;
  voiceSpeed?: string;
  text?: string;
}) {
  const ai = getAi();
  if (!ai) throw new Error("API Key de Gemini no configurada");
  if (!input.text && !input.audioData) throw new Error("Falta el texto o el archivo de audio/video a convertir");

  const targetProfile = [...prebuiltVoices, ...clonedVoices].find((voice) => voice.id === input.targetVoiceId) || prebuiltVoices[0];
  let transcription = input.text?.trim() || "";

  if (!transcription && input.audioData) {
    const prompt =
      input.translationLanguage && input.translationLanguage !== "same"
        ? `Transcribe y traduce el audio al idioma ${input.translationLanguage}. Devuelve solo el texto final.`
        : "Transcribe el audio exactamente palabra por palabra. Devuelve solo el texto transcrito.";
    const transcribeResponse = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: [{ inlineData: { data: cleanBase64(input.audioData), mimeType: normalizeMimeType(input.mimeType) } }, prompt],
    });
    transcription = transcribeResponse.text?.trim() || "";
  }

  if (!transcription) throw new Error("No se pudo discernir voz inteligible en el archivo proporcionado.");

  const emotionMap: Record<string, string> = {
    cheerful: "Hazlo de manera alegre y sonriente.",
    whisper: "Susurra con tono intimo y suave.",
    excited: "Con gran emocion y energia.",
    deep: "Con entonacion profunda y autoritaria.",
    soft: "Con una voz tierna y tranquila.",
  };
  const speedText =
    input.voiceSpeed === "slow" ? "Habla despacio y con pausas marcadas. " : input.voiceSpeed === "fast" ? "Habla rapido y fluido. " : "";
  const styleText = targetProfile.type === "cloned" ? `Adopta esta personalidad acustica: ${targetProfile.descriptor}. ${targetProfile.speechGuide || ""} ` : targetProfile.descriptor;
  const synthesisText = `Haz una narracion vocal. ${emotionMap[input.emotionModifier || ""] || ""} ${speedText}${styleText}. Lee: "${transcription}"`;

  const ttsResponse = await ai.models.generateContent({
    model: "gemini-3.1-flash-tts-preview",
    contents: [{ parts: [{ text: synthesisText }] }],
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: targetProfile.baseVoiceName || "Zephyr" } } },
    },
  });

  const base64AudioOut = ttsResponse.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  if (!base64AudioOut) throw new Error("Gemini no devolvio audio sintetizado.");

  const wavBuffer = addWavHeader(Buffer.from(base64AudioOut, "base64"));
  return {
    success: true,
    transcription,
    audioData: `data:audio/wav;base64,${wavBuffer.toString("base64")}`,
    targetVoice: targetProfile.name,
    pitchShiftOffset: targetProfile.pitchShift || 0,
  };
}
