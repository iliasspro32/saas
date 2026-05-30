import { NextResponse } from "next/server";
import { cloneVoice } from "@/lib/voice-studio";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const profile = await cloneVoice(await request.json());
    return NextResponse.json({
      success: true,
      message: `Voz '${profile.name}' clonada exitosamente.`,
      profile,
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Fallo en el proceso de clonacion acustica", details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
