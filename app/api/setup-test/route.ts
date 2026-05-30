import { NextResponse } from "next/server";
import { getSetupStatus } from "@/lib/voice-studio";

export const runtime = "nodejs";

export function GET() {
  return NextResponse.json(getSetupStatus());
}
