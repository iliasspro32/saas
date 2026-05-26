import { AlertTriangle, Inbox, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";

export function LoadingState({ label = "Loading" }: { label?: string }) {
  return <Card className="flex items-center gap-3 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> {label}</Card>;
}

export function EmptyState({ title = "Nothing here yet", text = "Create your first item to see it here." }: { title?: string; text?: string }) {
  return <Card className="text-center"><Inbox className="mx-auto h-8 w-8 text-slate-400" /><h2 className="mt-3 font-bold">{title}</h2><p className="mt-1 text-sm text-slate-500">{text}</p></Card>;
}

export function ErrorState({ title = "Something went wrong", text }: { title?: string; text?: string }) {
  return <Card className="border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-100"><AlertTriangle className="h-5 w-5" /><h2 className="mt-3 font-bold">{title}</h2>{text && <p className="mt-1 text-sm">{text}</p>}</Card>;
}
