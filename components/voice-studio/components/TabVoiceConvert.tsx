import React from "react";
import { 
  Upload, Mic, Play, RefreshCw, Download, Music, Video, Sparkles, 
  Settings, Volume2, AlertCircle, CheckCircle2, ChevronRight, Sliders, PlayCircle, Loader2
} from "lucide-react";
import { VoiceProfile, DspSettings, ConversionHistoryItem } from "../types";
import { applyAudioDsp } from "../utils/audioDsp";

interface TabVoiceConvertProps {
  voices: {
    prebuilt: VoiceProfile[];
    cloned: VoiceProfile[];
  };
  selectedVoiceId: string;
  onAddHistoryItem: (item: ConversionHistoryItem) => void;
}

export default function TabVoiceConvert({
  voices,
  selectedVoiceId,
  onAddHistoryItem,
}: TabVoiceConvertProps) {
  // Input settings
  const [inputMode, setInputMode] = React.useState<"text" | "record" | "upload">("text");
  const [ttsText, setTtsText] = React.useState<string>("");
  const [isBlendingVideo, setIsBlendingVideo] = React.useState<boolean>(false);
  const [blendingProgress, setBlendingProgress] = React.useState<string>("");
  const [mergedVideoUrl, setMergedVideoUrl] = React.useState<string | null>(null);

  const [uploadFile, setUploadFile] = React.useState<File | null>(null);
  const [isRecording, setIsRecording] = React.useState<boolean>(false);
  const [recordedBlob, setRecordedBlob] = React.useState<Blob | null>(null);
  const [recordDuration, setRecordDuration] = React.useState<number>(0);
  
  // Custom execution configuration
  const [strategy, setStrategy] = React.useState<"ai" | "dsp">("ai");
  const [translationLanguage, setTranslationLanguage] = React.useState<string>("same");
  const [emotionModifier, setEmotionModifier] = React.useState<string>("natural");
  const [voiceSpeed, setVoiceSpeed] = React.useState<string>("normal");

  // DSP specifics
  const [dspMode, setDspMode] = React.useState<"normal" | "robot" | "megaphone" | "cave" | "custom" | "moroccan">("normal");
  const [dspSettings, setDspSettings] = React.useState<DspSettings>({
    pitch: 0,
    reverb: 0,
    distortion: 0,
    echo: 0,
    eqLow: 0,
    eqMid: 0,
    eqHigh: 0,
    speed: 1.0,
  });

  // State statuses
  const [isProcessing, setIsProcessing] = React.useState<boolean>(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [successMessage, setSuccessMessage] = React.useState<string | null>(null);
  
  // Output and history results
  const [originalAudioUrl, setOriginalAudioUrl] = React.useState<string | null>(null);
  const [convertedAudioUrl, setConvertedAudioUrl] = React.useState<string | null>(null);
  const [transcribedText, setTranscribedText] = React.useState<string | null>(null);
  const [convertedBase64, setConvertedBase64] = React.useState<string | null>(null);

  const mediaRecorderRef = React.useRef<MediaRecorder | null>(null);
  const recordIntervalRef = React.useRef<NodeJS.Timeout | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  const syncVideoRef = React.useRef<HTMLVideoElement | null>(null);
  const syncAudioRef = React.useRef<HTMLAudioElement | null>(null);

  // Decodes full base64 Data URIs/strings to a local lightweight Blob Object URL to ensure
  // universal compatibility, instant load, and seamless play inside Safari, Chrome, and sandboxed iframes.
  const convertBase64ToBlobUrl = (base64DataUri: string): string => {
    try {
      if (!base64DataUri) return "";
      if (base64DataUri.startsWith("blob:")) return base64DataUri;
      
      const parts = base64DataUri.split(";base64,");
      let mimeType = "audio/wav"; // Default fallback
      if (parts[0].startsWith("data:")) {
        const match = parts[0].match(/data:(.*?)$/);
        if (match && match[1]) mimeType = match[1];
      } else if (parts[0].includes(":")) {
        mimeType = parts[0].split(":")[1];
      }
      
      // Classify correctly to avoid browser demuxing crashes
      if (mimeType.includes("wav") || mimeType.includes("wave")) {
        mimeType = "audio/wav";
      } else if (mimeType.includes("mp3") || mimeType.includes("mpeg")) {
        mimeType = "audio/mpeg";
      }
      
      const base64Str = (parts[1] || parts[0]).replace(/\s/g, "");
      const raw = window.atob(base64Str);
      const rawLength = raw.length;
      const uInt8Array = new Uint8Array(rawLength);
      
      for (let i = 0; i < rawLength; ++i) {
        uInt8Array[i] = raw.charCodeAt(i);
      }
      
      const blob = new Blob([uInt8Array], { type: mimeType });
      return URL.createObjectURL(blob);
    } catch (e) {
      console.error("Fallo al decodificar base64 a object url, usando string de respaldo:", e);
      return base64DataUri;
    }
  };

  // Synchronization handlers for video and modified audio
  const handleAudioPlay = () => {
    if (syncVideoRef.current && syncAudioRef.current) {
      try {
        // Only alter currentTime if the element has initialized metadata (readyState >= 1)
        if (syncVideoRef.current.readyState >= 1) {
          syncVideoRef.current.currentTime = syncAudioRef.current.currentTime;
        }
        syncVideoRef.current.play().catch((err) => {
          console.warn("La reproducción del video sincronizado fue suspendida o bloqueada por políticas del navegador:", err);
        });
      } catch (e) {
        console.error("Error al sincronizar reproducción de video:", e);
      }
    }
  };

  const handleAudioPause = () => {
    if (syncVideoRef.current) {
      try {
        syncVideoRef.current.pause();
      } catch (e) {
        console.error("Error al pausar video sincronizado:", e);
      }
    }
  };

  const handleAudioTimeUpdate = () => {
    if (syncVideoRef.current && syncAudioRef.current) {
      try {
        if (syncVideoRef.current.readyState >= 1) {
          if (Math.abs(syncVideoRef.current.currentTime - syncAudioRef.current.currentTime) > 0.3) {
            syncVideoRef.current.currentTime = syncAudioRef.current.currentTime;
          }
        }
      } catch (e) {
        console.error("Error al actualizar posición temporal del video:", e);
      }
    }
  };

  const handleAudioSeeked = () => {
    if (syncVideoRef.current && syncAudioRef.current) {
      try {
        if (syncVideoRef.current.readyState >= 1) {
          syncVideoRef.current.currentTime = syncAudioRef.current.currentTime;
        }
      } catch (e) {
        console.error("Error al reubicar posición del video:", e);
      }
    }
  };

  const handleGenerateMergedVideo = async () => {
    if (!syncVideoRef.current || !syncAudioRef.current) {
      setErrorMessage("No se encontraron los reproductores para mezclar el video.");
      return;
    }

    setIsBlendingVideo(true);
    setBlendingProgress("Iniciando codificador y mezclando pistas...");

    try {
      const videoEl = syncVideoRef.current;
      const audioEl = syncAudioRef.current;

      // Ensure elements have loaded metadata
      if (videoEl.readyState < 1 || audioEl.readyState < 1) {
        setBlendingProgress("Esperando a que se carguen los archivos...");
        await new Promise((resolve) => setTimeout(resolve, 1500));
      }

      // Check captureStream support
      const captureStream = (videoEl as any).captureStream || (videoEl as any).mozCaptureStream;
      if (!captureStream) {
        throw new Error("Tu navegador actual no soporta la codificación de video en tiempo real.");
      }

      // We capture the video stream
      const videoStream = captureStream.call(videoEl);
      const videoTrack = videoStream.getVideoTracks()[0];
      if (!videoTrack) {
        throw new Error("No se detectó la pista de video.");
      }

      // For audio: we create an AudioContext node to capture the audio stream cleanly and loud
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const source = audioCtx.createMediaElementSource(audioEl);
      const dest = audioCtx.createMediaStreamDestination();
      source.connect(dest);
      source.connect(audioCtx.destination); // Play to local speakers too so the user hears it

      const audioTrack = dest.stream.getAudioTracks()[0];
      
      // Combine video track and converted audio track
      const combinedStream = new MediaStream();
      combinedStream.addTrack(videoTrack);
      if (audioTrack) {
        combinedStream.addTrack(audioTrack);
      }

      // Select supported recorder format
      let options = { mimeType: "video/webm;codecs=vp9,opus" };
      if (!MediaRecorder.isTypeSupported(options.mimeType)) {
        options = { mimeType: "video/webm;codecs=vp8,opus" };
      }
      if (!MediaRecorder.isTypeSupported(options.mimeType)) {
        options = { mimeType: "video/webm" };
      }
      if (!MediaRecorder.isTypeSupported(options.mimeType)) {
        options = { mimeType: "video/mp4" };
      }

      const recorder = new MediaRecorder(combinedStream, options);
      const chunks: Blob[] = [];

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          chunks.push(event.data);
        }
      };

      // When stopped, save the blob
      recorder.onstop = () => {
        const videoBlob = new Blob(chunks, { type: chunks[0]?.type || "video/mp4" });
        const downloadUrl = URL.createObjectURL(videoBlob);
        setMergedVideoUrl(downloadUrl);
        setIsBlendingVideo(false);
        setBlendingProgress("");
        
        // Auto trigger download of video!
        const a = document.createElement("a");
        a.href = downloadUrl;
        a.download = `video-voz-ai-${Date.now()}.${chunks[0]?.type.includes("mp4") ? "mp4" : "webm"}`;
        a.click();
      };

      // Prepare sync and play
      videoEl.currentTime = 0;
      audioEl.currentTime = 0;
      
      // Pause current playback to avoid race
      videoEl.pause();
      audioEl.pause();

      setBlendingProgress("Mezclando y grabando en tiempo real. Por favor espera...");

      // Start recording
      recorder.start();

      // Ensure audio is unmuted/muted correctly
      audioEl.muted = false;

      // Play both
      await Promise.all([
        videoEl.play(),
        audioEl.play()
      ]);

      // Simple interval to update progress
      const duration = videoEl.duration || audioEl.duration || 10;
      const progressInterval = setInterval(() => {
        const cur = audioEl.currentTime;
        const percent = Math.min(Math.floor((cur / duration) * 100), 99);
        setBlendingProgress(`Generando video con voz nueva: ${percent}%...`);
      }, 500);

      // Stopped handler
      const stopMerge = () => {
        clearInterval(progressInterval);
        try {
          if (recorder.state === "recording") {
            recorder.stop();
          }
        } catch (e) {}
        videoEl.pause();
        audioEl.pause();
        audioCtx.close();
      };

      videoEl.onended = stopMerge;
      audioEl.onended = stopMerge;

    } catch (err: any) {
      console.error(err);
      setIsBlendingVideo(false);
      setErrorMessage(`No se pudo realizar la mezcla: ${err.message || err}`);
    }
  };

  const selectedVoice = [...voices.prebuilt, ...voices.cloned].find(v => v.id === selectedVoiceId) || voices.prebuilt[0];

  // Quick helper to format timer
  const formatTime = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const secs = sec % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // 1. Microphone capture
  const startRecording = async () => {
    try {
      setErrorMessage(null);
      setSuccessMessage(null);
      setRecordedBlob(null);
      setUploadFile(null);
      setConvertedAudioUrl(null);
      setTranscribedText(null);
      
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      const chunks: BlobPart[] = [];
      
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: "audio/webm" });
        setRecordedBlob(blob);
        const objUrl = URL.createObjectURL(blob);
        setOriginalAudioUrl(objUrl);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
      setIsRecording(true);
      setRecordDuration(0);

      recordIntervalRef.current = setInterval(() => {
        setRecordDuration(prev => prev + 1);
      }, 1000);
    } catch (err: any) {
      console.error(err);
      setErrorMessage("No se pudo iniciar el micrófono. Otorga los permisos en tu navegador.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (recordIntervalRef.current) clearInterval(recordIntervalRef.current);
    }
  };

  // 2. File drop and change handling
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const file = files[0];
      setUploadFile(file);
      setRecordedBlob(null);
      setConvertedAudioUrl(null);
      setTranscribedText(null);
      
      const objUrl = URL.createObjectURL(file);
      setOriginalAudioUrl(objUrl);
      setErrorMessage(null);
    }
  };

  // Extract the audio track from file uploads (this automatically handles MP4/WebM videos perfectly!)
  const getAudioBlobToProcess = async (): Promise<Blob> => {
    const rawFile = recordedBlob || uploadFile;
    if (!rawFile) {
      throw new Error("No hay archivos subidos.");
    }

    // If it's a video file, we can convert it into an audio buffer directly in the browser!
    if (rawFile.type.startsWith("video/")) {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const fileArrayBuffer = await rawFile.arrayBuffer();
      
      try {
        // Decode audio track from video file
        const audioBuffer = await audioCtx.decodeAudioData(fileArrayBuffer);
        
        // Render it down to a WAV blob so the API or DSP can read it cleanly
        const renderedBlob = audioBufferToWavBlob(audioBuffer);
        await audioCtx.close();
        return renderedBlob;
      } catch (err) {
        console.error("Extraer audio de video falló, enviando de respaldo el archivo crudo:", err);
        await audioCtx.close();
        return rawFile;
      }
    }

    return rawFile;
  };

  // Utility to write AudioBuffer back to WAV Blob client side during video extract
  function audioBufferToWavBlob(buffer: AudioBuffer): Blob {
    const numOfChan = buffer.numberOfChannels;
    const length = buffer.length * numOfChan * 2 + 44;
    const bufferArr = new ArrayBuffer(length);
    const view = new DataView(bufferArr);
    const channels = [];
    let i, sample, offset = 0, pos = 0;

    // WAV format descriptors
    const setUint32 = (d: number) => { view.setUint32(pos, d, true); pos += 4; };
    const setUint16 = (d: number) => { view.setUint16(pos, d, true); pos += 2; };

    setUint32(0x46464952); // "RIFF"
    setUint32(length - 8);
    setUint32(0x45564157); // "WAVE"
    setUint32(0x20746d66); // "fmt "
    setUint32(16);
    setUint16(1); // PCM
    setUint16(numOfChan);
    setUint32(buffer.sampleRate);
    setUint32(buffer.sampleRate * 2 * numOfChan);
    setUint16(numOfChan * 2);
    setUint16(16); // 16-bit
    setUint32(0x61746164); // "data"
    setUint32(length - pos - 4);

    for (i = 0; i < numOfChan; i++) channels.push(buffer.getChannelData(i));

    while (pos < length) {
      for (i = 0; i < numOfChan; i++) {
        sample = Math.max(-1, Math.min(1, channels[i][offset]));
        sample = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
        view.setInt16(pos, sample, true);
        pos += 2;
      }
      offset++;
    }
    return new Blob([bufferArr], { type: "audio/wav" });
  }

  // 3. Process Execution
  const handleConvert = async () => {
    setErrorMessage(null);
    setSuccessMessage(null);
    setIsProcessing(true);

    try {
      // Direct Text-to-Speech (TTS) Mode
      if (inputMode === "text") {
        if (!ttsText.trim()) {
          throw new Error("Por favor, escribe un texto para sintetizar.");
        }

        const payload = {
          text: ttsText.trim(),
          targetVoiceId: selectedVoice.id,
          translationLanguage,
          emotionModifier,
          voiceSpeed,
        };

        const res = await fetch("/api/voice-convert", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.details ? `${data.error} (${data.details})` : (data.error || "Error al procesar la síntesis de voz."));
        }

        setTranscribedText(ttsText.trim()); // The "transcription" is what was spoken
        const decodedUrl = convertBase64ToBlobUrl(data.audioData);
        setConvertedAudioUrl(decodedUrl);
        setConvertedBase64(data.audioData);

        // Log in History
        const hist: ConversionHistoryItem = {
          id: `convert-${Date.now()}`,
          date: new Date().toLocaleTimeString(),
          originalFileName: `Texto escrito: "${ttsText.trim().substring(0, 20)}..."`,
          originalType: "audio",
          targetVoiceId: selectedVoice.id,
          targetVoiceName: selectedVoice.name,
          transcription: ttsText.trim(),
          audioData: data.audioData,
        };
        onAddHistoryItem(hist);

        setSuccessMessage(`¡Texto sintetizado con éxito utilizando la voz de: ${selectedVoice.name}!`);
        setIsProcessing(false);
        return;
      }

      // Voice conversion mode (mic or uploaded file)
      const audioToProcess = await getAudioBlobToProcess();

      // CASE A: Client-side DSP Filter Effects
      if (strategy === "dsp") {
        const targetBlob = await applyAudioDsp(audioToProcess, dspSettings, dspMode);
        const objUrl = URL.createObjectURL(targetBlob);
        setConvertedAudioUrl(objUrl);

        // Convert blob to base64 for history downloading
        const reader = new FileReader();
        reader.readAsDataURL(targetBlob);
        reader.onloadend = () => {
          const b64 = reader.result as string;
          setConvertedBase64(b64);

          // Add to log
          const hist: ConversionHistoryItem = {
            id: `convert-${Date.now()}`,
            date: new Date().toLocaleTimeString(),
            originalFileName: uploadFile ? uploadFile.name : "Voz Grabada Mic",
            originalType: uploadFile && uploadFile.type.startsWith("video") ? "video" : "audio",
            targetVoiceId: "DSP-Effect",
            targetVoiceName: `Filtro DSP (${dspMode})`,
            transcription: "Filtro analógico local (sin transcripción de IA)",
            audioData: b64,
          };
          onAddHistoryItem(hist);
        };

        setSuccessMessage("¡Filtro acústico DSP aplicado con éxito de forma local!");
        setIsProcessing(false);
        return;
      }

      // CASE B: AI Gemini Clone vocal re-synthesis
      // Convert to Base64 first for the API
      const reader = new FileReader();
      reader.readAsDataURL(audioToProcess);
      reader.onloadend = async () => {
        const base64Audio = reader.result as string;
        try {
          const payload = {
            audioData: base64Audio,
            mimeType: audioToProcess.type || "audio/wav",
            targetVoiceId: selectedVoice.id,
            translationLanguage,
            emotionModifier,
            voiceSpeed,
          };

          const res = await fetch("/api/voice-convert", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });

          const data = await res.json();
          if (!res.ok) {
            throw new Error(data.details ? `${data.error} (${data.details})` : (data.error || "Error al procesar re-síntesis AI"));
          }

          setTranscribedText(data.transcription);
          const decodedUrl = convertBase64ToBlobUrl(data.audioData);
          setConvertedAudioUrl(decodedUrl);
          setConvertedBase64(data.audioData);

          // Log in History
          const hist: ConversionHistoryItem = {
            id: `convert-${Date.now()}`,
            date: new Date().toLocaleTimeString(),
            originalFileName: uploadFile ? uploadFile.name : "Voz Grabada Mic",
            originalType: uploadFile && uploadFile.type.startsWith("video") ? "video" : "audio",
            targetVoiceId: selectedVoice.id,
            targetVoiceName: selectedVoice.name,
            transcription: data.transcription,
            audioData: data.audioData,
          };
          onAddHistoryItem(hist);
          
          setSuccessMessage(`¡Voz cambiada con la firma vocal aproximada de: ${selectedVoice.name}!`);
        } catch (err: any) {
          console.error(err);
          setErrorMessage(err.message || "Fallo inesperado al conectar con el servidor.");
        } finally {
          setIsProcessing(false);
        }
      };

    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || "Ocurrió un error al preparar el archivo.");
      setIsProcessing(false);
    }
  };

  const resetInputs = () => {
    setUploadFile(null);
    setRecordedBlob(null);
    setOriginalAudioUrl(null);
    setConvertedAudioUrl(null);
    setConvertedBase64(null);
    setTranscribedText(null);
    setSuccessMessage(null);
    setErrorMessage(null);
    setTtsText("");
    setMergedVideoUrl(null);
  };

  return (
    <div className="bg-[#0c0c0c] rounded-3xl border border-white/10 p-6 md:p-8 shadow-xs">
      {/* Blend/Mixing Overlay Modal */}
      {isBlendingVideo && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex flex-col justify-center items-center gap-6 p-6">
          <div className="relative w-20 h-20">
            <div className="absolute inset-0 rounded-full border-4 border-emerald-500/10"></div>
            <div className="absolute inset-0 rounded-full border-4 border-emerald-500 border-t-transparent animate-spin"></div>
          </div>
          <div className="text-center space-y-2 max-w-md">
            <h3 className="font-display font-black text-xl text-white uppercase italic tracking-tight">Mezclando Pista de Video y Voz AI</h3>
            <p className="font-sans text-xs text-white/60 leading-normal">
              {blendingProgress}
            </p>
            <p className="font-mono text-[9px] uppercase tracking-widest text-[#f0f0f0]/30 pt-4">Descarga automática al finalizar • No cierres esta pestaña</p>
          </div>
        </div>
      )}

      <div className="space-y-6">
        <div>
          <h3 className="font-display font-black text-xl text-white uppercase italic tracking-tight flex items-center gap-2">
            <Volume2 className="w-5 h-5 text-white/80" />
            SYNTH & CAMBIO DE VOZ
          </h3>
          <p className="font-sans text-xs text-white/55 mt-1 leading-relaxed">
            Escribe tu texto para hablarlo en el clon elegido (TTS), graba tu voz en directo o sube archivos de video y audio.
          </p>
        </div>

        {/* Selected Target Voice Header */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/5 text-white flex items-center justify-center font-bold text-lg border border-white/10 animate-pulse-slow">
              {selectedVoice.gender === "femenino" ? "♀" : "♂"}
            </div>
            <div>
              <p className="font-mono text-[9px] uppercase font-bold text-white/40 tracking-widest">Perfil Activo</p>
              <h4 className="font-sans font-bold text-white text-sm uppercase tracking-tight">{selectedVoice.name}</h4>
            </div>
          </div>
          <span className="font-mono text-[10px] bg-white text-black font-bold uppercase px-3 py-1.5 rounded-sm tracking-wider">
            {selectedVoice.type === "cloned" ? "Clonada AI" : "Estándar"}
          </span>
        </div>

        {/* Input Strategy Selector Tabs (Only show if not processed yet) */}
        {!originalAudioUrl && !convertedAudioUrl && (
          <div className="bg-white/5 border border-white/10 p-1.5 rounded-2xl flex flex-col sm:flex-row gap-1.5 max-w-xl">
            <button
              type="button"
              onClick={() => { setInputMode("text"); resetInputs(); }}
              className={`flex-1 font-sans font-black text-xs py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer ${
                inputMode === "text"
                  ? "bg-white text-black shadow-md font-black"
                  : "text-white/60 hover:text-white"
              }`}
            >
              <Sparkles className="w-4 h-4 shrink-0" />
              SÍNTESIS DE TEXTO (TTS)
            </button>
            <button
              type="button"
              onClick={() => { setInputMode("record"); resetInputs(); }}
              className={`flex-1 font-sans font-black text-xs py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer ${
                inputMode === "record"
                  ? "bg-white text-black shadow-md font-black"
                  : "text-white/60 hover:text-white"
              }`}
            >
              <Mic className="w-4 h-4 shrink-0" />
              GRABAR VOZ
            </button>
            <button
              type="button"
              onClick={() => { setInputMode("upload"); resetInputs(); }}
              className={`flex-1 font-sans font-black text-xs py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer ${
                inputMode === "upload"
                  ? "bg-white text-black shadow-md font-black"
                  : "text-white/60 hover:text-white"
              }`}
            >
              <Upload className="w-4 h-4 shrink-0" />
              SUBIR VIDEO/AUDIO
            </button>
          </div>
        )}

        {/* Dynamic input area based on active type */}
        {!originalAudioUrl && !convertedAudioUrl ? (
          <div>
            {/* Mode 1: Text-to-Speech (TTS) */}
            {inputMode === "text" && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="font-mono text-[9px] uppercase tracking-widest block font-bold text-white/55">
                    ¿Qué quieres que diga {selectedVoice.name}?
                  </label>
                  <textarea
                    rows={4}
                    value={ttsText}
                    onChange={(e) => setTtsText(e.target.value)}
                    placeholder={`Escribe el texto aquí en cualquier idioma... Ej. "Hola, esta es mi nueva firma de voz sintetizada con inteligencia artificial tokenizer-free."`}
                    className="w-full font-sans text-xs border border-white/10 focus:border-white focus:outline-none focus:ring-1 focus:ring-white rounded-xl px-4 py-3 bg-white/5 text-white placeholder:text-white/30 transition-all leading-relaxed"
                  />
                </div>
                <div className="text-[10px] text-white/40 font-sans flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  Sintetizador directo de ultra baja latencia conectado.
                </div>
              </div>
            )}

            {/* Mode 2: Mic Microphone Recording */}
            {inputMode === "record" && (
              <div className="border border-dashed border-white/15 rounded-2xl p-8 bg-white/[0.02] hover:bg-white/[0.04] transition-colors text-center flex flex-col justify-center items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center border border-red-500/30 animate-pulse-slow">
                  <Mic className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <h4 className="font-sans font-bold text-white text-sm uppercase tracking-tight">Grabar Voz en Vivo</h4>
                  <p className="font-sans text-xs text-white/45 max-w-xs leading-normal">Captura directamente desde tu navegador.</p>
                </div>
                
                {isRecording ? (
                  <button
                    type="button"
                    id="stop-audio-recording"
                    onClick={stopRecording}
                    className="bg-red-650 hover:bg-red-700 text-white font-mono font-bold text-xs py-2.5 px-6 rounded-xl flex items-center gap-2 transition-all shadow-md uppercase tracking-wider animate-bounce cursor-pointer"
                  >
                    <span className="w-2.5 h-2.5 bg-white rounded-full animate-ping"></span>
                    Detener ({formatTime(recordDuration)})
                  </button>
                ) : (
                  <button
                    type="button"
                    id="start-audio-recording"
                    onClick={startRecording}
                    className="bg-white hover:bg-zinc-200 text-black font-mono font-bold text-xs py-2.5 px-6 rounded-xl flex items-center gap-2 transition-colors uppercase tracking-wider cursor-pointer"
                  >
                    <Mic className="w-4 h-4" />
                    Iniciar Grabación
                  </button>
                )}
              </div>
            )}

            {/* Mode 3: File Upload Box */}
            {inputMode === "upload" && (
              <div className="border border-dashed border-white/15 rounded-2xl p-8 bg-white/[0.02] hover:bg-white/[0.04] transition-colors text-center flex flex-col justify-center items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-white/5 text-white/80 flex items-center justify-center border border-white/10">
                  <Upload className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <h4 className="font-sans font-bold text-white text-sm uppercase tracking-tight">Subir Multimedia</h4>
                  <p className="font-sans text-xs text-white/45 max-w-sm leading-normal font-light">
                    Soporta pistas de audios (MP3, WAV, M4A) y archivos de videos enteros (MP4, WebM). Los videos de gran tamaño se pueden procesar totalmente GRATIS y sin límites de tokens si utilizas la tecnología de efectos locales en la pestaña &quot;Efectos DSP (Filtros)&quot;.
                  </p>
                </div>

                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept="audio/*,video/*"
                  className="hidden"
                />
                
                <div className="flex flex-col items-center gap-3 w-full">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="bg-white/15 hover:bg-white/20 text-white border border-white/10 font-mono font-bold text-xs py-2.5 px-6 rounded-xl flex items-center gap-2 transition-colors uppercase tracking-wider cursor-pointer"
                  >
                    <Upload className="w-4 h-4" />
                    Examinar Archivo
                  </button>

                  <div className="mt-1 flex flex-col sm:flex-row items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl p-3 max-w-sm">
                    <span className="text-sm">🇲🇦</span>
                    <div className="text-left">
                      <p className="text-[10px] font-bold uppercase tracking-wider font-mono">100% Gratis para Videos Grandes</p>
                      <p className="text-[10px] text-white/70 leading-snug font-sans">
                        La pestaña <strong className="text-emerald-300 font-bold">Efectos DSP (Filtros)</strong> procesa localmente en tu navegador. ¡Evita límites de tamaño y no consume tokens!
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* File Uploaded Preview Card */
          <div className="border border-white/10 rounded-2xl p-4 flex items-center justify-between gap-4 bg-white/5">
            <div className="flex items-center gap-3 overflow-hidden">
              <div className="w-10 h-10 rounded-xl bg-white text-black flex items-center justify-center shrink-0 border border-white/20">
                {uploadFile && uploadFile.type.startsWith("video") ? (
                  <Video className="w-5 h-5" />
                ) : (
                  <Music className="w-5 h-5" />
                )}
              </div>
              <div className="overflow-hidden p-0.5">
                <h5 className="font-sans font-bold text-xs text-white truncate block uppercase tracking-tight">
                  {uploadFile ? uploadFile.name : `Texto de Síntesis en "${selectedVoice.name}"`}
                </h5>
                <p className="font-mono text-[9px] text-[#f0f0f0]/50 tracking-wider">
                  {uploadFile ? `${(uploadFile.size / (1024 * 1024)).toFixed(2)} MB` : "Síntesis Escrita (Directa)"}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={resetInputs}
              disabled={isProcessing}
              className="font-mono text-[10px] text-red-400 hover:text-red-300 font-bold px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg transition-colors shrink-0 disabled:opacity-50 uppercase tracking-widest cursor-pointer"
            >
              Cambiar Entrada
            </button>
          </div>
        )}

        {/* Customization Options Bar */}
        {(originalAudioUrl || inputMode === "text") && (
          <div className="border border-white/10 rounded-2xl overflow-hidden shadow-xs bg-white/5">
            
            {/* Headers Tab */}
            <div className="bg-white/5 border-b border-white/10 p-4 flex flex-col sm:flex-row gap-4 items-center justify-between">
              <div className="flex items-center gap-2">
                <Settings className="w-4 h-4 text-white/50 animate-spin-slow" />
                <span className="font-sans font-bold text-xs text-white uppercase tracking-wider">Ajustes de Conversión & Actuación</span>
              </div>

              {/* Strategy Selector Toggle */}
              <div className="bg-white/10 p-1 rounded-sm flex items-center gap-1 border border-white/5">
                <button
                  type="button"
                  onClick={() => setStrategy("ai")}
                  className={`font-mono font-bold text-[10px] uppercase px-3 py-1.5 rounded-xs flex items-center gap-1 transition-all cursor-pointer ${
                    strategy === "ai" 
                      ? "bg-white text-black font-black" 
                      : "text-white/60 hover:text-white"
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Clonación IA (Ultra)
                </button>
                <button
                  type="button"
                  onClick={() => setStrategy("dsp")}
                  className={`font-mono font-bold text-[10px] uppercase px-3 py-1.5 rounded-xs flex items-center gap-1 transition-all cursor-pointer ${
                    strategy === "dsp" 
                      ? "bg-white text-black font-black" 
                      : "text-white/60 hover:text-white"
                  }`}
                >
                  <Sliders className="w-3.5 h-3.5" />
                  Efectos DSP (Filtros)
                </button>
              </div>
            </div>

            {/* Customizer Panels content */}
            <div className="p-4 md:p-6 bg-[#0c0c0c] space-y-6">
              
              {/* CASE A: AI Strategy Parameters */}
              {strategy === "ai" && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {/* Option 1: Translation Language */}
                  <div className="space-y-1.5">
                    <label className="font-mono text-[9px] text-white/55 uppercase tracking-widest block font-bold">Traducir Voz</label>
                    <select
                      value={translationLanguage}
                      onChange={(e) => setTranslationLanguage(e.target.value)}
                      className="w-full font-sans text-xs border border-white/10 rounded-xl px-3 py-2.5 bg-white/5 text-white focus:outline-none focus:border-white"
                    >
                      <option value="same" className="bg-[#0c0c0c] text-white">Mantener Idioma Original</option>
                      <option value="en" className="bg-[#0c0c0c] text-white">Inglés (English US)</option>
                      <option value="es" className="bg-[#0c0c0c] text-white">Español Neutro</option>
                      <option value="fr" className="bg-[#0c0c0c] text-white">Francés (Français)</option>
                      <option value="pt" className="bg-[#0c0c0c] text-white">Portugués (Português)</option>
                      <option value="it" className="bg-[#0c0c0c] text-white">Italiano (Italiano)</option>
                      <option value="de" className="bg-[#0c0c0c] text-white">Alemán (Deutsch)</option>
                    </select>
                  </div>

                  {/* Option 2: Performance Emotion */}
                  <div className="space-y-1.5">
                    <label className="font-mono text-[9px] text-white/55 uppercase tracking-widest block font-bold">Emoción & Tono</label>
                    <select
                      value={emotionModifier}
                      onChange={(e) => setEmotionModifier(e.target.value)}
                      className="w-full font-sans text-xs border border-white/10 rounded-xl px-3 py-2.5 bg-white/5 text-white focus:outline-none focus:border-white"
                    >
                      <option value="natural" className="bg-[#0c0c0c] text-white">Natural (Tono del audio original)</option>
                      <option value="cheerful" className="bg-[#0c0c0c] text-white">Alegre y Sonriente</option>
                      <option value="whisper" className="bg-[#0c0c0c] text-white">Susurrado e Íntimo</option>
                      <option value="excited" className="bg-[#0c0c0c] text-white">Entusiasmado y Épico</option>
                      <option value="deep" className="bg-[#0c0c0c] text-white">Formal, Sobrio y Profundo</option>
                      <option value="soft" className="bg-[#0c0c0c] text-white">Cálido y Suave</option>
                    </select>
                  </div>

                  {/* Option 3: Speed Rate */}
                  <div className="space-y-1.5">
                    <label className="font-mono text-[9px] text-white/55 uppercase tracking-widest block font-bold">Ritmo de Habla</label>
                    <select
                      value={voiceSpeed}
                      onChange={(e) => setVoiceSpeed(e.target.value)}
                      className="w-full font-sans text-xs border border-white/10 rounded-xl px-3 py-2.5 bg-white/5 text-white focus:outline-none focus:border-white"
                    >
                      <option value="normal" className="bg-[#0c0c0c] text-white">Velocidad Normal (1.0x)</option>
                      <option value="slow" className="bg-[#0c0c0c] text-white">Pausado y Lento (0.8x)</option>
                      <option value="fast" className="bg-[#0c0c0c] text-white">Rápido y Fluido (1.25x)</option>
                    </select>
                  </div>
                </div>
              )}

              {/* CASE B: DSP Strategy Parameters */}
              {strategy === "dsp" && (
                <div className="space-y-6">
                  {/* Free tokenless banner */}
                  <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3.5 flex items-start gap-3">
                    <span className="text-xl">🇲🇦</span>
                    <div className="space-y-1">
                      <p className="text-xs font-bold text-emerald-400 font-sans">Efecto Maroquí Cálido local (100% Gratis - Sin Toques ni Tokens de IA)</p>
                      <p className="text-[11px] text-white/70 leading-relaxed font-sans">
                        Este modo procesa el audio directamente en tu navegador usando la Web Audio API. 
                        No realiza llamadas al servidor de Gemini ni consume tokens de tu API Key. ¡Conversiones totalmente ilimitadas y gratuitas!
                      </p>
                    </div>
                  </div>

                  {/* Preset Selection Box */}
                  <div className="grid grid-cols-2 sm:grid-cols-6 gap-2">
                    {[
                      { id: "normal", name: "Original / Custom" },
                      { id: "robot", name: "Robótico Metal" },
                      { id: "megaphone", name: "Megáfono AM" },
                      { id: "cave", name: "Caverna Eco" },
                      { id: "moroccan", name: "Maroquí Cálido 🇲🇦" },
                      { id: "custom", name: "Controles Manuales" },
                    ].map((mode) => (
                      <button
                        type="button"
                        key={mode.id}
                        onClick={() => {
                          setDspMode(mode.id as any);
                          // Populate default sliders if necessary
                          if (mode.id === "robot") {
                            setDspSettings(prev => ({ ...prev, pitch: 0, reverb: 10, distortion: 70, speed: 1.0, echo: 0 }));
                          } else if (mode.id === "megaphone") {
                            setDspSettings(prev => ({ ...prev, pitch: 0, reverb: 0, distortion: 30, speed: 1.0, echo: 0 }));
                          } else if (mode.id === "cave") {
                            setDspSettings(prev => ({ ...prev, pitch: -3, reverb: 70, distortion: 0, speed: 0.9, echo: 50 }));
                          } else if (mode.id === "moroccan") {
                            setDspSettings(prev => ({ ...prev, pitch: -1, reverb: 15, distortion: 0, speed: 1.02, echo: 10, eqLow: 4, eqMid: 2, eqHigh: -1 }));
                          } else if (mode.id === "normal") {
                            setDspSettings(prev => ({ ...prev, pitch: 0, reverb: 0, distortion: 0, speed: 1.0, echo: 0 }));
                          } else {
                            setDspMode("custom");
                          }
                        }}
                        className={`font-mono text-[10px] uppercase font-bold py-2.5 px-3 rounded-xs border transition-all cursor-pointer ${
                          dspMode === mode.id
                            ? "bg-white text-black border-white font-black"
                            : "bg-white/5 text-[#f0f0f0] border-white/10 hover:bg-white/10 hover:text-white"
                        }`}
                      >
                        {mode.name}
                      </button>
                    ))}
                  </div>

                  {/* Manual Equalizer Sliders for Custom DSP Mode */}
                  {(dspMode === "custom" || dspMode === "normal") && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-2">
                      <div className="space-y-2">
                        <div className="flex justify-between text-xs font-bold text-white/70">
                          <span className="font-sans">Tono (Semitonos)</span>
                          <span className="font-mono text-white">{dspSettings.pitch > 0 ? `+${dspSettings.pitch}` : dspSettings.pitch} st</span>
                        </div>
                        <input
                          type="range"
                          min="-12"
                          max="12"
                          step="1"
                          value={dspSettings.pitch}
                          onChange={(e) => setDspSettings({ ...dspSettings, pitch: parseInt(e.target.value) })}
                          className="w-full accent-white h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer"
                        />
                        <div className="flex justify-between text-[10px] text-white/40 font-mono font-bold uppercase">
                          <span>Chano</span>
                          <span>Medio</span>
                          <span>Ardil</span>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex justify-between text-xs font-bold text-white/70">
                          <span className="font-sans">Reverberación Eco</span>
                          <span className="font-mono text-white">{dspSettings.reverb}%</span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={dspSettings.reverb}
                          onChange={(e) => setDspSettings({ ...dspSettings, reverb: parseInt(e.target.value) })}
                          className="w-full accent-white h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer"
                        />
                        <div className="flex justify-between text-[10px] text-white/40 font-mono font-bold uppercase">
                          <span>Seco</span>
                          <span>Fabulos</span>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex justify-between text-xs font-bold text-white/70">
                          <span className="font-sans">Velocidad</span>
                          <span className="font-mono text-white">{dspSettings.speed}x</span>
                        </div>
                        <input
                          type="range"
                          min="0.5"
                          max="2.0"
                          step="0.1"
                          value={dspSettings.speed}
                          onChange={(e) => setDspSettings({ ...dspSettings, speed: parseFloat(e.target.value) })}
                          className="w-full accent-white h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer"
                        />
                        <div className="flex justify-between text-[10px] text-white/40 font-mono font-bold uppercase">
                          <span>Lento</span>
                          <span>Normal</span>
                          <span>Rápido</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

            </div>
          </div>
        )}

        {/* Feedback Alert Boxes */}
        {errorMessage && (
          <div className="p-4 rounded-2xl border border-red-500/30 bg-red-500/10 flex items-start gap-3 text-red-300">
            <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <div>
              <h5 className="font-sans font-bold text-xs uppercase tracking-tight">Error de Operación</h5>
              <p className="font-sans text-xs leading-normal mt-1">{errorMessage}</p>
            </div>
          </div>
        )}

        {successMessage && (
          <div className="p-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 flex items-start gap-3 text-emerald-300">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <h5 className="font-sans font-bold text-xs uppercase tracking-tight">¡Éxito!</h5>
              <p className="font-sans text-xs leading-normal mt-1">{successMessage}</p>
            </div>
          </div>
        )}

        {/* Action Trigger Button */}
        {(originalAudioUrl || inputMode === "text") && !isProcessing && (
          <button
            type="button"
            id="trigger-voice-convert-btn"
            onClick={handleConvert}
            className="w-full h-14 bg-white hover:bg-zinc-200 text-black font-mono font-black text-xs uppercase rounded-2xl shadow-md transition-all hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center gap-2 cursor-pointer tracking-wider"
          >
            <Sparkles className="w-4 h-4 text-black" />
            {strategy === "ai" 
              ? `Aplicar Voz AI de "${selectedVoice.name}"` 
              : "Procesar Filtro Acústico DSP Local"}
          </button>
        )}

        {isProcessing && (
          <div className="p-8 border border-white/10 bg-white/[0.02] rounded-2xl text-center space-y-4">
            <div className="relative w-16 h-16 mx-auto">
              <div className="absolute inset-0 rounded-full border-4 border-white/5"></div>
              <div className="absolute inset-0 rounded-full border-4 border-white border-t-transparent animate-spin"></div>
            </div>
            <div className="space-y-1">
              <h4 className="font-mono text-xs font-bold text-white uppercase tracking-wider">
                {strategy === "ai" 
                  ? "Transcribiendo y Re-modelando audio con Gemini..." 
                  : "Renderizando filtros de alta fidelidad vía Web Audio..."}
              </h4>
              <p className="font-sans text-xs text-white/50 max-w-md mx-auto leading-normal">
                {strategy === "ai" 
                  ? "Gemini está procesando la transcripción acústica del audio y generando una síntesis fónica limpia en el objetivo elegido." 
                  : "La modulación sónica de fase y ganancia se está calculando en offline en tu navegador."}
              </p>
            </div>
          </div>
        )}

        {/* Results Screen Segment */}
        {convertedAudioUrl && !isProcessing && (
          <div className="bg-white/[0.02] border border-white/10 rounded-3xl p-6 md:p-8 space-y-6">
            <h4 className="font-display font-black text-lg text-white flex items-center gap-2 border-b border-white/10 pb-4 uppercase italic">
              <Volume2 className="w-5 h-5 text-emerald-400" />
              Resultado de la Reprogramación Sónica
            </h4>

            {/* Players side-by-side comparative layout */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {/* Box 1: Pre conversion sample */}
              <div className="space-y-2 bg-white/5 border border-white/5 p-4 rounded-xl flex flex-col justify-between">
                <span className="font-mono text-[9px] tracking-widest uppercase font-bold text-white/50 block mb-1">
                  Pista de Entrada Original {uploadFile && uploadFile.type.startsWith("video/") && "(Video)"}
                </span>
                {uploadFile && uploadFile.type.startsWith("video/") ? (
                  <video 
                    id="original-video-player"
                    src={originalAudioUrl!}
                    controls
                    playsInline
                    preload="auto"
                    className="w-full max-h-56 rounded-lg bg-black object-contain border border-white/10"
                  />
                ) : (
                  <audio 
                    id="original-audio-player"
                    src={originalAudioUrl || ""} 
                    controls 
                    className="w-full accent-white mt-auto"
                  />
                )}
              </div>

              {/* Box 2: Post conversion template results */}
              <div className="space-y-2 bg-white/10 border border-white/10 p-4 rounded-xl flex flex-col justify-between">
                <span className="font-mono text-[9px] tracking-widest uppercase font-bold text-emerald-400 flex items-center gap-1 block mb-1">
                  Pista Modificada ({strategy === "ai" ? "Gemini AI" : "DSP Local"}) {uploadFile && uploadFile.type.startsWith("video/") && "(Voz Cambiada)"}
                </span>
                {uploadFile && uploadFile.type.startsWith("video/") ? (
                  <div className="space-y-2">
                    <video 
                      ref={syncVideoRef}
                      id="converted-video-sync-player"
                      src={originalAudioUrl!}
                      muted
                      playsInline
                      preload="auto"
                      className="w-full max-h-48 rounded-lg bg-black object-contain border border-emerald-500/20"
                      title="Video sincronizado con el sonido nuevo"
                    />
                    <div className="text-[10px] text-white/45 font-mono text-center">
                      🔊 Usa el reproductor de audio para controlar el video con la voz nueva en perfecta sincronía.
                    </div>
                  </div>
                ) : null}
                <audio 
                  ref={syncAudioRef}
                  id="converted-audio-player"
                  src={convertedAudioUrl} 
                  controls 
                  autoPlay
                  onPlay={handleAudioPlay}
                  onPause={handleAudioPause}
                  onTimeUpdate={handleAudioTimeUpdate}
                  onSeeked={handleAudioSeeked}
                  onError={(e) => {
                    const err = (e.target as HTMLAudioElement).error;
                    console.error("HTMLAudioElement player error:", err);
                    if (err) {
                      let desc = `Error ${err.code}`;
                      if (err.code === 1) desc = "Carga abortada por el usuario o navegador.";
                      if (err.code === 2) desc = "Error de red al descargar el archivo de audio.";
                      if (err.code === 3) desc = "Error de decodificación. El formato del audio o los codecs no son soportados por tu navegador.";
                      if (err.code === 4) desc = "El recurso de audio no es soportado o no se encuentra disponible.";
                      setErrorMessage(`Error de reproducción del clon de voz: ${desc} (Detalles: ${err.message || "Ninguno"})`);
                    }
                  }}
                  className="w-full accent-emerald-400 mt-auto"
                />
              </div>
            </div>

            {/* AI Generated Text Transcription Card (Only for AI Strategy) */}
            {strategy === "ai" && transcribedText && (
              <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-2">
                <h5 className="font-mono text-[9px] font-bold uppercase tracking-widest text-[#f0f0f0]/50">Transcripción y Traducción de IA</h5>
                <p className="font-sans text-xs text-white/80 leading-relaxed italic bg-black/30 p-4 rounded-xl border border-white/5">
                  &quot;{transcribedText}&quot;
                </p>
              </div>
            )}

            {/* Actions Panel */}
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <a
                id="download-converted-audio-btn"
                href={convertedAudioUrl}
                download={uploadFile ? `clon-${uploadFile.name.split(".")[0]}.wav` : "clon-voz-ai.wav"}
                className="flex-1 bg-white hover:bg-zinc-200 text-black font-mono font-black text-xs uppercase h-12 rounded-xl flex items-center justify-center gap-2 transition-colors cursor-pointer text-center"
              >
                <Download className="w-4 h-4 text-black shrink-0" />
                Descargar Audio Clonado
              </a>

              {uploadFile && uploadFile.type.startsWith("video/") && (
                <button
                  type="button"
                  onClick={handleGenerateMergedVideo}
                  className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-black font-mono font-black text-xs uppercase h-12 rounded-xl flex items-center justify-center gap-2 transition-colors cursor-pointer text-center"
                >
                  <Video className="w-4 h-4 text-black shrink-0" />
                  Mezclar y Descargar Video
                </button>
              )}
              
              <button
                type="button"
                id="reset-cloner-btn"
                onClick={resetInputs}
                className="bg-white/10 hover:bg-white/15 text-white border border-white/10 font-mono font-bold text-xs h-12 px-6 rounded-xl transition-colors uppercase tracking-[0.1em] cursor-pointer shrink-0"
              >
                Procesar Otro
              </button>
            </div>
            
          </div>
        )}

      </div>
    </div>
  );
}
