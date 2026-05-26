import { Card } from "@/components/ui/card";
import { createAdminClient, requireUser } from "@/lib/supabase/server";

export default async function HistoryPage() {
  const { user } = await requireUser();
  const { data } = await createAdminClient().from("generations").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(100);
  return (
    <div>
      <h1 className="text-3xl font-black">History</h1>
      <div className="mt-6 space-y-4">
        {data?.length ? data.map((item) => <Card key={item.id}><div className="flex justify-between gap-4"><h2 className="font-bold">{item.content_type}</h2><span className="text-xs text-slate-500">{new Date(item.created_at).toLocaleString()}</span></div><pre className="mt-4 whitespace-pre-wrap text-sm leading-6 text-slate-700 dark:text-slate-200">{item.output}</pre></Card>) : <Card>No saved generations yet.</Card>}
      </div>
    </div>
  );
}
