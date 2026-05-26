"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function BillingPortalButton() {
  const [loading, setLoading] = useState(false);
  async function openPortal() {
    setLoading(true);
    const response = await fetch("/api/stripe/portal", { method: "POST" });
    const data = await response.json();
    if (data.url) location.href = data.url;
    else setLoading(false);
  }
  return <Button className="mt-5" onClick={openPortal} disabled={loading}>{loading && <Loader2 className="h-4 w-4 animate-spin" />} Open customer portal</Button>;
}
