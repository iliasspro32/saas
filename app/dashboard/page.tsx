import Link from "next/link";
import type React from "react";
import { Copy, CreditCard, History, Wand2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { createAdminClient, requireUser } from "@/lib/supabase/server";

export default async function DashboardPage() {
  const { user } = await requireUser();
  const admin = createAdminClient();
  const [{ data: profile }, { data: credits }, { data: generations }] = await Promise.all([
    admin.from("profiles").select("plan").eq("id", user.id).single(),
    admin.from("credits").select("remaining").eq("user_id", user.id).single(),
    admin.from("generations").select("id,content_type,output,created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(5)
  ]);

  return (
    <div>
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div><h1 className="text-3xl font-black">Dashboard</h1><p className="mt-1 text-slate-500">Your AI content command center.</p></div>
        <Link href="/dashboard/generator"><Button><Wand2 className="h-4 w-4" /> New generation</Button></Link>
      </div>
      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <Metric title="Plan" value={profile?.plan || "free"} icon={CreditCard} />
        <Metric title="Credits remaining" value={credits?.remaining ?? 0} icon={Copy} />
        <Metric title="Recent generations" value={generations?.length ?? 0} icon={History} />
      </div>
      <Card className="mt-6">
        <h2 className="font-bold">Recent content</h2>
        <div className="mt-4 space-y-3">
          {generations?.length ? generations.map((item) => <div key={item.id} className="rounded-lg bg-slate-50 p-4 text-sm dark:bg-slate-950"><div className="font-semibold">{item.content_type}</div><p className="mt-2 line-clamp-2 text-slate-500">{item.output}</p></div>) : <p className="text-sm text-slate-500">No generations yet.</p>}
        </div>
      </Card>
    </div>
  );
}

function Metric({ title, value, icon: Icon }: { title: string; value: string | number; icon: React.ElementType }) {
  return <Card><Icon className="h-5 w-5 text-brand-600" /><p className="mt-4 text-sm text-slate-500">{title}</p><div className="mt-1 text-3xl font-black capitalize">{value}</div></Card>;
}
