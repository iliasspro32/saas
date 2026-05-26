"use client";

import { Copy, Download, Loader2, Wand2 } from "lucide-react";
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
    <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
      <Card>
        <form onSubmit={submit} className="space-y-4">
          <Select name="contentType" label="Content type" options={contentTypes.map((item) => ({ value: item.key, label: item.label }))} />
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
          <label className="block text-sm font-medium">Extra context<textarea name="details" maxLength={1200} className="mt-2 min-h-28 w-full rounded-lg border border-slate-200 bg-white p-3 text-sm dark:border-white/10 dark:bg-slate-950" /></label>
          {error && <div className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700 dark:bg-rose-950/40 dark:text-rose-200">{error}</div>}
          <Button className="w-full" disabled={loading}>{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />} Generate</Button>
        </form>
      </Card>
      <Card className="min-h-[620px]">
        <div className="flex items-center justify-between gap-3">
          <div><h2 className="text-lg font-bold">Output</h2><p className="text-sm text-slate-500">Saved to your generation history automatically.</p></div>
          <div className="flex gap-2">
            <Button variant="secondary" className="h-10 px-3" onClick={() => navigator.clipboard.writeText(output)} disabled={!output}><Copy className="h-4 w-4" /></Button>
            <Button variant="secondary" className="h-10 px-3" onClick={download} disabled={!output}><Download className="h-4 w-4" /></Button>
          </div>
        </div>
        <pre className="mt-6 whitespace-pre-wrap rounded-lg bg-slate-50 p-5 text-sm leading-7 text-slate-800 dark:bg-slate-950 dark:text-slate-100">{output || "Your polished AI content will appear here."}</pre>
      </Card>
    </div>
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
