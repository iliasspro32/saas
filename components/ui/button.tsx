import * as React from "react";
import { cn } from "@/lib/utils";

export function Button({ className, variant = "primary", ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost" | "danger" }) {
  return (
    <button
      className={cn(
        "focus-ring inline-flex h-11 items-center justify-center gap-2 rounded-lg px-5 text-sm font-semibold transition",
        variant === "primary" && "bg-brand-600 text-white shadow-lg shadow-brand-600/20 hover:bg-brand-500",
        variant === "secondary" && "border border-slate-200 bg-white text-slate-950 hover:bg-slate-50 dark:border-white/10 dark:bg-slate-900 dark:text-white",
        variant === "ghost" && "text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-white/10",
        variant === "danger" && "bg-rose-600 text-white hover:bg-rose-500",
        className
      )}
      {...props}
    />
  );
}
