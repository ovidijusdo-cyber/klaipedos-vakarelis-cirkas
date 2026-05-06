import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "../../../lib/supabase/server";

const STATE_ID = "main";
const SECTION_TIMESTAMPS_KEY = "__sectionUpdatedAt";
const DELETED_RESERVATION_IDS_KEY = "deletedReservationIds";
const MAX_SAVE_RETRIES = 5;
const ADMIN_PIN = process.env.ADMIN_PIN;
const DEMO_RESERVATION_EMAILS = new Set(["jonas@example.com"]);
const DEMO_RESERVATION_CODES = new Set(["CIRKAS-0001"]);
const DEMO_GAME_SCORES = new Set(["Jonas:18", "AustÄ—ja:14", "Austėja:14", "Lukas:9"]);
const DEMO_SONG_TITLES = new Set(["Pavyzdys: šokių hitas", "Pavyzdys: linksma daina"]);
const DEMO_EVENT_IDEAS = new Set(["Pavyzdys: cirko tematikos žaidimas su prizais."]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function mergeById(
  existingValue: unknown,
  incomingValue: unknown,
  deletedIds: Set<number> = new Set(),
  options: { overwriteExisting?: boolean; overwriteIds?: Set<number> } = {},
) {
  const overwriteExisting = options.overwriteExisting ?? true;
  const overwriteIds = options.overwriteIds;
  const byId = new Map<number, Record<string, unknown>>();

  if (Array.isArray(existingValue)) {
    existingValue.forEach((item) => {
      if (!isRecord(item)) return;
      const id = Number(item.id);
      if (!Number.isFinite(id) || deletedIds.has(id)) return;
      byId.set(id, item);
    });
  }

  if (Array.isArray(incomingValue)) {
    incomingValue.forEach((item) => {
      if (!isRecord(item)) return;
      const id = Number(item.id);
      if (!Number.isFinite(id) || deletedIds.has(id)) return;
      const canOverwrite = overwriteIds ? overwriteIds.has(id) : overwriteExisting;
      if (canOverwrite || !byId.has(id)) {
        byId.set(id, item);
      }
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

function sanitizePublicReservation(existingItem: Record<string, unknown> | undefined, incomingItem: Record<string, unknown>) {
  const existingPeople = Array.isArray(existingItem?.people) ? existingItem.people.filter(isRecord) : [];
  const incomingPeople = Array.isArray(incomingItem.people) ? incomingItem.people.filter(isRecord) : [];
  const sanitizeRideReservations = (existingValue: unknown, incomingValue: unknown, seatLimit: number | null) => {
    const byPassengerId = new Map<string, Record<string, unknown>>();

    const valuesToSanitize = Array.isArray(incomingValue) ? [incomingValue] : [existingValue];

    valuesToSanitize.forEach((value) => {
      if (!Array.isArray(value)) return;
      value.filter(isRecord).forEach((booking) => {
        const passengerPersonId = String(booking.passengerPersonId ?? "").trim();
        const passengerName = String(booking.passengerName ?? "").trim();
        const passengerReservationId = Number(booking.passengerReservationId);
        if (!passengerPersonId || !passengerName || !Number.isFinite(passengerReservationId)) return;
        byPassengerId.set(passengerPersonId, {
          passengerReservationId,
          passengerPersonId,
          passengerName,
          createdAt: typeof booking.createdAt === "string" ? booking.createdAt : new Date().toISOString(),
        });
      });
    });

    const bookings = Array.from(byPassengerId.values());
    return seatLimit === null ? bookings : bookings.slice(0, Math.max(0, seatLimit));
  };

  if (!existingItem) {
    const rideOfferSeats = Number(incomingItem.rideOfferSeats);
    const safeRideOfferSeats = incomingItem.rideOfferSeats === null ? null : Number.isFinite(rideOfferSeats) ? rideOfferSeats : null;

    return {
      ...incomingItem,
      paid: false,
      paymentMethod: null,
      adminNote: "",
      rideReservations: sanitizeRideReservations([], incomingItem.rideReservations, safeRideOfferSeats),
      people: incomingPeople.map((person) => ({
        ...person,
        active: person.active !== false,
        arrived: false,
        arrivedAt: null,
      })),
    };
  }

  const incomingPeopleById = new Map(incomingPeople.map((person) => [String(person.id ?? ""), person]));
  const rideOfferSeats = Number(incomingItem.rideOfferSeats);
  const existingRideOfferSeats = Number(existingItem.rideOfferSeats);
  const safeRideOfferSeats =
    incomingItem.rideOfferSeats === null
      ? null
      : Number.isFinite(rideOfferSeats)
        ? rideOfferSeats
        : Number.isFinite(existingRideOfferSeats)
          ? existingRideOfferSeats
          : null;

  return {
    ...existingItem,
    needsRide: Boolean(incomingItem.needsRide ?? existingItem.needsRide ?? false),
    rideOfferSeats: safeRideOfferSeats,
    rideReservations: sanitizeRideReservations(existingItem.rideReservations, incomingItem.rideReservations, safeRideOfferSeats as number | null),
    people: existingPeople.map((existingPerson) => {
      const incomingPerson = incomingPeopleById.get(String(existingPerson.id ?? ""));

      return {
        ...existingPerson,
        firstName: typeof incomingPerson?.firstName === "string" ? incomingPerson.firstName : existingPerson.firstName,
        lastName: typeof incomingPerson?.lastName === "string" ? incomingPerson.lastName : existingPerson.lastName,
        active: existingPerson.active === false ? false : incomingPerson?.active !== false,
        arrived: Boolean(existingPerson.arrived ?? false),
        arrivedAt: existingPerson.arrivedAt ?? null,
      };
    }),
  };
}

function mergeReservations(
  existingValue: unknown,
  incomingValue: unknown,
  deletedIds: Set<number>,
  options: { overwriteExisting?: boolean; overwriteIds?: Set<number>; isAdmin: boolean },
) {
  if (options.isAdmin) {
    return mergeById(existingValue, incomingValue, deletedIds, options);
  }

  const overwriteExisting = options.overwriteExisting ?? true;
  const overwriteIds = options.overwriteIds;
  const byId = new Map<number, Record<string, unknown>>();

  if (Array.isArray(existingValue)) {
    existingValue.forEach((item) => {
      if (!isRecord(item)) return;
      const id = Number(item.id);
      if (!Number.isFinite(id) || deletedIds.has(id)) return;
      byId.set(id, item);
    });
  }

  if (Array.isArray(incomingValue)) {
    incomingValue.forEach((item) => {
      if (!isRecord(item)) return;
      const id = Number(item.id);
      if (!Number.isFinite(id) || deletedIds.has(id)) return;
      const canOverwrite = overwriteIds ? overwriteIds.has(id) : overwriteExisting;
      if (!canOverwrite && byId.has(id)) return;
      byId.set(id, sanitizePublicReservation(byId.get(id), item));
    });
  }

  return Array.from(byId.values());
}

function getChangedIdSet(value: unknown) {
  const ids = new Set<number>();
  if (!Array.isArray(value)) return ids;

  value.forEach((item) => {
    const id = Number(item);
    if (Number.isFinite(id)) ids.add(id);
  });

  return ids;
}

function sanitizeStoredPayload(payload: Record<string, unknown>) {
  if (Array.isArray(payload.reservations)) {
    payload.reservations = payload.reservations.filter((item) => {
      if (!isRecord(item)) return false;
      const email = String(item.contactEmail ?? "").toLowerCase();
      const qrCode = String(item.qrCode ?? "");
      return !DEMO_RESERVATION_EMAILS.has(email) && !DEMO_RESERVATION_CODES.has(qrCode);
    });
  }

  if (Array.isArray(payload.gameScores)) {
    payload.gameScores = payload.gameScores.filter((item) => {
      if (!isRecord(item)) return false;
      return !DEMO_GAME_SCORES.has(`${String(item.name ?? "")}:${Number(item.score)}`);
    });
  }

  if (Array.isArray(payload.songSuggestions)) {
    payload.songSuggestions = payload.songSuggestions.filter((item) => {
      if (!isRecord(item)) return false;
      return !DEMO_SONG_TITLES.has(String(item.title ?? ""));
    });
  }

  if (Array.isArray(payload.eventIdeas)) {
    payload.eventIdeas = payload.eventIdeas.filter((item) => {
      if (!isRecord(item)) return false;
      return !DEMO_EVENT_IDEAS.has(String(item.text ?? ""));
    });
  }

  return payload;
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

    const payload = isRecord(data?.payload) ? sanitizeStoredPayload({ ...data.payload }) : null;

    return NextResponse.json({
      payload,
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
    const isAdminRequest = Boolean(ADMIN_PIN) && body?.adminPin === ADMIN_PIN;
    const incomingSectionUpdatedAt = isRecord(body?.sectionUpdatedAt) ? body.sectionUpdatedAt : {};
    const incomingChangedIds = isRecord(body?.changedIds) ? body.changedIds : {};

    if (!payload || typeof payload !== "object") {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const incomingPayload = payload as Record<string, unknown>;
    const supabase = createSupabaseServerClient();

    for (let attempt = 1; attempt <= MAX_SAVE_RETRIES; attempt += 1) {
      const { data: existingState, error: existingError } = await supabase
        .from("event_state")
        .select("payload, updated_at")
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
      const mergedDeletedReservationIds = mergeDeletedIds(
        existingPayload[DELETED_RESERVATION_IDS_KEY],
        isAdminRequest ? incomingPayload[DELETED_RESERVATION_IDS_KEY] : [],
      );
      const deletedReservationIds = new Set(mergedDeletedReservationIds);

      Object.entries(incomingPayload).forEach(([key, value]) => {
        if (key === SECTION_TIMESTAMPS_KEY) return;
        if (key === DELETED_RESERVATION_IDS_KEY) {
          if (isAdminRequest) {
            mergedPayload[key] = mergedDeletedReservationIds;
          }
          return;
        }
        if (!isAdminRequest && key === "responsiblePeople") return;

        const incomingTimestamp = Number(incomingSectionUpdatedAt[key] ?? Date.now());
        const currentTimestamp = nextSectionUpdatedAt[key] ?? 0;

        if (!Number.isFinite(incomingTimestamp) || incomingTimestamp < currentTimestamp) {
          if (key === "reservations") {
            mergedPayload[key] = mergeReservations(existingPayload[key], value, deletedReservationIds, {
              overwriteExisting: false,
              overwriteIds: getChangedIdSet(incomingChangedIds[key]),
              isAdmin: isAdminRequest,
            });
          } else if (["waitingList", "transfers", "votes", "songSuggestions", "eventIdeas", "gameScores", "notifications"].includes(key)) {
            mergedPayload[key] = mergeById(existingPayload[key], value, new Set(), {
              overwriteExisting: false,
              overwriteIds: isAdminRequest ? getChangedIdSet(incomingChangedIds[key]) : new Set(),
            });
          }
          return;
        }

        if (key === "reservations") {
          mergedPayload[key] = mergeReservations(existingPayload[key], value, deletedReservationIds, {
            overwriteIds: getChangedIdSet(incomingChangedIds[key]),
            isAdmin: isAdminRequest,
          });
        } else if (["waitingList", "transfers", "votes", "songSuggestions", "eventIdeas", "gameScores", "notifications"].includes(key)) {
          mergedPayload[key] = mergeById(existingPayload[key], value, new Set(), {
            overwriteExisting: isAdminRequest,
            overwriteIds: isAdminRequest ? getChangedIdSet(incomingChangedIds[key]) : new Set(),
          });
        } else if (isAdminRequest) {
          mergedPayload[key] = value;
        } else {
          return;
        }
        nextSectionUpdatedAt[key] = incomingTimestamp;
      });

      if (mergedDeletedReservationIds.length > 0) {
        mergedPayload[DELETED_RESERVATION_IDS_KEY] = mergedDeletedReservationIds;
        mergedPayload.reservations = mergeById(mergedPayload.reservations, [], deletedReservationIds);
      }

      mergedPayload[SECTION_TIMESTAMPS_KEY] = nextSectionUpdatedAt;
      sanitizeStoredPayload(mergedPayload);

      let query = supabase
        .from("event_state")
        .update({
          payload: mergedPayload,
        })
        .eq("id", STATE_ID);

      if (existingState?.updated_at) {
        query = query.eq("updated_at", existingState.updated_at);
      }

      const { data: updatedRows, error } = await query.select("id");

      if (error) {
        throw error;
      }

      if (updatedRows && updatedRows.length > 0) {
        return NextResponse.json({ ok: true });
      }

      if (!existingState) {
        const { error: insertError } = await supabase.from("event_state").insert({
          id: STATE_ID,
          payload: mergedPayload,
        });

        if (!insertError) {
          return NextResponse.json({ ok: true });
        }
      }
    }

    return NextResponse.json({ error: "Failed to save event state after retries" }, { status: 409 });
  } catch (error) {
    console.error("Failed to save event state", error);
    return NextResponse.json({ error: "Failed to save event state" }, { status: 500 });
  }
}
