import { NextResponse } from "next/server";

export const runtime = "nodejs";

const supportedHosts = ["instagram.com", "facebook.com", "fb.watch", "tiktok.com"];

export async function POST(request: Request) {
  const { url } = await request.json();

  if (!url || typeof url !== "string") {
    return NextResponse.json({ error: "Pega un enlace valido de Instagram, Facebook o TikTok." }, { status: 400 });
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return NextResponse.json({ error: "El enlace no es valido." }, { status: 400 });
  }

  const host = parsed.hostname.replace(/^www\./, "");
  if (!supportedHosts.some((allowed) => host === allowed || host.endsWith(`.${allowed}`))) {
    return NextResponse.json({ error: "Solo se aceptan enlaces de Instagram, Facebook o TikTok." }, { status: 400 });
  }

  return NextResponse.json(
    {
      error: "Descarga directa no configurada",
      details:
        "Puedo guardar o enlazar videos cuando la plataforma lo permite y tienes permiso sobre el contenido, pero no puedo quitar ni saltarme marcas de agua.",
    },
    { status: 501 },
  );
}
