import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { createAdminClient, requireUser } from "@/lib/supabase/server";
import { absoluteUrl } from "@/lib/utils";

export async function POST() {
  try {
    const { user } = await requireUser();
    const admin = createAdminClient();
    const { data: profile } = await admin.from("profiles").select("stripe_customer_id").eq("id", user.id).single();
    if (!profile?.stripe_customer_id) return NextResponse.json({ error: "No Stripe customer found" }, { status: 404 });

    const session = await stripe.billingPortal.sessions.create({
      customer: profile.stripe_customer_id,
      return_url: absoluteUrl("/dashboard/billing")
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Portal failed" }, { status: 400 });
  }
}
