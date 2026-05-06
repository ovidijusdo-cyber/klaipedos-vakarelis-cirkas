import { NextResponse } from "next/server";

type PreviewSource = "YouTube" | "Spotify" | "Kita";

function detectSource(url: string): PreviewSource {
  const lowerUrl = url.toLowerCase();
  if (lowerUrl.includes("spotify.com")) return "Spotify";
  if (lowerUrl.includes("youtube.com") || lowerUrl.includes("youtu.be")) return "YouTube";
  return "Kita";
}

function previewEndpoint(url: string, source: PreviewSource) {
  if (source === "YouTube") return `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(url)}`;
  if (source === "Spotify") return `https://open.spotify.com/oembed?url=${encodeURIComponent(url)}`;
  return null;
}

async function fetchWithTimeout(url: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4500);

  try {
    return await fetch(url, {
      headers: {
        accept: "application/json",
      },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const rawUrl = searchParams.get("url")?.trim() ?? "";

  try {
    const parsedUrl = new URL(rawUrl);
    if (!["http:", "https:"].includes(parsedUrl.protocol)) {
      return NextResponse.json({ title: "", source: "Kita" });
    }

    const source = detectSource(parsedUrl.toString());
    const endpoint = previewEndpoint(parsedUrl.toString(), source);
    if (!endpoint) {
      return NextResponse.json({ title: "", source });
    }

    const response = await fetchWithTimeout(endpoint);
    if (!response.ok) {
      return NextResponse.json({ title: "", source });
    }

    const data = (await response.json()) as { title?: unknown };
    const title = typeof data.title === "string" ? data.title.trim().slice(0, 160) : "";

    return NextResponse.json({ title, source });
  } catch {
    return NextResponse.json({ title: "", source: "Kita" });
  }
}
