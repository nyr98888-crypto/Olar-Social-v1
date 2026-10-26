/**
 * Same-origin image proxy — lets the browser download FAL/CDN URLs without CORS.
 * GET /api/proxy-image?url=https://...
 * Only allows http(s) hosts (no file:// or data:).
 */
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 30;

const ALLOWED_HOST_SUFFIXES = [
  "fal.media",
  "fal.ai",
  "together.ai",
  "together.xyz",
  "supabase.co",
  "unsplash.com",
  "replicate.delivery",
  "leonardo.ai",
  "googleusercontent.com",
];

function hostAllowed(hostname: string): boolean {
  const h = hostname.toLowerCase();
  return ALLOWED_HOST_SUFFIXES.some(
    (s) => h === s || h.endsWith(`.${s}`)
  );
}

export async function GET(request: Request) {
  const raw = new URL(request.url).searchParams.get("url")?.trim();
  if (!raw) {
    return NextResponse.json({ error: "url required" }, { status: 400 });
  }

  let target: URL;
  try {
    target = new URL(raw);
  } catch {
    return NextResponse.json({ error: "invalid url" }, { status: 400 });
  }

  if (target.protocol !== "http:" && target.protocol !== "https:") {
    return NextResponse.json({ error: "unsupported protocol" }, { status: 400 });
  }
  if (!hostAllowed(target.hostname)) {
    return NextResponse.json({ error: "host not allowed" }, { status: 403 });
  }

  try {
    const upstream = await fetch(target.toString(), {
      signal: AbortSignal.timeout(25_000),
      headers: { Accept: "image/*,*/*" },
    });
    if (!upstream.ok) {
      return NextResponse.json(
        { error: `upstream ${upstream.status}` },
        { status: 502 }
      );
    }
    const contentType =
      upstream.headers.get("content-type") || "application/octet-stream";
    if (!contentType.startsWith("image/") && !contentType.includes("octet-stream")) {
      return NextResponse.json(
        { error: "upstream is not an image" },
        { status: 415 }
      );
    }
    const buf = await upstream.arrayBuffer();
    return new NextResponse(buf, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "private, max-age=300",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (err) {
    console.error(
      "[api/proxy-image] failed",
      err instanceof Error ? err.message : err
    );
    return NextResponse.json({ error: "proxy fetch failed" }, { status: 502 });
  }
}
