import Link from "next/link";
import type React from "react";
import {
  Activity,
  ArrowUpRight,
  Bot,
  CheckCircle2,
  Clock3,
  Copy,
  CreditCard,
  History,
  Megaphone,
  PauseCircle,
  PlayCircle,
  Rocket,
  Sparkles,
  TrendingUp,
  Wand2
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { createAdminClient, requireUser } from "@/lib/supabase/server";

const channelRows = [
  { name: "Meta", spend: "$42,180", roas: "3.8x", cpa: "$18.40", status: "Scaling", color: "bg-blue-500" },
  { name: "TikTok", spend: "$18,930", roas: "2.9x", cpa: "$22.15", status: "Testing", color: "bg-slate-950 dark:bg-white" },
  { name: "Snap", spend: "$9,440", roas: "4.2x", cpa: "$15.80", status: "Protected", color: "bg-amber-500" }
];

const copilotItems = [
  "Paused 14 ad sets after CPA crossed the guardrail for 2 hours.",
  "Found 3 winning hooks in Spanish UGC creatives with 38% lower CPC.",
  "Recommended +18% budget on Meta Broad Advantage campaign."
];

const launchQueue = [
  { name: "UGC - Problem/Solution", platform: "Meta + TikTok", ads: 64, state: "Ready" },
  { name: "Snap Ramadan Offer", platform: "Snap", ads: 32, state: "Review" },
  { name: "Retargeting Angles", platform: "Meta", ads: 28, state: "Draft" }
];

export default async function DashboardPage() {
  const { user } = await requireUser();
  const admin = createAdminClient();
  const [{ data: profile }, { data: credits }, { data: generations }] = await Promise.all([
    admin.from("profiles").select("plan").eq("id", user.id).single(),
    admin.from("credits").select("remaining").eq("user_id", user.id).single(),
    admin.from("generations").select("id,content_type,output,created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(5)
  ]);

  return (
    <div className="mx-auto max-w-7xl">
      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-slate-900">
        <div className="grid gap-0 lg:grid-cols-[1fr_360px]">
          <div className="p-6 sm:p-8">
            <div className="flex flex-wrap items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-500">
              <span className="rounded-lg bg-mint/10 px-3 py-1 text-mint">AI media buyer</span>
              <span>Meta</span>
              <span>TikTok</span>
              <span>Snap</span>
            </div>
            <h1 className="mt-5 max-w-3xl text-4xl font-black leading-tight text-slate-950 dark:text-white sm:text-5xl">
              Create ads, launch campaigns, and scale winners from one command center.
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600 dark:text-slate-300">
              Built as an AdSkull-style SaaS: creative studio, bulk launcher, smart rules, AI copilot, accounts, billing and asset history in a sharper interface.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/dashboard/generator"><Button><Wand2 className="h-4 w-4" /> Create creatives</Button></Link>
              <Link href="/dashboard/launcher"><Button variant="secondary"><Rocket className="h-4 w-4" /> Open launcher</Button></Link>
              <Link href="/dashboard/copilot"><Button variant="ghost"><Bot className="h-4 w-4" /> Ask copilot</Button></Link>
            </div>
          </div>
          <div className="border-t border-slate-200 bg-slate-950 p-6 text-white dark:border-white/10 lg:border-l lg:border-t-0">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">Automation status</p>
                <h2 className="mt-1 text-2xl font-black">Live optimization</h2>
              </div>
              <Activity className="h-6 w-6 text-mint" />
            </div>
            <div className="mt-6 space-y-3">
              {copilotItems.map((item) => (
                <div key={item} className="rounded-lg border border-white/10 bg-white/5 p-3 text-sm leading-6 text-slate-200">
                  <CheckCircle2 className="mr-2 inline h-4 w-4 text-mint" /> {item}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Metric title="Plan" value={profile?.plan || "free"} icon={CreditCard} />
        <Metric title="AI credits" value={credits?.remaining ?? 0} icon={Copy} />
        <Metric title="Campaigns queued" value="124" icon={Rocket} />
        <Metric title="Projected ROAS" value="3.7x" icon={TrendingUp} />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.25fr_.75fr]">
        <Card>
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div>
              <h2 className="text-xl font-black">Performance cockpit</h2>
              <p className="mt-1 text-sm text-slate-500">Unified readout across connected paid social channels.</p>
            </div>
            <Link href="/dashboard/accounts" className="inline-flex items-center gap-2 text-sm font-bold text-brand-600">Connect accounts <ArrowUpRight className="h-4 w-4" /></Link>
          </div>
          <div className="mt-5 overflow-hidden rounded-lg border border-slate-200 dark:border-white/10">
            {channelRows.map((row) => (
              <div key={row.name} className="grid grid-cols-2 gap-4 border-b border-slate-200 p-4 last:border-b-0 dark:border-white/10 sm:grid-cols-5">
                <div className="flex items-center gap-3 font-bold"><span className={`h-3 w-3 rounded-full ${row.color}`} />{row.name}</div>
                <Stat label="Spend" value={row.spend} />
                <Stat label="ROAS" value={row.roas} />
                <Stat label="CPA" value={row.cpa} />
                <div className="text-sm font-bold text-mint">{row.status}</div>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <h2 className="text-xl font-black">Launch queue</h2>
          <p className="mt-1 text-sm text-slate-500">Campaign batches prepared for approval.</p>
          <div className="mt-5 space-y-3">
            {launchQueue.map((item) => (
              <div key={item.name} className="rounded-lg border border-slate-200 p-4 dark:border-white/10">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-bold">{item.name}</h3>
                    <p className="mt-1 text-sm text-slate-500">{item.platform} · {item.ads} ads</p>
                  </div>
                  <span className="rounded-lg bg-slate-100 px-2 py-1 text-xs font-bold dark:bg-white/10">{item.state}</span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <h2 className="text-xl font-black">Recent creative history</h2>
          <div className="mt-4 space-y-3">
            {generations?.length ? generations.map((item) => (
              <div key={item.id} className="rounded-lg bg-slate-50 p-4 text-sm dark:bg-slate-950">
                <div className="font-semibold">{item.content_type}</div>
                <p className="mt-2 line-clamp-2 text-slate-500">{item.output}</p>
              </div>
            )) : <p className="text-sm text-slate-500">No generations yet. Start in Creative Studio.</p>}
          </div>
        </Card>
        <Card>
          <h2 className="text-xl font-black">Smart rule engine</h2>
          <div className="mt-5 space-y-4">
            <Rule icon={PauseCircle} title="Pause losers" text="CPA above target after 1,000 impressions." />
            <Rule icon={PlayCircle} title="Scale winners" text="ROAS above 3.5x for 6 hours." />
            <Rule icon={Clock3} title="Hourly scan" text="Copilot checks account changes every hour." />
          </div>
        </Card>
      </div>
    </div>
  );
}

function Metric({ title, value, icon: Icon }: { title: string; value: string | number; icon: React.ElementType }) {
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <Icon className="h-5 w-5 text-brand-600" />
        <Sparkles className="h-4 w-4 text-gold" />
      </div>
      <p className="mt-4 text-sm text-slate-500">{title}</p>
      <div className="mt-1 text-3xl font-black capitalize">{value}</div>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div><p className="text-xs text-slate-500">{label}</p><p className="mt-1 font-black">{value}</p></div>;
}

function Rule({ icon: Icon, title, text }: { icon: React.ElementType; title: string; text: string }) {
  return (
    <div className="flex gap-3">
      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-slate-100 dark:bg-white/10"><Icon className="h-5 w-5 text-brand-600" /></div>
      <div><h3 className="font-bold">{title}</h3><p className="mt-1 text-sm leading-6 text-slate-500">{text}</p></div>
    </div>
  );
}
