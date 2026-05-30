"use client";

import React from "react";
import { 
  Sparkles, ShieldCheck, Activity, Star, Sliders, Volume2, Mic, Clock, 
  Settings, HelpCircle, GraduationCap, ServerCrash, RefreshCw 
} from "lucide-react";
import { VoiceProfile, ConversionHistoryItem } from "./types";
import LibraryPanel from "./components/LibraryPanel";
import TabVoiceClone from "./components/TabVoiceClone";
import TabVoiceConvert from "./components/TabVoiceConvert";
import HistoryPanel from "./components/HistoryPanel";

export default function App() {
  const [activeTab, setActiveTab] = React.useState<"convert" | "clone">("convert");
  const [voices, setVoices] = React.useState<{ prebuilt: VoiceProfile[]; cloned: VoiceProfile[] }>({
    prebuilt: [],
    cloned: [],
  });
  const [selectedVoiceId, setSelectedVoiceId] = React.useState<string>("");
  const [history, setHistory] = React.useState<ConversionHistoryItem[]>([]);
  const [isApiKeyActive, setIsApiKeyActive] = React.useState<boolean>(true);
  const [isConfigChecked, setIsConfigChecked] = React.useState<boolean>(false);
  const [isInitializing, setIsInitializing] = React.useState<boolean>(true);

  // 1. Fetch voices and API Key setup test
  const setupStudioWorkspace = async () => {
    try {
      setIsInitializing(true);
      
      // Test Gemini API status on server
      const setupRes = await fetch("/api/setup-test");
      const setupData = await setupRes.json();
      setIsApiKeyActive(setupData.hasKey);

      // Fetch voice libraries
      const voicesRes = await fetch("/api/voices");
      const voicesData = await voicesRes.json();
      setVoices({
        prebuilt: voicesData.prebuilt || [],
        cloned: voicesData.cloned || [],
      });

      // Default select the first available voice
      if (voicesData.prebuilt && voicesData.prebuilt.length > 0) {
        setSelectedVoiceId(voicesData.prebuilt[0].id);
      }
      setIsConfigChecked(true);
    } catch (err) {
      console.error("[ERROR] Failed to connect to studio backend APIs:", err);
      setIsApiKeyActive(false);
    } finally {
      setIsInitializing(false);
    }
  };

  React.useEffect(() => {
    setupStudioWorkspace();
  }, []);

  // 2. Handle voice additions and deletions
  const handleAddNewClonedVoice = (newVoice: VoiceProfile) => {
    setVoices((prev) => ({
      ...prev,
      cloned: [newVoice, ...prev.cloned],
    }));
    // Auto-select newly cloned voice immediately!
    setSelectedVoiceId(newVoice.id);
    setActiveTab("convert"); // Switch to convert to let them play with it instantly
  };

  const handleDeleteClonedVoice = async (id: string) => {
    try {
      const res = await fetch(`/api/voice-clone/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (res.ok) {
        setVoices((prev) => ({
          ...prev,
          cloned: prev.cloned.filter((v) => v.id !== id),
        }));
        
        // If deleted voice was selected, revert to first prebuilt voice
        if (selectedVoiceId === id && voices.prebuilt.length > 0) {
          setSelectedVoiceId(voices.prebuilt[0].id);
        }
      } else {
        alert(data.error || "No se pudo eliminar la voz.");
      }
    } catch (err) {
      console.error(err);
      alert("Error al intentar connectarse con el servidor.");
    }
  };

  const handleAddHistoryItem = (item: ConversionHistoryItem) => {
    setHistory((prev) => [item, ...prev]);
  };

  return (
    <div className="min-h-screen bg-[#080808] flex flex-col justify-between text-[#f0f0f0] font-sans antialiased" id="voicechanger-master-app">
      
      {/* Top Warning Banner if GEMINI KEY is missing */}
      {!isInitializing && !isApiKeyActive && (
        <div className="bg-amber-600 text-black font-sans text-xs px-6 py-3 flex items-center justify-between border-b border-white/10 gap-3 font-extrabold uppercase tracking-wide">
          <div className="flex items-center gap-2">
            <ServerCrash className="w-4 h-4 shrink-0" />
            <span>
              Falta configurar la clave <b>GEMINI_API_KEY</b>. Las funciones de clonación AI de alta fidelidad operarán en dsp local. Agrega la clave en <b>Ajustes &gt; Secretos</b> de AI Studio para activar la IA.
            </span>
          </div>
          <button
            onClick={setupStudioWorkspace}
            className="bg-black/10 hover:bg-black/20 px-3 py-1 rounded-full text-[10px] uppercase font-bold shrink-0 transition-colors"
          >
            Re-intentar
          </button>
        </div>
      )}

      {/* Primary Studio Header */}
      <header className="border-b border-white/10 bg-[#080808]/90 sticky top-0 z-40 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white text-black flex items-center justify-center font-display font-black text-xs uppercase cursor-pointer hover:bg-zinc-200">
              SYNTH
            </div>
            <div>
              <h1 className="font-display font-black text-xl tracking-tighter text-white uppercase italic leading-none">
                VOX.IDENTITY
              </h1>
              <p className="font-mono text-[9px] font-bold uppercase tracking-[0.2em] text-white/50 mt-1">
                Plataforma de Rediseño Fónico AI
              </p>
            </div>
          </div>

          <nav className="hidden lg:flex gap-8 text-[11px] font-mono font-bold tracking-[0.2em] uppercase text-white/50">
            <span>Neural Engine v4.2</span>
            <span>Voice Library</span>
            <span>Batch Processor</span>
          </nav>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-1.5 bg-white/5 border border-white/15 px-3 py-1.5 rounded-lg">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="font-mono text-[10px] text-[#f0f0f0] font-bold uppercase tracking-wider">
                Ingress: 3000
              </span>
            </div>

            <button
              onClick={setupStudioWorkspace}
              className="p-2 hover:bg-white/10 border border-white/10 rounded-lg transition-colors text-white"
              title="Actualizar conexión"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

        </div>
      </header>

      {/* Loading state indicator */}
      {isInitializing ? (
        <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 flex flex-col justify-center items-center gap-4 bg-[#080808]">
          <div className="relative w-14 h-14">
            <div className="absolute inset-0 rounded-full border-4 border-white/5"></div>
            <div className="absolute inset-0 rounded-full border-4 border-white border-t-transparent animate-spin"></div>
          </div>
          <p className="font-mono text-xs text-white/55 font-bold animate-pulse uppercase tracking-widest">
            Sincronizando perfiles fonéticos VOX.SYNTH...
          </p>
        </main>
      ) : (
        /* Workspace Main Layout Grid */
        <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full">
          
          {/* Hero Bold Typography Segment */}
          <div className="mb-10 border-b border-white/10 pb-10 flex flex-col md:flex-row items-end justify-between gap-6">
            <div className="space-y-4">
              <span className="font-mono text-xs text-white/40 tracking-[0.25em] uppercase font-bold block">
                Neural Voice Synthesis Network
              </span>
              <h2 className="text-6xl sm:text-8xl md:text-9xl font-display font-black tracking-tighter uppercase italic text-white leading-[0.85] select-none">
                VOICE<br />SYNTH<br />MAX.
              </h2>
            </div>
            <div className="max-w-md space-y-6">
              <p className="font-sans text-sm sm:text-base font-light text-white/60 leading-relaxed">
                Transforma cualquier archivo de audio o video en una voz con calidad de estudio. Clona, rediseña y despliega firmas fonéticas hiperrealistas con la potencia de la síntesis del motor multimodal Gemini.
              </p>
              <div className="flex items-center gap-4">
                <div className="px-3.5 py-1.5 bg-white/5 border border-white/10 rounded-lg text-xs font-mono text-white/70">
                  LATENCY: <span className="text-white font-bold">12ms</span>
                </div>
                <div className="px-3.5 py-1.5 bg-white/5 border border-white/10 rounded-lg text-xs font-mono text-white/70">
                  FIDELITY: <span className="text-white font-bold">99.8%</span>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            
            {/* Left Module Panel: Core Working Area (Tab selectors) (Col 7/12) */}
            <div className="lg:col-span-12 xl:col-span-7 space-y-8">
              
              {/* Tab Selector buttons bar - Styled inside Dark Theme */}
              <div className="bg-[#0c0c0c] border border-white/10 p-1.5 rounded-2xl flex items-center gap-2 max-w-md">
                <button
                  type="button"
                  id="tab-convert-selector"
                  onClick={() => setActiveTab("convert")}
                  className={`flex-1 font-sans font-black text-xs py-3 px-4 rounded-xl flex items-center justify-center gap-1.5 transition-all outline-hidden cursor-pointer ${
                    activeTab === "convert"
                      ? "bg-white text-black shadow-md font-black"
                      : "text-white/60 hover:text-white hover:bg-white/5"
                  }`}
                >
                  <Volume2 className="w-4 h-4" />
                  CAMBIAR VOZ
                </button>
                <button
                  type="button"
                  id="tab-clone-selector"
                  onClick={() => setActiveTab("clone")}
                  className={`flex-1 font-sans font-black text-xs py-3 px-4 rounded-xl flex items-center justify-center gap-1.5 transition-all outline-hidden cursor-pointer ${
                    activeTab === "clone"
                      ? "bg-white text-black shadow-md font-black"
                      : "text-white/60 hover:text-white hover:bg-white/5"
                  }`}
                >
                  <Mic className="w-4 h-4" />
                  CLONAR VOZ
                </button>
              </div>

              {/* Tab Workspaces Component distribution */}
              {activeTab === "convert" ? (
                <TabVoiceConvert
                  voices={voices}
                  selectedVoiceId={selectedVoiceId}
                  onAddHistoryItem={handleAddHistoryItem}
                />
              ) : (
                <TabVoiceClone onVoiceCloned={handleAddNewClonedVoice} />
              )}

              {/* Dynamic History Logs widget at the bottom */}
              <HistoryPanel history={history} />
            </div>

            {/* Right Module Panel: Control Room & Sound Library / Quick Reference (Col 5/12) */}
            <div className="lg:col-span-12 xl:col-span-5 space-y-8">
              
              {/* Voice library choosing card board */}
              <div className="bg-[#0c0c0c] rounded-3xl border border-white/10 p-6 shadow-xs">
                <div className="mb-6 border-b border-white/10 pb-4">
                  <h2 className="font-display font-black text-xl text-white uppercase italic tracking-tight">
                    Biblioteca de Voces
                  </h2>
                  <p className="font-sans text-xs text-white/55 mt-1">
                    Elige el perfil fonético activo para re-modular tus audios o videos.
                  </p>
                </div>
                
                <LibraryPanel
                  voices={voices}
                  selectedVoiceId={selectedVoiceId}
                  onSelectVoice={(id) => setSelectedVoiceId(id)}
                  onDeleteVoice={handleDeleteClonedVoice}
                />
              </div>

              {/* Advanced Interactive Help Hub Box */}
              <div className="bg-[#0c0c0c] border border-white/10 rounded-3xl p-6 space-y-4">
                <div className="flex items-center gap-2">
                  <GraduationCap className="w-5 h-5 text-white" />
                  <h4 className="font-sans font-bold text-sm text-white uppercase tracking-wider">
                    Guía Rápida de Clonación Total
                  </h4>
                </div>

                <div className="space-y-4 font-sans text-xs text-white/60 leading-relaxed">
                  <div className="flex items-start gap-3">
                    <span className="w-5 h-5 rounded-md bg-white/5 border border-white/10 text-white flex items-center justify-center font-mono font-bold text-[10px] shrink-0 mt-0.5">01</span>
                    <p>
                      <b>Audio de Referencia:</b> Graba o sube muestras de 5 a 15 segundos con voz limpia. Gemini mapeará los armónicos de cuerda laringeal de forma automática.
                    </p>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="w-5 h-5 rounded-md bg-white/5 border border-white/10 text-white flex items-center justify-center font-mono font-bold text-[10px] shrink-0 mt-0.5">02</span>
                    <p>
                      <b>Extracción de Video:</b> Sube videos en formato MP4 o WebM; el motor fónico extraerá la pista acústica automáticamente de forma nativa.
                    </p>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="w-5 h-5 rounded-md bg-white/5 border border-white/10 text-white flex items-center justify-center font-mono font-bold text-[10px] shrink-0 mt-0.5">03</span>
                    <p>
                      <b>Control de Actuación:</b> Inserta modificadores de traducción y emoción para infundir ira, alegría o un profundo misterio en el locutor final.
                    </p>
                  </div>
                </div>
              </div>

            </div>

          </div>
        </main>
      )}

      {/* Footer copyright segment */}
      <footer className="border-t border-white/10 bg-[#080808] py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 font-mono text-[10px] text-white/30 tracking-widest uppercase">
          <p>
            © 2026 VOX.IDENTITY // GEMINI MULTIMODAL PRO CORE
          </p>
          <div className="flex gap-8">
            <span>Hardware Accel: ON</span>
            <span>Estable (120ms local)</span>
          </div>
        </div>
      </footer>

    </div>
  );
}
