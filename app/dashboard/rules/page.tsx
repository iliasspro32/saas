import { PauseCircle, PlayCircle, Plus, ShieldAlert, SlidersHorizontal, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const rules = [
  { name: "Pause ad set when CPA rises above target", condition: "CPA > $24 for 2 hours", action: "Pause ad set", icon: PauseCircle, active: true },
  { name: "Scale winner gradually", condition: "ROAS > 3.5x and spend > $300", action: "Increase budget 18%", icon: PlayCircle, active: true },
  { name: "Fatigue protection", condition: "Frequency > 3.2 and CTR drops 25%", action: "Rotate creative", icon: ShieldAlert, active: true },
  { name: "Creative discovery", condition: "CPC below account average", action: "Duplicate into test campaign", icon: Zap, active: false }
];

export default function RulesPage() {
  return (
    <div className="mx-auto max-w-7xl">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-3xl font-black">Smart Rules</h1>
          <p className="mt-1 text-slate-500">Automate budget protection, winner scaling and creative rotation.</p>
        </div>
        <Button><Plus className="h-4 w-4" /> New rule</Button>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_360px]">
        <Card>
          <div className="space-y-3">
            {rules.map((rule) => (
              <div key={rule.name} className="grid gap-4 rounded-lg border border-slate-200 p-4 dark:border-white/10 md:grid-cols-[44px_1fr_1fr_120px] md:items-center">
                <div className="grid h-11 w-11 place-items-center rounded-lg bg-slate-100 dark:bg-white/10"><rule.icon className="h-5 w-5 text-brand-600" /></div>
                <div>
                  <h2 className="font-black">{rule.name}</h2>
                  <p className="mt-1 text-sm text-slate-500">{rule.condition}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Action</p>
                  <p className="mt-1 font-bold">{rule.action}</p>
                </div>
                <span className={`w-fit rounded-lg px-3 py-1 text-sm font-bold ${rule.active ? "bg-mint/10 text-mint" : "bg-slate-100 text-slate-500 dark:bg-white/10"}`}>{rule.active ? "Active" : "Paused"}</span>
              </div>
            ))}
          </div>
        </Card>
        <Card>
          <SlidersHorizontal className="h-6 w-6 text-brand-600" />
          <h2 className="mt-4 text-xl font-black">Rule builder</h2>
          <div className="mt-5 space-y-4">
            <Input label="Metric" value="ROAS" />
            <Input label="Condition" value="Greater than 3.5x for 6 hours" />
            <Input label="Action" value="Increase budget by 15%" />
            <Button className="w-full">Save automation</Button>
          </div>
        </Card>
      </div>
    </div>
  );
}

function Input({ label, value }: { label: string; value: string }) {
  return <label className="block text-sm font-bold">{label}<input className="mt-2 h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm dark:border-white/10 dark:bg-slate-950" defaultValue={value} /></label>;
}
