import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient, requireAdmin } from "@/lib/supabase/server";
import { toCsv } from "@/lib/utils";

const patchSchema = z.object({
  userId: z.string().uuid(),
  credits: z.number().int().min(0).optional(),
  plan: z.enum(["free", "starter", "pro", "agency"]).optional(),
  banned: z.boolean().optional()
});

export async function GET(request: Request) {
  await requireAdmin();
  const url = new URL(request.url);
  const search = (url.searchParams.get("search") || "").replace(/[%,()]/g, "").slice(0, 80);
  const exportCsv = url.searchParams.get("export") === "csv";
  const admin = createAdminClient();
  let query = admin.from("profiles").select("id,email,full_name,plan,role,banned,created_at,credits(remaining)");
  if (search) query = query.or(`email.ilike.%${search}%,full_name.ilike.%${search}%`);
  const { data, error } = await query.order("created_at", { ascending: false }).limit(250);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (exportCsv) return new Response(toCsv(data as Record<string, unknown>[]), { headers: { "Content-Type": "text/csv" } });
  return NextResponse.json({ users: data });
}

export async function PATCH(request: Request) {
  const { user } = await requireAdmin();
  const parsed = patchSchema.parse(await request.json());
  const admin = createAdminClient();
  const updates: Record<string, unknown> = {};
  if (parsed.plan) updates.plan = parsed.plan;
  if (typeof parsed.banned === "boolean") updates.banned = parsed.banned;
  if (Object.keys(updates).length) await admin.from("profiles").update(updates).eq("id", parsed.userId);
  if (typeof parsed.credits === "number") await admin.from("credits").upsert({ user_id: parsed.userId, remaining: parsed.credits }, { onConflict: "user_id" });
  await admin.from("admin_logs").insert({ admin_id: user.id, action: "update_user", target_id: parsed.userId, metadata: parsed });
  return NextResponse.json({ ok: true });
}
