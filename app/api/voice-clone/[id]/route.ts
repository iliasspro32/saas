import { NextResponse } from "next/server";
import { deleteClonedVoice } from "@/lib/voice-studio";

export const runtime = "nodejs";

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (deleteClonedVoice(id)) {
    return NextResponse.json({ success: true, message: "Perfil de voz borrado correctamente." });
  }
  return NextResponse.json({ error: "La voz de clonacion no fue encontrada." }, { status: 404 });
}
