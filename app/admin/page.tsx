import { Card } from "@/components/ui/card";
import { createAdminClient, requireAdmin } from "@/lib/supabase/server";

export default async function AdminPage() {
  await requireAdmin();
  const admin = createAdminClient();
  const [{ count: users }, { count: generations }, { data: payments }, { data: usage }, { data: templates }, { data: models }, { data: categories }] = await Promise.all([
    admin.from("profiles").select("*", { count: "exact", head: true }),
    admin.from("generations").select("*", { count: "exact", head: true }),
    admin.from("payments").select("amount,status,created_at").order("created_at", { ascending: false }).limit(20),
    admin.from("api_usage").select("*").order("created_at", { ascending: false }).limit(20),
    admin.from("ai_templates").select("*").limit(50),
    admin.from("ai_models").select("*").limit(50),
    admin.from("content_categories").select("*").limit(50)
  ]);
  const revenue = payments?.filter((p) => p.status === "paid").reduce((sum, p) => sum + Number(p.amount || 0), 0) || 0;

  return (
    <div>
      <h1 className="text-3xl font-black">Admin dashboard</h1>
      <div className="mt-6 grid gap-4 md:grid-cols-4">
        <Metric title="Users" value={users || 0} />
        <Metric title="Generations" value={generations || 0} />
        <Metric title="Revenue" value={`$${(revenue / 100).toFixed(2)}`} />
        <Metric title="Failed API calls" value={usage?.filter((u) => u.status === "failed").length || 0} />
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <AdminTable title="API usage" rows={usage || []} />
        <AdminTable title="Payments" rows={payments || []} />
        <AdminTable title="Prompt templates" rows={templates || []} />
        <AdminTable title="AI models" rows={models || []} />
        <AdminTable title="Content categories" rows={categories || []} />
      </div>
    </div>
  );
}

function Metric({ title, value }: { title: string; value: string | number }) {
  return <Card><p className="text-sm text-slate-500">{title}</p><div className="mt-2 text-3xl font-black">{value}</div></Card>;
}

function AdminTable({ title, rows }: { title: string; rows: Record<string, unknown>[] }) {
  const keys = rows[0] ? Object.keys(rows[0]).slice(0, 4) : [];
  return <Card><div className="flex items-center justify-between"><h2 className="font-bold">{title}</h2><a className="text-sm font-semibold text-brand-600" href="/api/admin/users?export=csv">Export users CSV</a></div><div className="mt-4 overflow-x-auto"><table className="w-full text-left text-sm"><tbody>{rows.length ? rows.map((row, index) => <tr key={index} className="border-t border-slate-100 dark:border-white/10">{keys.map((key) => <td key={key} className="max-w-48 truncate py-3 pr-4">{String(row[key] ?? "")}</td>)}</tr>) : <tr><td className="py-4 text-slate-500">No data yet.</td></tr>}</tbody></table></div></Card>;
}
