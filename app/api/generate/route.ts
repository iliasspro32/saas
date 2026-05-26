import { NextResponse, type NextRequest } from "next/server";
import { contentTypes, buildPrompt } from "@/lib/ai/templates";
import { generationSchema, getProvider } from "@/lib/ai/providers";
import { rateLimit } from "@/lib/rate-limit";
import { createAdminClient, requireUser } from "@/lib/supabase/server";
import { sanitizeText } from "@/lib/utils";

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for") || "local";
  const limited = rateLimit(`generate:${ip}`, 12, 60_000);
  if (!limited.ok) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

  try {
    const { user } = await requireUser();
    const parsed = generationSchema.parse(await request.json());
    const admin = createAdminClient();

    const { data: profile } = await admin.from("profiles").select("id,banned,plan").eq("id", user.id).single();
    if (profile?.banned) return NextResponse.json({ error: "Account is banned" }, { status: 403 });

    const { data: credits } = await admin.from("credits").select("remaining").eq("user_id", user.id).single();
    if (!credits || credits.remaining < 1) return NextResponse.json({ error: "No credits remaining" }, { status: 402 });

    const template = contentTypes.find((item) => item.key === parsed.contentType || item.label === parsed.contentType);
    if (!template) return NextResponse.json({ error: "Invalid content type" }, { status: 400 });

    const safe = {
      ...parsed,
      niche: sanitizeText(parsed.niche, 160),
      audience: sanitizeText(parsed.audience, 220),
      details: sanitizeText(parsed.details || "", 1200)
    };
    const prompt = buildPrompt({ ...safe, templateLabel: template.label, templatePrompt: template.prompt });
    const provider = getProvider("openrouter");

    const started = Date.now();
    const result = await provider.generate({ ...safe, prompt, maxTokens: 2200 });
    const latencyMs = Date.now() - started;
    if (!result.output) throw new Error("AI provider returned an empty response");

    const { data: generation, error: generationError } = await admin
      .from("generations")
      .insert({
        user_id: user.id,
        content_type: template.key,
        provider: provider.name,
        model: safe.model,
        input: safe,
        output: result.output,
        tokens_used: result.tokens
      })
      .select()
      .single();
    if (generationError) throw generationError;

    await admin.rpc("deduct_credit", { p_user_id: user.id, p_amount: 1 });
    await admin.from("api_usage").insert({
      user_id: user.id,
      provider: provider.name,
      model: safe.model,
      tokens_used: result.tokens,
      latency_ms: latencyMs,
      status: "success"
    });

    return NextResponse.json({ generation });
  } catch (error) {
    const admin = createAdminClient();
    await admin.from("api_usage").insert({
      provider: "openrouter",
      status: "failed",
      error_message: error instanceof Error ? error.message.slice(0, 500) : "Unknown error"
    });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Generation failed" }, { status: 400 });
  }
}
