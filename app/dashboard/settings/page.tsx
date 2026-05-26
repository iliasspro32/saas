import { Card } from "@/components/ui/card";
import { createAdminClient, requireUser } from "@/lib/supabase/server";

export default async function SettingsPage() {
  const { user } = await requireUser();
  const { data } = await createAdminClient().from("profiles").select("email,full_name,plan,role").eq("id", user.id).single();
  return (
    <div>
      <h1 className="text-3xl font-black">Settings</h1>
      <Card className="mt-6 max-w-2xl">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Email" value={data?.email || user.email || ""} />
          <Field label="Plan" value={data?.plan || "free"} />
          <Field label="Role" value={data?.role || "user"} />
          <Field label="User ID" value={user.id} />
        </div>
      </Card>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return <div><p className="text-sm text-slate-500">{label}</p><p className="mt-1 break-all font-semibold">{value}</p></div>;
}
