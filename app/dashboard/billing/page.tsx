import { PricingCards } from "@/components/pricing-cards";
import { BillingPortalButton } from "@/components/billing-portal-button";
import { Card } from "@/components/ui/card";
import { createAdminClient, requireUser } from "@/lib/supabase/server";

export default async function BillingPage() {
  const { user } = await requireUser();
  const { data } = await createAdminClient().from("subscriptions").select("*").eq("user_id", user.id).single();
  return (
    <div>
      <h1 className="text-3xl font-black">Billing</h1>
      <Card className="mt-6">
        <p className="text-sm text-slate-500">Current status</p>
        <div className="mt-1 text-2xl font-black capitalize">{data?.plan || "free"} / {data?.status || "inactive"}</div>
        <BillingPortalButton />
      </Card>
      <div className="mt-8"><PricingCards /></div>
    </div>
  );
}
