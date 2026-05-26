import { headers } from "next/headers";
import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { plans } from "@/lib/plans";
import { stripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const body = await request.text();
  const signature = (await headers()).get("stripe-signature");
  if (!signature || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Missing webhook signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, signature, process.env.STRIPE_WEBHOOK_SECRET);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const admin = createAdminClient();

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const userId = session.metadata?.user_id;
    const planKey = session.metadata?.plan || "starter";
    if (userId) {
      await admin.from("subscriptions").upsert({
        user_id: userId,
        stripe_customer_id: String(session.customer),
        stripe_subscription_id: String(session.subscription),
        plan: planKey,
        status: "active"
      }, { onConflict: "user_id" });
      await admin.from("profiles").update({ plan: planKey }).eq("id", userId);
      const plan = plans.find((item) => item.key === planKey);
      if (plan) await admin.rpc("grant_credits", { p_user_id: userId, p_amount: plan.credits });
    }
  }

  if (event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted") {
    const subscription = event.data.object as Stripe.Subscription;
    const userId = subscription.metadata?.user_id;
    const planKey = subscription.metadata?.plan || "free";
    if (userId) {
      await admin.from("subscriptions").upsert({
        user_id: userId,
        stripe_customer_id: String(subscription.customer),
        stripe_subscription_id: subscription.id,
        plan: planKey,
        status: subscription.status,
        current_period_end: new Date(subscription.current_period_end * 1000).toISOString()
      }, { onConflict: "user_id" });
      await admin.from("profiles").update({ plan: subscription.status === "active" ? planKey : "free" }).eq("id", userId);
    }
  }

  if (event.type === "invoice.payment_succeeded" || event.type === "invoice.payment_failed") {
    const invoice = event.data.object as Stripe.Invoice;
    await admin.from("payments").insert({
      stripe_invoice_id: invoice.id,
      stripe_customer_id: String(invoice.customer),
      amount: invoice.amount_paid || invoice.amount_due,
      currency: invoice.currency,
      status: invoice.status || event.type
    });
  }

  return NextResponse.json({ received: true });
}
