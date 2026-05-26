import { NextResponse } from "next/server";
import { z } from "zod";
import { plans } from "@/lib/plans";
import { stripe } from "@/lib/stripe";
import { createAdminClient, requireUser } from "@/lib/supabase/server";
import { absoluteUrl } from "@/lib/utils";

const schema = z.object({ plan: z.enum(["starter", "pro", "agency"]) });

export async function POST(request: Request) {
  try {
    const { user } = await requireUser();
    const { plan: planKey } = schema.parse(await request.json());
    const plan = plans.find((item) => item.key === planKey);
    if (!plan?.stripePriceId) return NextResponse.json({ error: "Invalid plan" }, { status: 400 });

    const admin = createAdminClient();
    const { data: profile } = await admin.from("profiles").select("stripe_customer_id,email").eq("id", user.id).single();
    let customerId = profile?.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({ email: user.email || profile?.email, metadata: { user_id: user.id } });
      customerId = customer.id;
      await admin.from("profiles").update({ stripe_customer_id: customerId }).eq("id", user.id);
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: plan.stripePriceId, quantity: 1 }],
      success_url: absoluteUrl("/dashboard/billing?success=1"),
      cancel_url: absoluteUrl("/pricing?canceled=1"),
      metadata: { user_id: user.id, plan: plan.key },
      subscription_data: { metadata: { user_id: user.id, plan: plan.key } }
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Checkout failed" }, { status: 400 });
  }
}
