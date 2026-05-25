import { NextResponse } from "next/server";

const ADMIN_PIN = process.env.ADMIN_PIN;
const CHAMPION_PIN = process.env.CHAMPION_PIN ?? "modestas";
const QR_PIN = process.env.QR_PIN ?? "paulina";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const pin = String(body?.pin ?? "");
    const scope = body?.scope === "champion" ? "champion" : body?.scope === "qr" ? "qr" : "admin";
    const expectedPin = scope === "champion" ? CHAMPION_PIN : scope === "qr" ? QR_PIN : ADMIN_PIN;

    if (!expectedPin) {
      return NextResponse.json({ ok: false, error: "PIN is not configured" }, { status: 500 });
    }

    if (pin !== expectedPin) {
      return NextResponse.json({ ok: false }, { status: 401 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Failed to verify admin PIN", error);
    return NextResponse.json({ ok: false }, { status: 400 });
  }
}
