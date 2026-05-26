import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient, requireAdmin } from "@/lib/supabase/server";

const schema = z.object({
  table: z.enum(["ai_templates", "ai_models", "plans", "content_categories", "settings"]),
  values: z.record(z.unknown())
});

export async function PATCH(request: Request) {
  const { user } = await requireAdmin();
  const parsed = schema.parse(await request.json());
  const admin = createAdminClient();
  const { error } = await admin.from(parsed.table).upsert(parsed.values);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  await admin.from("admin_logs").insert({ admin_id: user.id, action: `upsert_${parsed.table}`, metadata: parsed.values });
  return NextResponse.json({ ok: true });
}
