import { GeneratorForm } from "@/components/generator-form";

export default function GeneratorPage() {
  return (
    <div>
      <h1 className="text-3xl font-black">AI Generator</h1>
      <p className="mt-1 text-slate-500">Create creator and marketing assets with saved history and credit controls.</p>
      <div className="mt-6"><GeneratorForm /></div>
    </div>
  );
}
