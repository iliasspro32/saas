import { NextResponse } from "next/server";
import { convertVoice } from "@/lib/voice-studio";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    return NextResponse.json(await convertVoice(await request.json()));
  } catch (error) {
    return NextResponse.json(
      { error: "Fallo en la reprogramacion vocal por IA", details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
