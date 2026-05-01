import { NextResponse } from "next/server";

const ADMIN_PIN = process.env.ADMIN_PIN;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const pin = String(body?.pin ?? "");

    if (!ADMIN_PIN) {
      return NextResponse.json({ ok: false, error: "Admin PIN is not configured" }, { status: 500 });
    }

    if (pin !== ADMIN_PIN) {
      return NextResponse.json({ ok: false }, { status: 401 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Failed to verify admin PIN", error);
    return NextResponse.json({ ok: false }, { status: 400 });
  }
}
