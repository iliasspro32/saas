import React from "react";
import { ConversionHistoryItem } from "../types";
import { Play, Download, Clock, Headphones, FileAudio, FileVideo, Music } from "lucide-react";

interface HistoryPanelProps {
  history: ConversionHistoryItem[];
}

export default function HistoryPanel({ history }: HistoryPanelProps) {
  const [playingId, setPlayingId] = React.useState<string | null>(null);
  const audioRef = React.useRef<HTMLAudioElement | null>(null);

  const handlePlayHistory = (item: ConversionHistoryItem) => {
    if (playingId === item.id) {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      setPlayingId(null);
      return;
    }

    if (audioRef.current) {
      audioRef.current.pause();
    }

    const audio = new Audio(item.audioData);
    audioRef.current = audio;
    setPlayingId(item.id);
    
    audio.play().catch(err => console.error("Fallo reproducción:", err));
    audio.onended = () => setPlayingId(null);
  };

  React.useEffect(() => {
    return () => {
      if (audioRef.current) audioRef.current.pause();
    };
  }, []);

  if (history.length === 0) {
    return (
      <div className="bg-[#0c0c0c] border border-white/10 rounded-3xl p-6 text-center text-white/50 space-y-2">
        <Clock className="w-8 h-8 text-white/40 stroke-[1.5] mx-auto" />
        <h4 className="font-display font-black text-sm text-white uppercase tracking-tight">Historial de Trabajos Vacío</h4>
        <p className="font-sans text-xs text-white/50 max-w-xs mx-auto">
          Los audios o videos que conviertas aparecerán aquí para que puedas descargarlos o reproducirlos cuando quieras.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4" id="conversions-history-panel">
      <div className="flex items-center gap-2 mb-1">
        <Clock className="w-5 h-5 text-white/50" />
        <h3 className="font-display font-black text-lg text-white uppercase italic tracking-tight">
          Últimos Trabajos Procesados
        </h3>
      </div>

      <div className="space-y-3">
        {history.map((item) => (
          <div
            key={item.id}
            id={`history-row-${item.id}`}
            className="bg-white/5 border border-white/10 hover:border-white/20 rounded-2xl p-4 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
          >
            {/* Visual description */}
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-white/5 border border-white/5 flex items-center justify-center shrink-0 text-white/50 mt-0.5">
                {item.originalType === "video" ? (
                  <FileVideo className="w-4 h-4" />
                ) : (
                  <FileAudio className="w-4 h-4" />
                )}
              </div>
              
              <div className="space-y-1 overflow-hidden">
                <div className="flex items-center gap-2">
                  <span className="font-sans font-extrabold text-xs text-white truncate block max-w-[150px] md:max-w-[250px]">
                    {item.originalFileName}
                  </span>
                  <span className="bg-white text-black font-mono text-[9px] font-black px-2 py-0.5 rounded-sm uppercase tracking-wider shrink-0">
                    → {item.targetVoiceName}
                  </span>
                </div>

                {item.transcription && (
                  <p className="font-sans text-[11px] text-white/40 italic line-clamp-1">
                    &quot;{item.transcription}&quot;
                  </p>
                )}

                <div className="flex items-center gap-1.5 text-[9px] text-white/30 font-mono uppercase">
                  <span>Procesado a las {item.date}</span>
                </div>
              </div>
            </div>

            {/* Listening actions */}
            <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
              <button
                type="button"
                id={`play-history-${item.id}`}
                onClick={() => handlePlayHistory(item)}
                className={`flex items-center justify-center gap-1.5 font-mono font-bold text-[10px] uppercase py-2 px-3.5 rounded-xs transition-colors cursor-pointer ${
                  playingId === item.id
                    ? "bg-red-500 text-white animate-pulse"
                    : "bg-white hover:bg-zinc-200 text-black font-black"
                }`}
              >
                {playingId === item.id ? (
                  <>
                    <span className="w-2 h-2 bg-white rounded-xs"></span>
                    Detener
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                    Escuchar
                  </>
                )}
              </button>

              <a
                id={`download-history-${item.id}`}
                href={item.audioData}
                download={`retroclon-${item.id}.wav`}
                className="bg-white/10 hover:bg-white/15 text-white p-2 rounded-xs transition-colors border border-white/10 flex items-center justify-center cursor-pointer"
                title="Descargar audio WAV"
              >
                <Download className="w-4 h-4" />
              </a>
            </div>

          </div>
        ))}
      </div>
    </div>
  );
}
