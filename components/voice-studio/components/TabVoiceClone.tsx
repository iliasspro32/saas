import React from "react";
import { Mic, Upload, CheckCircle2, AlertCircle, Sparkles, StopCircle, ArrowRight, Play, Loader2 } from "lucide-react";
import { VoiceProfile } from "../types";

interface TabVoiceCloneProps {
  onVoiceCloned: (newVoice: VoiceProfile) => void;
}

export default function TabVoiceClone({ onVoiceCloned }: TabVoiceCloneProps) {
  const [voiceName, setVoiceName] = React.useState<string>("");
  const [uploadFile, setUploadFile] = React.useState<File | null>(null);
  const [isRecording, setIsRecording] = React.useState<boolean>(false);
  const [recordedBlob, setRecordedBlob] = React.useState<Blob | null>(null);
  const [recordDuration, setRecordDuration] = React.useState<number>(0);
  const [statusMessage, setStatusMessage] = React.useState<{ text: string; isError: boolean } | null>(null);
  const [cloningStatus, setCloningStatus] = React.useState<"idle" | "uploading" | "cloned">("idle");
  const [clonedProfile, setClonedProfile] = React.useState<VoiceProfile | null>(null);

  const mediaRecorderRef = React.useRef<MediaRecorder | null>(null);
  const recordIntervalRef = React.useRef<NodeJS.Timeout | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const [audioPreviewUrl, setAudioPreviewUrl] = React.useState<string | null>(null);
  const previewAudioRef = React.useRef<HTMLAudioElement | null>(null);
  const [isPlayingPreview, setIsPlayingPreview] = React.useState<boolean>(false);

  // Core microphone recording logic
  const startRecording = async () => {
    try {
      setStatusMessage(null);
      setRecordedBlob(null);
      setUploadFile(null);
      if (audioPreviewUrl) {
        URL.revokeObjectURL(audioPreviewUrl);
        setAudioPreviewUrl(null);
      }

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
        setAudioPreviewUrl(objUrl);
        
        // Stop all mic tracks
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
      setIsRecording(true);
      setRecordDuration(0);

      recordIntervalRef.current = setInterval(() => {
        setRecordDuration((prev) => prev + 1);
      }, 1000);
    } catch (err: any) {
      console.error(err);
      setStatusMessage({
        text: "Por favor, autoriza el acceso al micrófono en el navegador para grabar tu voz.",
        isError: true,
      });
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (recordIntervalRef.current) {
        clearInterval(recordIntervalRef.current);
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const file = files[0];
      if (file.size > 15 * 1024 * 1024) {
        setStatusMessage({
          text: "El archivo de voz supera el límite recomendado de 15MB para clonación.",
          isError: true,
        });
        return;
      }
      setUploadFile(file);
      setRecordedBlob(null);
      
      const objUrl = URL.createObjectURL(file);
      setAudioPreviewUrl(objUrl);
      setStatusMessage(null);
    }
  };

  // Convert File/Blob to Base64 formatted string
  const fileToBase64 = (fileOrBlob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        resolve(result);
      };
      reader.onerror = (err) => reject(err);
      reader.readAsDataURL(fileOrBlob);
    });
  };

  // Submit to Voice Cloning Endpoint
  const handleCloneSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!voiceName.trim()) {
      setStatusMessage({ text: "Introduce un nombre descriptivo para tu voz.", isError: true });
      return;
    }
    if (!recordedBlob && !uploadFile) {
      setStatusMessage({ text: "Por favor, graba un audio de voz o sube un archivo.", isError: true });
      return;
    }

    setCloningStatus("uploading");
    setStatusMessage(null);

    try {
      const sampleToProcess = recordedBlob || uploadFile!;
      const base64Audio = await fileToBase64(sampleToProcess);
      const mimeType = uploadFile ? uploadFile.type : "audio/webm";

      const res = await fetch("/api/voice-clone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          audioData: base64Audio,
          mimeType: mimeType,
          voiceName: voiceName.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Fallo desconocido en la clonación.");
      }

      setClonedProfile(data.profile);
      onVoiceCloned(data.profile);
      setCloningStatus("cloned");
      setStatusMessage({
        text: `¡Firma de voz "${voiceName}" guardada con éxito en tu biblioteca!`,
        isError: false,
      });
    } catch (err: any) {
      console.error(err);
      setCloningStatus("idle");
      setStatusMessage({
        text: err.message || "Error al comunicarse con la IA de síntesis.",
        isError: true,
      });
    }
  };

  // Preview Controller
  const togglePlayPreview = () => {
    if (!audioPreviewUrl) return;
    
    if (isPlayingPreview) {
      if (previewAudioRef.current) {
        previewAudioRef.current.pause();
      }
      setIsPlayingPreview(false);
    } else {
      const audio = new Audio(audioPreviewUrl);
      previewAudioRef.current = audio;
      setIsPlayingPreview(true);
      
      audio.play().catch(() => setIsPlayingPreview(false));
      audio.onended = () => setIsPlayingPreview(false);
    }
  };

  const startNewClone = () => {
    setVoiceName("");
    setUploadFile(null);
    setRecordedBlob(null);
    if (audioPreviewUrl) {
      URL.revokeObjectURL(audioPreviewUrl);
      setAudioPreviewUrl(null);
    }
    setClonedProfile(null);
    setCloningStatus("idle");
    setStatusMessage(null);
  };

  React.useEffect(() => {
    return () => {
      if (recordIntervalRef.current) clearInterval(recordIntervalRef.current);
      if (previewAudioRef.current) previewAudioRef.current.pause();
    };
  }, []);

  const formatTime = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const secs = sec % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="bg-[#0c0c0c] rounded-3xl border border-white/10 p-6 md:p-8 shadow-xs">
      <div className="max-w-2xl mx-auto">
        
        {/* State 1: Ready to Record or Upload */}
        {cloningStatus !== "cloned" && (
          <form onSubmit={handleCloneSubmit} className="space-y-6">
            <div className="space-y-2">
              <h3 className="font-display font-black text-xl text-white flex items-center gap-2 uppercase italic tracking-tight">
                <Sparkles className="w-5 h-5 text-white animate-pulse" />
                Clonar Huella de Voz AI
              </h3>
              <p className="font-sans text-xs text-white/55 leading-relaxed mt-1">
                Captura u otorga un archivo corto (5-15 seg) donde alguien hable claramente. Nuestra IA de fonoanálisis de Gemini mapeará sus armónicos, tonalidad, género y ritmo para recrear esa voz.
              </p>
            </div>

            {/* Voice Name */}
            <div className="space-y-2">
              <label className="font-mono text-[9px] uppercase tracking-widest block font-bold text-white/55">
                Nombre de la Voz Clonada
              </label>
              <input
                type="text"
                value={voiceName}
                onChange={(e) => setVoiceName(e.target.value)}
                placeholder="Ej. Tía Consuelo, El Narrador Épico, Locutor AM..."
                className="w-full font-sans text-xs border border-white/10 focus:border-white focus:outline-none focus:ring-1 focus:ring-white rounded-xl px-4 py-3 bg-white/5 text-white placeholder:text-white/30 transition-all uppercase tracking-tight"
                disabled={cloningStatus === "uploading"}
                required
              />
            </div>

            {/* Vocal Input Strategy */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              {/* Box A: Mic Recording */}
              <div className={`p-5 rounded-2xl border-2 transition-all flex flex-col justify-between items-center text-center ${
                recordedBlob 
                  ? "border-emerald-500/30 bg-emerald-500/5" 
                  : "border-white/10 bg-white/[0.02]"
              }`}>
                <div className="space-y-2">
                  <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center text-red-400 mx-auto border border-red-500/20">
                    <Mic className="w-5 h-5" />
                  </div>
                  <h4 className="font-sans font-bold text-white text-sm uppercase tracking-tight">
                    Grabar en Directo
                  </h4>
                  <p className="font-sans text-xs text-white/45 max-w-xs leading-normal">
                    Habla de forma natural a una distancia fija de tu dispositivo.
                  </p>
                </div>

                <div className="mt-4 w-full space-y-3">
                  {isRecording ? (
                    <button
                      type="button"
                      id="stop-clone-recording"
                      onClick={stopRecording}
                      className="w-full bg-red-650 hover:bg-red-700 text-white font-mono font-bold text-[11px] py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 transition-colors animate-pulse uppercase tracking-wider"
                    >
                      <StopCircle className="w-4 h-4" />
                      Detener ({formatTime(recordDuration)})
                    </button>
                  ) : (
                    <button
                      type="button"
                      id="start-clone-recording"
                      onClick={startRecording}
                      disabled={cloningStatus === "uploading"}
                      className="w-full bg-white hover:bg-zinc-200 text-black font-mono font-bold text-[11px] py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 transition-colors disabled:opacity-50 uppercase tracking-wider cursor-pointer"
                    >
                      <Mic className="w-4 h-4" />
                      Iniciar Grabación
                    </button>
                  )}

                  {recordedBlob && (
                    <div className="bg-emerald-500/10 text-emerald-300 font-mono text-[9px] font-bold py-1 px-3 rounded-sm border border-emerald-500/20 inline-block uppercase tracking-wider">
                      ✓ Audio grabado con éxito
                    </div>
                  )}
                </div>
              </div>

              {/* Box B: File Upload */}
              <div className={`p-5 rounded-2xl border-2 transition-all flex flex-col justify-between items-center text-center ${
                uploadFile 
                  ? "border-emerald-500/30 bg-emerald-500/5" 
                  : "border-white/10 bg-white/[0.02]"
              }`}>
                <div className="space-y-2">
                  <div className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white/80 mx-auto">
                    <Upload className="w-5 h-5" />
                  </div>
                  <h4 className="font-sans font-bold text-white text-sm uppercase tracking-tight">
                    Subir Referencia
                  </h4>
                  <p className="font-sans text-xs text-white/45 max-w-xs leading-normal">
                    Sube un audio en MP3, WAV, M4A o audio extraído limpio.
                  </p>
                </div>

                <div className="mt-4 w-full">
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept="audio/*"
                    className="hidden"
                    disabled={cloningStatus === "uploading" || isRecording}
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={cloningStatus === "uploading" || isRecording}
                    className="w-full bg-white/10 hover:bg-white/15 text-white border border-white/10 font-mono font-bold text-[11px] py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 transition-colors disabled:opacity-50 uppercase tracking-wider cursor-pointer"
                  >
                    <Upload className="w-4 h-4" />
                    {uploadFile ? "Cambiar Archivo" : "Seleccionar Archivo"}
                  </button>

                  {uploadFile && (
                    <p className="text-[10px] font-mono text-white/55 mt-2 truncate max-w-[200px] mx-auto uppercase">
                      {uploadFile.name} ({(uploadFile.size / (1024 * 1024)).toFixed(2)} MB)
                    </p>
                  )}
                </div>
              </div>

            </div>

            {/* Audio Preview Controls if Audio Exists */}
            {audioPreviewUrl && (
              <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={togglePlayPreview}
                    className="w-10 h-10 rounded-full bg-white text-black flex items-center justify-center shadow-xs hover:bg-zinc-200 transition-colors cursor-pointer"
                  >
                    {isPlayingPreview ? (
                      <span className="w-3 h-3 bg-black rounded-xs"></span>
                    ) : (
                      <Play className="w-4 h-4 fill-current ml-0.5" />
                    )}
                  </button>
                  <div>
                    <h5 className="font-sans font-bold text-xs text-white uppercase tracking-tight">Muestra de Referencia</h5>
                    <p className="font-sans text-[10px] text-white/55 leading-tight mt-0.5">Escucha el audio antes de solicitar la clonación.</p>
                  </div>
                </div>
              </div>
            )}

            {/* Status Feedback */}
            {statusMessage && (
              <div className={`p-4 rounded-2xl border flex items-start gap-4 ${
                statusMessage.isError 
                  ? "bg-red-500/10 border-red-500/25 text-red-300" 
                  : "bg-emerald-500/10 border-emerald-500/25 text-emerald-300"
              }`}>
                {statusMessage.isError ? (
                  <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                ) : (
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                )}
                <p className="font-sans text-xs leading-normal">{statusMessage.text}</p>
              </div>
            )}

            {/* Trigger Button */}
            <div>
              <button
                type="submit"
                id="submit-voice-clining-btn"
                disabled={cloningStatus === "uploading" || isRecording || (!recordedBlob && !uploadFile)}
                className="w-full h-14 bg-white hover:bg-zinc-200 text-black font-mono font-black uppercase text-xs rounded-2xl shadow-md cursor-pointer transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2 tracking-widest text-center"
              >
                {cloningStatus === "uploading" ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin text-black" />
                    Analizando perfil con IA de Gemini...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5 text-black" />
                    Clonar y Crear Perfil de Voz
                  </>
                )}
              </button>
            </div>
          </form>
        )}

        {/* State 2: Successfully Cloned Feedback */}
        {cloningStatus === "cloned" && clonedProfile && (
          <div className="space-y-8 animate-fade-in">
            <div className="text-center space-y-2">
              <div className="w-16 h-16 rounded-full bg-white text-black flex items-center justify-center mx-auto text-2xl font-black border-2 border-white">
                ✓
              </div>
              <h3 className="font-display font-black text-2xl uppercase italic tracking-tight text-white">
                Clonación Realizada con Éxito
              </h3>
              <p className="font-sans text-xs text-white/60">
                La firma vocal aproximada de <b>&quot;{clonedProfile.name}&quot;</b> ha sido guardada en la biblioteca de tu espacio.
              </p>
            </div>

            {/* Gemini Analyzed Acoustic Fingerprint Card */}
            <div className="bg-white/5 border border-white/10 rounded-3xl p-6 md:p-8 space-y-4">
              <div className="flex items-center gap-1.5 bg-white text-black px-3 py-1 rounded-sm w-fit font-mono text-[9px] font-bold uppercase tracking-wider">
                <Sparkles className="w-3.5 h-3.5" />
                Mapeo Acústico de Gemini
              </div>

              <div className="space-y-3 pt-2">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-[9px] uppercase font-bold text-white/50 tracking-wider w-24">Género:</span>
                  <span className="font-sans text-xs font-bold text-white bg-white/5 px-2.5 py-1 border border-white/10 rounded-lg capitalize">
                    {clonedProfile.gender}
                  </span>
                </div>

                <div className="flex items-start gap-3">
                  <span className="font-mono text-[9px] uppercase font-bold text-white/50 tracking-wider w-24 mt-0.5">Modelo Base:</span>
                  <div>
                    <span className="font-sans text-xs font-bold text-white bg-white/5 px-2.5 py-1 border border-white/10 rounded-lg">
                      {clonedProfile.baseVoiceName}
                    </span>
                    <p className="text-[10px] text-white/40 mt-1 leading-normal">Voz madre elegida automáticamente para coincidir en armónicos.</p>
                  </div>
                </div>

                <div className="border-t border-white/10 my-2 pt-4">
                  <h5 className="font-mono text-[9px] uppercase font-bold text-white/50 tracking-wider mb-2">Descripción de Timbre:</h5>
                  <p className="font-sans text-xs text-[#f0f0f0]/90 leading-relaxed bg-black/40 p-4 rounded-xl border border-white/5 italic">
                    &quot;{clonedProfile.descriptor}&quot;
                  </p>
                </div>
              </div>
            </div>

            {/* Helper tips */}
            <div className="border border-white/10 bg-white/[0.02] rounded-2xl p-6 text-center space-y-4">
              <p className="font-sans text-xs text-white/60 leading-normal max-w-md mx-auto">
                Ahora puedes ir a la sección <b>&quot;Cambiar Voz&quot;</b>, seleccionar a <b>{clonedProfile.name}</b> en tu biblioteca, y convertir cualquier audio que subas a este tono de voz.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <button
                  type="button"
                  onClick={startNewClone}
                  className="bg-white hover:bg-zinc-200 text-black font-mono font-bold text-xs py-3 px-6 rounded-xl transition-colors uppercase tracking-wider cursor-pointer font-black"
                >
                  Clonar Otra Voz
                </button>
              </div>
            </div>

          </div>
        )}

      </div>
    </div>
  );
}
