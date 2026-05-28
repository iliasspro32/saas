import { Sidebar } from "@/components/sidebar";
import { Bot, Menu, Rocket, Wand2 } from "lucide-react";
import Link from "next/link";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-slate-950">
      <Sidebar />
      <main className="flex-1 overflow-x-hidden">
        <div className="sticky top-0 z-20 flex items-center justify-between border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur dark:border-white/10 dark:bg-slate-950/90 lg:hidden">
          <Link href="/dashboard" className="font-black">IvoMarket Ads</Link>
          <div className="flex items-center gap-1">
            <Link href="/dashboard/generator" className="grid h-10 w-10 place-items-center rounded-lg text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/10"><Wand2 className="h-5 w-5" /></Link>
            <Link href="/dashboard/launcher" className="grid h-10 w-10 place-items-center rounded-lg text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/10"><Rocket className="h-5 w-5" /></Link>
            <Link href="/dashboard/copilot" className="grid h-10 w-10 place-items-center rounded-lg text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/10"><Bot className="h-5 w-5" /></Link>
            <Menu className="h-5 w-5 text-slate-400" />
          </div>
        </div>
        <div className="p-4 sm:p-6 lg:p-8">{children}</div>
      </main>
    </div>
  );
}
