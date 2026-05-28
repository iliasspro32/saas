import { CheckCircle2, KeyRound, PlugZap, RefreshCw, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const accounts = [
  { platform: "Meta", name: "DTC Spain - Main", status: "Connected", spend: "$42,180" },
  { platform: "TikTok", name: "Creator Testing EU", status: "Connected", spend: "$18,930" },
  { platform: "Snap", name: "MENA Scale", status: "Connected", spend: "$9,440" },
  { platform: "Meta", name: "Agency Sandbox", status: "Needs OAuth", spend: "$0" }
];

export default function AccountsPage() {
  return (
    <div className="mx-auto max-w-7xl">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-3xl font-black">Ad Accounts</h1>
          <p className="mt-1 text-slate-500">Connect and monitor OAuth access for every workspace account.</p>
        </div>
        <Button><PlugZap className="h-4 w-4" /> Connect account</Button>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_360px]">
        <Card>
          <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-white/10">
            {accounts.map((account) => (
              <div key={account.name} className="grid gap-3 border-b border-slate-200 p-4 last:border-b-0 dark:border-white/10 md:grid-cols-5 md:items-center">
                <div className="font-black">{account.platform}</div>
                <div className="md:col-span-2">
                  <p className="font-bold">{account.name}</p>
                  <p className="mt-1 text-sm text-slate-500">Monthly spend {account.spend}</p>
                </div>
                <span className={`w-fit rounded-lg px-3 py-1 text-sm font-bold ${account.status === "Connected" ? "bg-mint/10 text-mint" : "bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300"}`}>{account.status}</span>
                <Button variant="secondary" className="h-10 px-3"><RefreshCw className="h-4 w-4" /> Sync</Button>
              </div>
            ))}
          </div>
        </Card>
        <div className="space-y-6">
          <Card>
            <ShieldCheck className="h-6 w-6 text-brand-600" />
            <h2 className="mt-4 text-xl font-black">Secure by design</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">Use official OAuth flows, scoped permissions, encrypted tokens and role-based access.</p>
          </Card>
          <Card>
            <KeyRound className="h-6 w-6 text-brand-600" />
            <h2 className="mt-4 text-xl font-black">Permission checklist</h2>
            <div className="mt-4 space-y-3 text-sm">
              {["Read campaigns", "Publish ads", "Manage budgets", "View reporting"].map((item) => (
                <p key={item} className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-mint" /> {item}</p>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
