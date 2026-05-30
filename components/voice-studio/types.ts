export type VoiceType = "prebuilt" | "cloned";

export interface VoiceProfile {
  id: string;
  name: string;
  type: VoiceType;
  gender: "masculino" | "femenino" | "neutro";
  baseVoiceName?: "Kore" | "Puck" | "Charon" | "Fenrir" | "Zephyr";
  descriptor: string;
  pitchShift?: number; // Pitch semitones offset
  audioSampleData?: string; // Base64 audio sample
  tags: string[];
  isCustom?: boolean;
}

export interface ConversionHistoryItem {
  id: string;
  date: string;
  originalFileName: string;
  originalType: "audio" | "video";
  targetVoiceId: string;
  targetVoiceName: string;
  transcription?: string;
  audioData: string; // Base64 audio results
  duration?: string;
}

export interface DspSettings {
  pitch: number; // -12 to 12 semitones
  reverb: number; // 0 to 100 level
  distortion: number; // 0 to 100 level
  echo: number; // 0 to 100 level
  eqLow: number; // -10 to 10 dB
  eqMid: number; // -10 to 10 dB
  eqHigh: number; // -10 to 10 dB
  speed: number; // 0.5 to 2.0
}
