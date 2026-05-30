import React from "react";
import { VoiceProfile } from "../types";
import { Volume2, Play, Trash2, Mic, User, Tag, HelpCircle, Star } from "lucide-react";

interface LibraryPanelProps {
  voices: {
    prebuilt: VoiceProfile[];
    cloned: VoiceProfile[];
  };
  selectedVoiceId: string;
  onSelectVoice: (voiceId: string) => void;
  onDeleteVoice: (id: string) => Promise<void>;
  loadingVoiceId?: string;
}

export default function LibraryPanel({
  voices,
  selectedVoiceId,
  onSelectVoice,
  onDeleteVoice,
  loadingVoiceId,
}: LibraryPanelProps) {
  const [playingId, setPlayingId] = React.useState<string | null>(null);
  const audioRef = React.useRef<HTMLAudioElement | null>(null);

  const allVoices = [...voices.prebuilt, ...voices.cloned];

  const handlePlayPreview = (voice: VoiceProfile, e: React.MouseEvent) => {
    e.stopPropagation();

    if (playingId === voice.id) {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      setPlayingId(null);
      return;
    }

    if (audioRef.current) {
      audioRef.current.pause();
    }

    // Since these are pre-built synthesis voices or custom cloned, we can synthesize a brief greeting
    // For prebuilts or custom cloned with base types, we synthesize dynamically using an utterance,
    // or if a cloned sample exists, play that sample!
    if (voice.type === "cloned" && voice.audioSampleData) {
      const audio = new Audio(voice.audioSampleData);
      audioRef.current = audio;
      setPlayingId(voice.id);
      audio.play().catch(err => console.error(err));
      audio.onended = () => setPlayingId(null);
    } else {
      // Use standard SpeechSynthesis for instant local pre-rendered greeting preview in Spanish
      const utterance = new SpeechSynthesisUtterance(
        `Hola, esta es una demostración de mi voz para Cambio de Voz AI.`
      );
      // Select appropriate gender voice in speech synthesis if possible
      const synth = window.speechSynthesis;
      const voicesList = synth.getVoices();
      
      const matchedVoice = voicesList.find(v => {
        const langMatch = v.lang.startsWith("es") || v.lang.startsWith("en");
        if (!langMatch) return false;
        if (voice.gender === "femenino") {
          return v.name.toLowerCase().includes("female") || v.name.toLowerCase().includes("maria") || v.name.toLowerCase().includes("google");
        } else {
          return v.name.toLowerCase().includes("male") || v.name.toLowerCase().includes("google");
        }
      });

      if (matchedVoice) {
        utterance.voice = matchedVoice;
      }
      
      utterance.pitch = voice.pitchShift ? 1 + (voice.pitchShift / 12) : 1;
      utterance.rate = 1.0;
      
      setPlayingId(voice.id);
      synth.speak(utterance);
      utterance.onend = () => setPlayingId(null);
      utterance.onerror = () => setPlayingId(null);
    }
  };

  React.useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      if (typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  return (
    <div className="space-y-8" id="library-panel-section">
      {/* Cloned Voices */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Star className="w-4 h-4 text-white fill-white/20" />
            <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-white/70">
              Voces Clonadas AI
            </h3>
          </div>
          <span className="font-mono text-[10px] bg-white/5 text-white/50 px-2.5 py-1 rounded-sm border border-white/10 uppercase tracking-widest">
            {voices.cloned.length} Grabadas
          </span>
        </div>

        {voices.cloned.length === 0 ? (
          <div className="border border-dashed border-white/15 bg-white/[0.02] rounded-2xl p-8 text-center text-white/40 flex flex-col items-center justify-center gap-3">
            <Mic className="w-8 h-8 text-white/30 stroke-[1.5]" />
            <p className="font-sans text-sm font-bold text-white/70">Aún no has clonado ninguna voz.</p>
            <p className="font-sans text-xs text-white/50 max-w-sm leading-normal">
              Ve a la pestaña <b>&quot;Clonar Voz&quot;</b> y sube una muestra de audio de 5-15 segundos para agregar tu perfil personalizado aquí.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {voices.cloned.map((voice) => {
              const worksAsSelected = selectedVoiceId === voice.id;
              return (
                <div
                  key={voice.id}
                  id={`voice-card-${voice.id}`}
                  onClick={() => onSelectVoice(voice.id)}
                  className={`relative p-5 rounded-2xl border-2 transition-all cursor-pointer duration-300 flex flex-col justify-between ${
                    worksAsSelected
                      ? "border-white bg-white text-black shadow-lg scale-[1.01]"
                      : "border-white/10 bg-[#080808] hover:border-white/20 text-[#f0f0f0]"
                  }`}
                >
                  <div>
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="flex items-center gap-2">
                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs ${
                          worksAsSelected ? "bg-black/15 text-black" : "bg-white/5 text-white/90"
                        }`}>
                          {voice.gender === "femenino" ? "♀" : voice.gender === "masculino" ? "♂" : "⚦"}
                        </div>
                        <h4 className="font-sans font-bold text-sm uppercase tracking-tight">
                          {voice.name}
                        </h4>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          id={`play-preview-${voice.id}`}
                          onClick={(e) => handlePlayPreview(voice, e)}
                          className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                            playingId === voice.id
                              ? "bg-red-500 text-white animate-pulse"
                              : worksAsSelected
                              ? "bg-black/10 text-black hover:bg-black/20"
                              : "bg-white/10 text-white hover:bg-white/15"
                          }`}
                          title="Reproducir demostración"
                        >
                          {playingId === voice.id ? (
                            <span className={`w-2 h-2 rounded-xs ${worksAsSelected ? "bg-black" : "bg-white"}`}></span>
                          ) : (
                            <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                          )}
                        </button>

                        {voice.isCustom && (
                          <button
                            type="button"
                            id={`delete-voice-${voice.id}`}
                            onClick={async (e) => {
                              e.stopPropagation();
                              if (confirm(`¿Estás seguro de que quieres eliminar la voz clonada "${voice.name}"?`)) {
                                await onDeleteVoice(voice.id);
                              }
                            }}
                            className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                              worksAsSelected
                                ? "bg-black/5 text-black/60 hover:bg-red-500 hover:text-white"
                                : "bg-white/5 text-white/60 hover:bg-red-500 hover:text-white"
                            }`}
                            title="Eliminar voz"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    <p className={`font-sans text-xs line-clamp-3 mb-4 leading-relaxed ${
                      worksAsSelected ? "text-black/70 italic" : "text-white/60 italic"
                    }`}>
                      &quot;{voice.descriptor}&quot;
                    </p>
                  </div>

                  <div className={`flex flex-wrap items-center gap-1.5 pt-3 border-t ${
                    worksAsSelected ? "border-black/10" : "border-white/10"
                  }`}>
                    <span className={`text-[9px] font-mono font-bold tracking-wider uppercase px-2 py-0.5 rounded-sm ${
                      worksAsSelected ? "bg-black text-white" : "bg-white/10 text-white/80"
                    }`}>
                      Clonada AI
                    </span>
                    {voice.tags.map((tag, idx) => (
                      <span
                        key={idx}
                        className={`text-[9px] font-mono font-bold uppercase px-2 py-0.5 rounded-sm ${
                          worksAsSelected ? "bg-black/5 text-black/75" : "bg-white/5 text-white/50"
                        }`}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>

                  {worksAsSelected && (
                    <div className="absolute -top-1.5 -right-1.5 bg-white text-black rounded-full p-0.5 shadow-md border border-black/10">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Prebuilt Voices */}
      <div>
        <div className="flex items-center gap-2 mb-4 border-t border-white/10 pt-6">
          <Volume2 className="w-4 h-4 text-white/60" />
          <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-white/70">
            Voces Preestablecidas Gemini
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {voices.prebuilt.map((voice) => {
            const worksAsSelected = selectedVoiceId === voice.id;
            return (
              <div
                key={voice.id}
                id={`voice-card-${voice.id}`}
                onClick={() => onSelectVoice(voice.id)}
                className={`relative p-5 rounded-2xl border-2 transition-all cursor-pointer duration-300 flex flex-col justify-between ${
                  worksAsSelected
                    ? "border-white bg-white text-black shadow-lg scale-[1.01]"
                    : "border-white/10 bg-[#080808] hover:border-white/20 text-[#f0f0f0]"
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex items-center gap-2">
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs ${
                        worksAsSelected ? "bg-black/15 text-black" : "bg-white/5 text-white/90"
                      }`}>
                        {voice.gender === "femenino" ? "♀" : voice.gender === "masculino" ? "♂" : "⚦"}
                      </div>
                      <h4 className="font-sans font-bold text-sm uppercase tracking-tight">
                        {voice.name}
                      </h4>
                    </div>

                    <button
                      type="button"
                      id={`play-preview-${voice.id}`}
                      onClick={(e) => handlePlayPreview(voice, e)}
                      className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                        playingId === voice.id
                          ? "bg-red-500 text-white animate-pulse"
                          : worksAsSelected
                          ? "bg-black/10 text-black hover:bg-black/20"
                          : "bg-white/10 text-white hover:bg-white/15"
                      }`}
                      title="Reproducir demostración"
                    >
                      {playingId === voice.id ? (
                        <span className={`w-2 h-2 rounded-xs ${worksAsSelected ? "bg-black" : "bg-white"}`}></span>
                      ) : (
                        <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                      )}
                    </button>
                  </div>

                  <p className={`font-sans text-xs mb-4 leading-relaxed ${
                    worksAsSelected ? "text-black/75" : "text-white/60"
                  }`}>
                    {voice.descriptor}
                  </p>
                </div>

                <div className={`flex flex-wrap items-center gap-1.5 pt-3 border-t ${
                  worksAsSelected ? "border-black/10" : "border-white/10"
                }`}>
                  <span className={`text-[9px] font-mono font-bold tracking-wider uppercase px-2 py-0.5 rounded-sm ${
                    worksAsSelected ? "bg-black text-white" : "bg-white/10 text-emerald-400"
                  }`}>
                    ESTABLE
                  </span>
                  {voice.tags.map((tag, idx) => (
                    <span
                      key={idx}
                      className={`text-[9px] font-mono font-bold uppercase px-2 py-0.5 rounded-sm ${
                        worksAsSelected ? "bg-black/5 text-black/75" : "bg-white/5 text-white/50"
                      }`}
                    >
                      {tag}
                    </span>
                  ))}
                </div>

                {worksAsSelected && (
                  <div className="absolute -top-1.5 -right-1.5 bg-white text-black rounded-full p-0.5 shadow-md border border-black/10">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
