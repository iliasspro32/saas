import Link from "next/link";
import type React from "react";
import { ArrowRight, BadgeCheck, BrainCircuit, LineChart, Lock, Sparkles, Zap } from "lucide-react";
import { PricingCards } from "@/components/pricing-cards";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const features: { title: string; text: string; icon: React.ElementType }[] = [
  { title: "Creator-ready templates", text: "Generate ads, hooks, scripts, captions, offers and digital product ideas in seconds.", icon: Sparkles },
  { title: "Secure AI workflow", text: "All AI calls run through protected server routes with credits, validation and abuse controls.", icon: Lock },
  { title: "Subscription engine", text: "Stripe Checkout, customer portal, webhooks and plan-based feature limits are wired in.", icon: Zap },
  { title: "Admin control center", text: "Manage users, credits, plans, templates, models, revenue and failed API requests.", icon: LineChart },
  { title: "Flexible providers", text: "OpenRouter works now, with a provider interface ready for OpenAI, Anthropic, Gemini and more.", icon: BrainCircuit },
  { title: "Growth dashboard", text: "History, billing, credits and reusable outputs give creators a serious operating system.", icon: BadgeCheck }
];

export default function LandingPage() {
  return (
    <main>
      <section className="premium-grid overflow-hidden">
        <div className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-7xl items-center gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[1.05fr_.95fr]">
          <div>
            <div className="mb-5 inline-flex rounded-full border border-brand-500/20 bg-white/80 px-4 py-2 text-sm font-semibold text-brand-600 dark:bg-slate-900">AI content studio for online sellers</div>
            <h1 className="max-w-4xl text-5xl font-black tracking-normal text-slate-950 dark:text-white sm:text-6xl lg:text-7xl">IvoMarket AI</h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600 dark:text-slate-300">A premium SaaS platform for creators, marketers, PLR sellers and digital product brands to generate high-converting content, save outputs and manage subscriptions securely.</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="/register"><Button className="w-full sm:w-auto">Start generating <ArrowRight className="h-4 w-4" /></Button></Link>
              <Link href="/pricing"><Button variant="secondary" className="w-full sm:w-auto">View pricing</Button></Link>
            </div>
          </div>
          <div className="glass rounded-lg p-4">
            <div className="rounded-lg bg-slate-950 p-5 text-white">
              <div className="flex items-center justify-between border-b border-white/10 pb-4"><span className="font-semibold">AI Generator</span><span className="rounded bg-mint px-2 py-1 text-xs text-slate-950">Live</span></div>
              <div className="mt-5 grid gap-3">
                {["Facebook Ads", "TikTok/Reels Scripts", "Etsy Listings", "Lead Magnets"].map((item) => <div key={item} className="rounded-lg border border-white/10 bg-white/5 p-4">{item}</div>)}
              </div>
              <div className="mt-5 rounded-lg bg-white p-4 text-slate-950">
                <div className="text-sm font-bold">Output preview</div>
                <p className="mt-2 text-sm leading-6 text-slate-600">3 hook angles, 2 CTA variants, polished copy and platform-specific formatting.</p>
              </div>
            </div>
          </div>
        </div>
      </section>
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
        <div className="mb-10 max-w-2xl"><h2 className="text-3xl font-black">Built for serious content operations</h2><p className="mt-3 text-slate-600 dark:text-slate-300">Everything needed to sell subscriptions, protect usage and ship a polished AI product.</p></div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {features.map(({ title, text, icon: Icon }) => <Card key={title}><Icon className="h-6 w-6 text-brand-600" /><h3 className="mt-4 font-bold">{title}</h3><p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{text}</p></Card>)}
        </div>
      </section>
      <section className="bg-slate-950 py-20 text-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6"><h2 className="mb-10 text-3xl font-black">Pricing that scales with creators</h2><PricingCards /></div>
      </section>
      <section className="mx-auto grid max-w-7xl gap-8 px-4 py-20 sm:px-6 lg:grid-cols-2">
        <Card><p className="text-lg font-semibold">&quot;IvoMarket AI replaced five messy prompt docs and gave our content team a repeatable workflow.&quot;</p><p className="mt-4 text-sm text-slate-500">Maya R., digital products founder</p></Card>
        <Card><p className="text-lg font-semibold">&quot;The admin controls, credits and Stripe setup make this feel like a real SaaS from day one.&quot;</p><p className="mt-4 text-sm text-slate-500">Leon T., creator agency owner</p></Card>
      </section>
      <section className="mx-auto max-w-4xl px-4 pb-20 sm:px-6">
        <h2 className="text-3xl font-black">FAQ</h2>
        {["Can I add more AI providers?", "Does it save user history?", "Is it Cloudflare Pages ready?"].map((q) => <details key={q} className="mt-4 rounded-lg border border-slate-200 p-5 dark:border-white/10"><summary className="cursor-pointer font-semibold">{q}</summary><p className="mt-3 text-sm text-slate-600 dark:text-slate-300">Yes. The app includes the structure, database tables and server routes needed for this production workflow.</p></details>)}
      </section>
    </main>
  );
}
