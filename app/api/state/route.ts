import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "../../../lib/supabase/server";

const STATE_ID = "main";

export async function GET() {
  try {
    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase
      .from("event_state")
      .select("payload, updated_at")
      .eq("id", STATE_ID)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return NextResponse.json({
      payload: data?.payload ?? null,
      updatedAt: data?.updated_at ?? null,
    });
  } catch (error) {
    console.error("Failed to load event state", error);
    return NextResponse.json({ error: "Failed to load event state" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const payload = body?.payload;

    if (!payload || typeof payload !== "object") {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const supabase = createSupabaseServerClient();
    const { error } = await supabase.from("event_state").upsert(
      {
        id: STATE_ID,
        payload,
      },
      { onConflict: "id" },
    );

    if (error) {
      throw error;
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Failed to save event state", error);
    return NextResponse.json({ error: "Failed to save event state" }, { status: 500 });
  }
}
