"use client";

import { AlertCircle, Download, Link2, Loader2 } from "lucide-react";
import React from "react";

export function SocialVideoDownloader() {
  const [url, setUrl] = React.useState("");
  const [status, setStatus] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsLoading(true);
    setStatus(null);
    try {
      const response = await fetch("/api/social-download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await response.json();
      setStatus(data.details || data.error || "No se pudo preparar la descarga.");
    } catch {
      setStatus("No se pudo conectar con el servicio de descarga.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-slate-900">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-black text-slate-950 dark:text-white">Descargar videos sociales</h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Instagram, Facebook y TikTok para contenido propio o con permiso.
          </p>
        </div>
        <span className="grid h-10 w-10 place-items-center rounded-lg bg-slate-950 text-white dark:bg-white dark:text-slate-950">
          <Download className="h-5 w-5" />
        </span>
      </div>

      <form onSubmit={submit} className="mt-5 flex flex-col gap-3 sm:flex-row">
        <label className="relative flex-1">
          <Link2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="Pega el enlace del video"
            className="focus-ring h-11 w-full rounded-lg border border-slate-200 bg-white pl-10 pr-3 text-sm text-slate-950 dark:border-white/10 dark:bg-slate-950 dark:text-white"
          />
        </label>
        <button
          type="submit"
          disabled={isLoading}
          className="focus-ring inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 text-sm font-bold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          Preparar
        </button>
      </form>

      {status && (
        <div className="mt-4 flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-100">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>{status}</p>
        </div>
      )}
    </section>
  );
}
