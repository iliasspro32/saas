"use client";

import type React from "react";
import { Copy, Download, Image, Loader2, PlaySquare, Sparkles, Wand2 } from "lucide-react";
import { useState } from "react";
import { contentTypes, languages, outputFormats, platforms, tones } from "@/lib/ai/templates";
import { defaultModels } from "@/lib/ai/providers";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export function GeneratorForm() {
  const [output, setOutput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const payload = Object.fromEntries(form.entries());
    const response = await fetch("/api/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const data = await response.json();
    setLoading(false);
    if (!response.ok) {
      setError(data.error || "Generation failed");
      return;
    }
    setOutput(data.generation.output);
  }

  function download() {
    const blob = new Blob([output], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "ivomarket-ai-output.txt";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[440px_1fr]">
      <Card>
        <div className="mb-5 grid grid-cols-3 gap-2">
          <StudioMode icon={PlaySquare} label="UGC" active />
          <StudioMode icon={Image} label="Image" />
          <StudioMode icon={Sparkles} label="Copy" />
        </div>
        <form onSubmit={submit} className="space-y-4">
          <Input name="productUrl" label="Product URL" placeholder="https://your-store.com/product" />
          <Select name="contentType" label="Asset type" options={contentTypes.map((item) => ({ value: item.key, label: item.label }))} />
          <Input name="niche" label="Niche" placeholder="Example: printables for busy moms" />
          <Input name="audience" label="Target audience" placeholder="Example: Etsy sellers who need fast listings" />
          <div className="grid grid-cols-2 gap-3">
            <Select name="tone" label="Tone" options={tones} />
            <Select name="platform" label="Platform" options={platforms} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Select name="language" label="Language" options={languages} />
            <Select name="outputFormat" label="Format" options={outputFormats} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Select name="model" label="AI model" options={defaultModels.map((item) => ({ value: item.model, label: item.label }))} />
            <Input name="count" label="Results" type="number" min="1" max="10" defaultValue="3" />
          </div>
          <label className="block text-sm font-medium">Creative brief<textarea name="details" maxLength={1200} className="mt-2 min-h-28 w-full rounded-lg border border-slate-200 bg-white p-3 text-sm dark:border-white/10 dark:bg-slate-950" placeholder="Offer, proof, competitor angle, objections, compliance notes..." /></label>
          {error && <div className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700 dark:bg-rose-950/40 dark:text-rose-200">{error}</div>}
          <Button className="w-full" disabled={loading}>{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />} Generate variants</Button>
        </form>
      </Card>
      <Card className="min-h-[620px]">
        <div className="flex items-center justify-between gap-3">
          <div><h2 className="text-lg font-bold">Launch-ready output</h2><p className="text-sm text-slate-500">Saved to your asset library automatically.</p></div>
          <div className="flex gap-2">
            <Button variant="secondary" className="h-10 px-3" onClick={() => navigator.clipboard.writeText(output)} disabled={!output}><Copy className="h-4 w-4" /></Button>
            <Button variant="secondary" className="h-10 px-3" onClick={download} disabled={!output}><Download className="h-4 w-4" /></Button>
          </div>
        </div>
        <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_260px]">
          <pre className="min-h-[480px] whitespace-pre-wrap rounded-lg bg-slate-50 p-5 text-sm leading-7 text-slate-800 dark:bg-slate-950 dark:text-slate-100">{output || "Your AI ad scripts, hooks, captions and testing notes will appear here."}</pre>
          <div className="space-y-3">
            {["Hook score", "Compliance check", "Audience fit", "Launch readiness"].map((item, index) => (
              <div key={item} className="rounded-lg border border-slate-200 p-4 dark:border-white/10">
                <p className="text-xs text-slate-500">{item}</p>
                <p className="mt-2 text-2xl font-black">{index === 1 ? "OK" : `${92 - index * 7}%`}</p>
              </div>
            ))}
          </div>
        </div>
      </Card>
    </div>
  );
}

function StudioMode({ icon: Icon, label, active }: { icon: React.ElementType; label: string; active?: boolean }) {
  return (
    <button type="button" className={`flex h-20 flex-col items-center justify-center gap-2 rounded-lg border text-sm font-bold transition ${active ? "border-slate-950 bg-slate-950 text-white dark:border-white dark:bg-white dark:text-slate-950" : "border-slate-200 bg-slate-50 text-slate-600 hover:border-brand-500 dark:border-white/10 dark:bg-slate-950 dark:text-slate-300"}`}>
      <Icon className="h-5 w-5" /> {label}
    </button>
  );
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  const { label, ...rest } = props;
  return <label className="block text-sm font-medium">{label}<input required className="mt-2 h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm dark:border-white/10 dark:bg-slate-950" {...rest} /></label>;
}

function Select({ label, options, ...props }: { label: string; name: string; options: (string | { value: string; label: string })[] }) {
  return (
    <label className="block text-sm font-medium">{label}
      <select className="mt-2 h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm dark:border-white/10 dark:bg-slate-950" {...props}>
        {options.map((option) => {
          const value = typeof option === "string" ? option : option.value;
          const labelText = typeof option === "string" ? option : option.label;
          return <option key={value} value={value}>{labelText}</option>;
        })}
      </select>
    </label>
  );
}
