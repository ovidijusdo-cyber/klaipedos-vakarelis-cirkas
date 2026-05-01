import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "../../../lib/supabase/server";

const STATE_ID = "main";
const SECTION_TIMESTAMPS_KEY = "__sectionUpdatedAt";
const DELETED_RESERVATION_IDS_KEY = "deletedReservationIds";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function mergeById(
  existingValue: unknown,
  incomingValue: unknown,
  deletedIds: Set<number> = new Set(),
  options: { overwriteExisting?: boolean } = {},
) {
  const overwriteExisting = options.overwriteExisting ?? true;
  const byId = new Map<number, Record<string, unknown>>();

  if (Array.isArray(existingValue)) {
    existingValue.forEach((item) => {
      if (!isRecord(item)) return;
      const id = Number(item.id);
      if (!Number.isFinite(id) || deletedIds.has(id)) return;
      if (overwriteExisting || !byId.has(id)) {
        byId.set(id, item);
      }
    });
  }

  if (Array.isArray(incomingValue)) {
    incomingValue.forEach((item) => {
      if (!isRecord(item)) return;
      const id = Number(item.id);
      if (!Number.isFinite(id) || deletedIds.has(id)) return;
      byId.set(id, item);
    });
  }

  return Array.from(byId.values());
}

function mergeDeletedIds(existingValue: unknown, incomingValue: unknown) {
  const ids = new Set<number>();

  [existingValue, incomingValue].forEach((value) => {
    if (!Array.isArray(value)) return;
    value.forEach((item) => {
      const id = Number(item);
      if (Number.isFinite(id)) ids.add(id);
    });
  });

  return Array.from(ids);
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
    const incomingPayload = payload as Record<string, unknown>;
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
    const mergedDeletedReservationIds = mergeDeletedIds(
      existingPayload[DELETED_RESERVATION_IDS_KEY],
      incomingPayload[DELETED_RESERVATION_IDS_KEY],
    );
    const deletedReservationIds = new Set(mergedDeletedReservationIds);

    Object.entries(incomingPayload).forEach(([key, value]) => {
      if (key === SECTION_TIMESTAMPS_KEY) return;
      if (key === DELETED_RESERVATION_IDS_KEY) {
        mergedPayload[key] = mergedDeletedReservationIds;
        return;
      }

      const incomingTimestamp = Number(incomingSectionUpdatedAt[key] ?? Date.now());
      const currentTimestamp = nextSectionUpdatedAt[key] ?? 0;

      if (!Number.isFinite(incomingTimestamp) || incomingTimestamp < currentTimestamp) {
        if (key === "reservations") {
          mergedPayload[key] = mergeById(existingPayload[key], value, deletedReservationIds, { overwriteExisting: false });
        } else if (["waitingList", "transfers", "votes", "songSuggestions", "eventIdeas", "gameScores", "notifications"].includes(key)) {
          mergedPayload[key] = mergeById(existingPayload[key], value, new Set(), { overwriteExisting: false });
        }
        return;
      }

      if (key === "reservations") {
        mergedPayload[key] = mergeById(existingPayload[key], value, deletedReservationIds);
      } else if (["waitingList", "transfers", "votes", "songSuggestions", "eventIdeas", "gameScores", "notifications"].includes(key)) {
        mergedPayload[key] = mergeById(existingPayload[key], value);
      } else {
        mergedPayload[key] = value;
      }
      nextSectionUpdatedAt[key] = incomingTimestamp;
    });

    if (mergedDeletedReservationIds.length > 0) {
      mergedPayload[DELETED_RESERVATION_IDS_KEY] = mergedDeletedReservationIds;
      mergedPayload.reservations = mergeById(mergedPayload.reservations, [], deletedReservationIds);
    }

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
