"use client";

import Link from "next/link";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const [error, setError] = useState("");
  const supabase = createClient();

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email"));
    const password = String(form.get("password"));
    const result = mode === "login"
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password, options: { emailRedirectTo: `${location.origin}/dashboard` } });
    if (result.error) setError(result.error.message);
    else location.href = "/dashboard";
  }

  return (
    <main className="grid min-h-screen place-items-center px-4 py-12">
      <Card className="w-full max-w-md">
        <h1 className="text-2xl font-black">{mode === "login" ? "Welcome back" : "Create your account"}</h1>
        <form onSubmit={submit} className="mt-6 space-y-4">
          <label className="block text-sm font-medium">Email<input name="email" type="email" required className="mt-2 h-11 w-full rounded-lg border border-slate-200 bg-white px-3 dark:border-white/10 dark:bg-slate-950" /></label>
          <label className="block text-sm font-medium">Password<input name="password" type="password" required minLength={8} className="mt-2 h-11 w-full rounded-lg border border-slate-200 bg-white px-3 dark:border-white/10 dark:bg-slate-950" /></label>
          {error && <div className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700 dark:bg-rose-950/40 dark:text-rose-200">{error}</div>}
          <Button className="w-full">{mode === "login" ? "Login" : "Register"}</Button>
        </form>
        <p className="mt-5 text-sm text-slate-500">{mode === "login" ? "No account yet?" : "Already have an account?"} <Link className="font-semibold text-brand-600" href={mode === "login" ? "/register" : "/login"}>{mode === "login" ? "Register" : "Login"}</Link></p>
      </Card>
    </main>
  );
}
