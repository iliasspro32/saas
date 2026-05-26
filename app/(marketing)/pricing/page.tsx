import { PricingCards } from "@/components/pricing-cards";

export default function PricingPage() {
  return (
    <main className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
      <h1 className="text-4xl font-black">Pricing</h1>
      <p className="mt-3 max-w-2xl text-slate-600 dark:text-slate-300">Start free, then upgrade when your content pipeline needs more credits and premium models.</p>
      <div className="mt-10"><PricingCards /></div>
    </main>
  );
}
