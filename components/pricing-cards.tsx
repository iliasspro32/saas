"use client";

import { Check, Loader2 } from "lucide-react";
import { useState } from "react";
import { plans } from "@/lib/plans";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export function PricingCards() {
  const [loading, setLoading] = useState<string | null>(null);

  async function checkout(plan: string) {
    if (plan === "free") {
      location.href = "/register";
      return;
    }
    setLoading(plan);
    const response = await fetch("/api/stripe/checkout", { method: "POST", body: JSON.stringify({ plan }) });
    const data = await response.json();
    if (data.url) location.href = data.url;
    else if (data.error === "Unauthorized") location.href = `/login?next=/pricing`;
    else setLoading(null);
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {plans.map((plan) => (
        <Card key={plan.key} className={plan.key === "pro" ? "border-brand-500 shadow-soft" : ""}>
          <div className="text-sm font-semibold text-brand-600">{plan.name}</div>
          <div className="mt-3 text-4xl font-black">{plan.price}<span className="text-sm font-medium text-slate-500">/mo</span></div>
          <div className="mt-2 text-sm text-slate-500">{plan.credits.toLocaleString()} monthly credits</div>
          <ul className="mt-6 space-y-3 text-sm">
            {plan.features.map((feature) => <li key={feature} className="flex gap-2"><Check className="h-4 w-4 text-mint" /> {feature}</li>)}
          </ul>
          <Button className="mt-8 w-full" onClick={() => checkout(plan.key)} disabled={loading === plan.key}>
            {loading === plan.key && <Loader2 className="h-4 w-4 animate-spin" />} Choose {plan.name}
          </Button>
        </Card>
      ))}
    </div>
  );
}
