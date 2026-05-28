import { GeneratorForm } from "@/components/generator-form";

export default function GeneratorPage() {
  return (
    <div className="mx-auto max-w-7xl">
      <h1 className="text-3xl font-black">Creative Studio</h1>
      <p className="mt-1 text-slate-500">Generate UGC scripts, ad angles, hooks, landing copy and launch-ready variants.</p>
      <div className="mt-6"><GeneratorForm /></div>
    </div>
  );
}
