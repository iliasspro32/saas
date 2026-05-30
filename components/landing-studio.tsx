"use client";

import type React from "react";
import { Check, Code2, Copy, Download, Eye, FileCode2, Loader2, Sparkles } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { languages } from "@/lib/ai/templates";

export function LandingStudio() {
  const [html, setHtml] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [view, setView] = useState<"preview" | "code">("preview");
  const [copied, setCopied] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setCopied(false);
    const payload = Object.fromEntries(new FormData(event.currentTarget).entries());
    const response = await fetch("/api/landing-page", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await response.json();
    setLoading(false);
    if (!response.ok) {
      setError(data.error || "No se pudo generar la landing page.");
      return;
    }
    setHtml(data.html);
    setView("preview");
  }

  async function copyHtml() {
    await navigator.clipboard.writeText(html);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  function downloadHtml() {
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "landing-page.html";
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[380px_1fr]">
      <Card className="self-start">
        <div className="mb-5 flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-lg bg-brand-600 text-white"><FileCode2 className="h-5 w-5" /></span>
          <div>
            <h2 className="font-bold">Nueva landing</h2>
            <p className="text-xs text-slate-500">HTML completo listo para publicar</p>
          </div>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <label className="block text-sm font-medium">Nombre del producto
            <input name="productName" required minLength={2} maxLength={120} className="mt-2 h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm dark:border-white/10 dark:bg-slate-950" placeholder="Ej: Curso Finanzas Claras" />
          </label>
          <label className="block text-sm font-medium">Descripción del producto
            <textarea name="description" required minLength={10} maxLength={2400} className="mt-2 min-h-44 w-full rounded-lg border border-slate-200 bg-white p-3 text-sm dark:border-white/10 dark:bg-slate-950" placeholder="Explica qué vendes, para quién sirve y qué resultado ayuda a conseguir." />
          </label>
          <label className="block text-sm font-medium">Idioma
            <select name="language" defaultValue="Spanish" className="mt-2 h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm dark:border-white/10 dark:bg-slate-950">
              {languages.map((language) => <option key={language}>{language}</option>)}
            </select>
          </label>
          {error && <div className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700 dark:bg-rose-950/40 dark:text-rose-200">{error}</div>}
          <Button className="w-full" disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {loading ? "Creando landing..." : "Generar landing HTML"}
          </Button>
        </form>
      </Card>

      <Card className="min-h-[720px] p-0">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-4 dark:border-white/10">
          <div>
            <h2 className="font-bold">Landing page generada</h2>
            <p className="text-xs text-slate-500">Vista previa y código HTML editable</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <div className="flex rounded-lg border border-slate-200 p-1 dark:border-white/10">
              <button type="button" title="Vista previa" onClick={() => setView("preview")} className={`grid h-8 w-8 place-items-center rounded ${view === "preview" ? "bg-slate-950 text-white dark:bg-white dark:text-slate-950" : "text-slate-500"}`}><Eye className="h-4 w-4" /></button>
              <button type="button" title="Código HTML" onClick={() => setView("code")} className={`grid h-8 w-8 place-items-center rounded ${view === "code" ? "bg-slate-950 text-white dark:bg-white dark:text-slate-950" : "text-slate-500"}`}><Code2 className="h-4 w-4" /></button>
            </div>
            <Button variant="secondary" className="h-10 px-3" title="Copiar HTML" onClick={copyHtml} disabled={!html}>{copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}</Button>
            <Button variant="secondary" className="h-10 px-3" title="Descargar HTML" onClick={downloadHtml} disabled={!html}><Download className="h-4 w-4" /></Button>
          </div>
        </div>
        {html ? (
          view === "preview"
            ? <iframe title="Vista previa de la landing page" sandbox="allow-scripts" srcDoc={html} className="h-[680px] w-full bg-white" />
            : <pre dir="auto" className="h-[680px] overflow-auto whitespace-pre-wrap bg-slate-950 p-5 text-xs leading-6 text-slate-100">{html}</pre>
        ) : (
          <div className="grid min-h-[680px] place-items-center p-8 text-center">
            <div className="max-w-md">
              <FileCode2 className="mx-auto h-10 w-10 text-brand-500" />
              <h3 className="mt-4 text-lg font-bold">Tu landing aparecerá aquí</h3>
              <p className="mt-2 text-sm leading-6 text-slate-500">Incluye hero, beneficios, oferta, prueba editable, preguntas frecuentes, CTA final y versión móvil.</p>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
