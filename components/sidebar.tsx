import Link from "next/link";
import {
  BarChart3,
  Bot,
  CreditCard,
  History,
  LayoutDashboard,
  LayoutTemplate,
  Megaphone,
  Mic2,
  PlugZap,
  Rocket,
  Settings,
  Shield,
  SlidersHorizontal,
  Wand2
} from "lucide-react";

const items = [
  { href: "/dashboard", label: "Command center", icon: LayoutDashboard },
  { href: "/dashboard/generator", label: "Creative Studio", icon: Wand2 },
  { href: "/dashboard/voice", label: "Voice Studio", icon: Mic2 },
  { href: "/dashboard/landing-studio", label: "Landing Studio", icon: LayoutTemplate },
  { href: "/dashboard/launcher", label: "Bulk Launcher", icon: Rocket },
  { href: "/dashboard/copilot", label: "AI Copilot", icon: Bot },
  { href: "/dashboard/rules", label: "Smart Rules", icon: SlidersHorizontal },
  { href: "/dashboard/accounts", label: "Ad Accounts", icon: PlugZap },
  { href: "/dashboard/history", label: "Asset Library", icon: History },
  { href: "/dashboard/billing", label: "Billing", icon: CreditCard },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
  { href: "/admin", label: "Admin", icon: Shield }
];

export function Sidebar() {
  return (
    <aside className="hidden w-72 shrink-0 border-r border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-slate-950 lg:block">
      <Link href="/" className="mb-6 flex items-center gap-3 px-2 text-lg font-black">
        <span className="grid h-10 w-10 place-items-center rounded-lg bg-slate-950 text-white dark:bg-white dark:text-slate-950">
          <Megaphone className="h-5 w-5" />
        </span>
        <span>
          IvoMarket Ads
          <span className="block text-xs font-semibold text-slate-500">AI media buying suite</span>
        </span>
      </Link>
      <div className="mb-5 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
        <div className="flex items-center gap-2 font-bold text-slate-950 dark:text-white"><BarChart3 className="h-4 w-4 text-mint" /> Live workspace</div>
        <div className="mt-2 grid grid-cols-3 gap-2 text-center">
          <span><b className="block text-slate-950 dark:text-white">3</b>Channels</span>
          <span><b className="block text-slate-950 dark:text-white">21</b>Models</span>
          <span><b className="block text-slate-950 dark:text-white">24/7</b>Rules</span>
        </div>
      </div>
      <nav className="space-y-1">
        {items.map((item) => (
          <Link key={item.href} href={item.href} className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white">
            <item.icon className="h-4 w-4" /> {item.label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
