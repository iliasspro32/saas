import { Sidebar } from "@/components/sidebar";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 overflow-x-hidden bg-slate-50 p-4 dark:bg-slate-950 sm:p-6 lg:p-8">{children}</main>
    </div>
  );
}
