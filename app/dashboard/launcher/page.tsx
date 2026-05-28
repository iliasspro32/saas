import type React from "react";
import { CheckCircle2, Clock3, Layers3, Rocket, Send, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const platforms = ["Meta", "TikTok", "Snap"];
const rows = [
  ["Prospecting Broad", "Sales", "48", "$1,200/day", "Ready"],
  ["UGC Hook Test", "Traffic", "72", "$860/day", "Ready"],
  ["Cart Recovery", "Sales", "36", "$420/day", "Review"],
  ["Creator Whitelist", "Leads", "24", "$300/day", "Draft"]
];

export default function LauncherPage() {
  return (
    <div className="mx-auto max-w-7xl">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-3xl font-black">Bulk Launcher</h1>
          <p className="mt-1 text-slate-500">Build and publish campaign batches across Meta, TikTok and Snap.</p>
        </div>
        <Button><Send className="h-4 w-4" /> Launch selected</Button>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[420px_1fr]">
        <Card>
          <h2 className="text-xl font-black">Campaign setup</h2>
          <div className="mt-5 space-y-4">
            <Field label="Product URL" value="https://store.com/product/winning-offer" />
            <Field label="Objective" value="Sales / Website conversions" />
            <Field label="Daily budget" value="$2,780" />
            <Field label="Audience stack" value="Broad, lookalike 3%, retargeting 14d" />
            <div>
              <p className="mb-2 text-sm font-bold">Channels</p>
              <div className="grid grid-cols-3 gap-2">
                {platforms.map((platform) => (
                  <button key={platform} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-bold hover:border-brand-500 dark:border-white/10 dark:bg-slate-950">
                    {platform}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-black">Launch matrix</h2>
              <p className="mt-1 text-sm text-slate-500">Preview budget, objective and creative count before publishing.</p>
            </div>
            <Rocket className="h-6 w-6 text-brand-600" />
          </div>
          <div className="mt-5 overflow-hidden rounded-lg border border-slate-200 dark:border-white/10">
            {rows.map(([name, objective, ads, budget, status]) => (
              <div key={name} className="grid gap-3 border-b border-slate-200 p-4 last:border-b-0 dark:border-white/10 md:grid-cols-5">
                <div className="font-bold md:col-span-1">{name}</div>
                <Mini label="Objective" value={objective} />
                <Mini label="Ads" value={ads} />
                <Mini label="Budget" value={budget} />
                <span className="inline-flex w-fit items-center gap-2 rounded-lg bg-mint/10 px-3 py-1 text-sm font-bold text-mint"><CheckCircle2 className="h-4 w-4" /> {status}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <Badge icon={Layers3} title="200+ ads per batch" text="Generate combinations of hooks, angles, formats and placements." />
        <Badge icon={ShieldCheck} title="Budget guardrails" text="Prevent overspend with account, campaign and ad set limits." />
        <Badge icon={Clock3} title="5 minute workflow" text="From URL to approved launch queue without spreadsheet chaos." />
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return <label className="block text-sm font-bold">{label}<input className="mt-2 h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm dark:border-white/10 dark:bg-slate-950" defaultValue={value} /></label>;
}

function Mini({ label, value }: { label: string; value: string }) {
  return <div><p className="text-xs text-slate-500">{label}</p><p className="mt-1 font-black">{value}</p></div>;
}

function Badge({ icon: Icon, title, text }: { icon: React.ElementType; title: string; text: string }) {
  return <Card className="p-5"><Icon className="h-5 w-5 text-brand-600" /><h3 className="mt-4 font-black">{title}</h3><p className="mt-2 text-sm leading-6 text-slate-500">{text}</p></Card>;
}
