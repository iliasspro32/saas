import { NextResponse } from "next/server";
import { listVoices } from "@/lib/voice-studio";

export const runtime = "nodejs";

export function GET() {
  return NextResponse.json(listVoices());
}
