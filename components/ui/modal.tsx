"use client";

import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function Modal({ open, title, children, onClose }: { open: boolean; title: string; children: React.ReactNode; onClose: () => void }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/60 p-4">
      <div className={cn("w-full max-w-lg rounded-lg border border-slate-200 bg-white p-6 shadow-soft dark:border-white/10 dark:bg-slate-900")}>
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-lg font-bold">{title}</h2>
          <Button variant="ghost" className="h-9 w-9 px-0" onClick={onClose} aria-label="Close modal"><X className="h-4 w-4" /></Button>
        </div>
        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
}
