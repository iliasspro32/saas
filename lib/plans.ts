export const plans = [
  { key: "free", name: "Free", credits: 15, price: "$0", stripePriceId: null, features: ["15 generations", "Core templates", "Community support"] },
  { key: "starter", name: "Starter", credits: 300, price: "$19", stripePriceId: "price_starter", features: ["300 credits monthly", "Premium templates", "History exports"] },
  { key: "pro", name: "Pro", credits: 1200, price: "$49", stripePriceId: "price_pro", features: ["1,200 credits monthly", "All AI models", "Priority generation"] },
  { key: "agency", name: "Agency", credits: 4000, price: "$149", stripePriceId: "price_agency", features: ["4,000 credits monthly", "Team-ready workflows", "Advanced admin exports"] }
] as const;

export type PlanKey = (typeof plans)[number]["key"];
