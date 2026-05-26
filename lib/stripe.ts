import Stripe from "stripe";

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "sk_test_missing", {
  apiVersion: "2026-02-25.clover" as Stripe.LatestApiVersion,
  httpClient: Stripe.createFetchHttpClient(),
  typescript: true
});
