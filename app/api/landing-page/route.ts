import { NextResponse } from "next/server";
import { landingPageSchema, generateLandingPage } from "@/lib/landing-page";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for") || "local";
  const limited = rateLimit(`landing-page:${ip}`, 6, 60_000);
  if (!limited.ok) return NextResponse.json({ error: "Demasiadas solicitudes. Espera un minuto." }, { status: 429 });

  try {
    const input = landingPageSchema.parse(await request.json());
    return NextResponse.json(await generateLandingPage(input));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo generar la landing page." },
      { status: 400 },
    );
  }
}
