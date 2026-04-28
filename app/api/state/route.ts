import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "../../../lib/supabase/server";

const STATE_ID = "main";
const SECTION_TIMESTAMPS_KEY = "__sectionUpdatedAt";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

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
    const incomingSectionUpdatedAt = isRecord(body?.sectionUpdatedAt) ? body.sectionUpdatedAt : {};

    if (!payload || typeof payload !== "object") {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const supabase = createSupabaseServerClient();
    const { data: existingState, error: existingError } = await supabase
      .from("event_state")
      .select("payload")
      .eq("id", STATE_ID)
      .maybeSingle();

    if (existingError) {
      throw existingError;
    }

    const existingPayload = isRecord(existingState?.payload) ? existingState.payload : {};
    const existingSectionUpdatedAt = isRecord(existingPayload[SECTION_TIMESTAMPS_KEY])
      ? (existingPayload[SECTION_TIMESTAMPS_KEY] as Record<string, unknown>)
      : {};
    const nextSectionUpdatedAt: Record<string, number> = {};

    Object.entries(existingSectionUpdatedAt).forEach(([key, value]) => {
      const timestamp = Number(value);
      if (Number.isFinite(timestamp)) {
        nextSectionUpdatedAt[key] = timestamp;
      }
    });

    const mergedPayload: Record<string, unknown> = { ...existingPayload };

    Object.entries(payload as Record<string, unknown>).forEach(([key, value]) => {
      if (key === SECTION_TIMESTAMPS_KEY) return;

      const incomingTimestamp = Number(incomingSectionUpdatedAt[key] ?? Date.now());
      const currentTimestamp = nextSectionUpdatedAt[key] ?? 0;

      if (!Number.isFinite(incomingTimestamp) || incomingTimestamp < currentTimestamp) {
        return;
      }

      mergedPayload[key] = value;
      nextSectionUpdatedAt[key] = incomingTimestamp;
    });

    mergedPayload[SECTION_TIMESTAMPS_KEY] = nextSectionUpdatedAt;

    const { error } = await supabase.from("event_state").upsert(
      {
        id: STATE_ID,
        payload: mergedPayload,
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
