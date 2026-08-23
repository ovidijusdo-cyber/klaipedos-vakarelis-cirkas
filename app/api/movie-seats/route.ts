import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "../../../lib/supabase/server";
import {
  isValidMovieSeatId,
  MOVIE_SEAT_COUNT,
  MOVIE_SEAT_HOLD_SECONDS,
  normalizeMovieSettings,
} from "../../../lib/movie";

const STATE_ID = "main";
const SECTION_TIMESTAMPS_KEY = "__sectionUpdatedAt";
const MAX_SAVE_RETRIES = 6;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type StoredMovieReservation = {
  id: number;
  seatId: string;
  row: string;
  seatNumber: number;
  firstName: string;
  lastName: string;
  reminderEmail: string;
  reminderRequested: boolean;
  reminderSentAt: string | null;
  paymentStatus: "reserved" | "paid_pending_review";
  paidAt: string | null;
  reservationStatus: "active";
  cancelledAt: null;
  createdAt: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function cleanText(value: unknown, maxLength = 80) {
  return String(value ?? "").trim().replace(/\s+/g, " ").slice(0, maxLength);
}

function normalizeName(value: unknown) {
  return cleanText(value).toLocaleLowerCase("lt");
}

function parseReservations(value: unknown): StoredMovieReservation[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((item) => {
    if (!isRecord(item)) return [];
    const id = Number(item.id);
    const seatId = cleanText(item.seatId, 12);
    if (!Number.isSafeInteger(id) || !isValidMovieSeatId(seatId)) return [];
    if (item.reservationStatus === "cancelled") return [];

    const [row, seatNumber] = seatId.split("-").map(Number);
    return [{
      id,
      seatId,
      row: String(item.row ?? row),
      seatNumber: Number(item.seatNumber ?? seatNumber),
      firstName: cleanText(item.firstName),
      lastName: cleanText(item.lastName),
      reminderEmail: cleanText(item.reminderEmail, 254).toLowerCase(),
      reminderRequested: Boolean(item.reminderRequested),
      reminderSentAt: typeof item.reminderSentAt === "string" ? item.reminderSentAt : null,
      paymentStatus: item.paymentStatus === "paid_pending_review" ? "paid_pending_review" : "reserved",
      paidAt: typeof item.paidAt === "string" ? item.paidAt : null,
      reservationStatus: "active",
      cancelledAt: null,
      createdAt: typeof item.createdAt === "string" ? item.createdAt : new Date().toISOString(),
    } satisfies StoredMovieReservation];
  });
}

function publicReservations(value: unknown) {
  return parseReservations(value).map((reservation) => ({
    ...reservation,
    reminderEmail: "",
  }));
}

function withReservationSectionTimestamp(payload: Record<string, unknown>, reservations: StoredMovieReservation[]) {
  const previousTimestamps = isRecord(payload[SECTION_TIMESTAMPS_KEY]) ? payload[SECTION_TIMESTAMPS_KEY] : {};
  return {
    ...payload,
    movieSeatReservations: reservations,
    [SECTION_TIMESTAMPS_KEY]: {
      ...previousTimestamps,
      movieSeatReservations: Date.now(),
    },
  };
}

async function updateMovieReservations(
  mutate: (reservations: StoredMovieReservation[]) => { reservations?: StoredMovieReservation[]; error?: string },
) {
  const supabase = createSupabaseServerClient();

  for (let attempt = 0; attempt < MAX_SAVE_RETRIES; attempt += 1) {
    const { data: state, error: loadError } = await supabase
      .from("event_state")
      .select("payload, updated_at")
      .eq("id", STATE_ID)
      .maybeSingle();

    if (loadError) throw loadError;
    const payload = isRecord(state?.payload) ? state.payload : {};
    const result = mutate(parseReservations(payload.movieSeatReservations));
    if (result.error) return { error: result.error };
    if (!result.reservations) return { error: "Nepavyko atnaujinti rezervacijų." };

    let query = supabase
      .from("event_state")
      .update({ payload: withReservationSectionTimestamp(payload, result.reservations) })
      .eq("id", STATE_ID);

    if (state?.updated_at) query = query.eq("updated_at", state.updated_at);
    const { data: updated, error: updateError } = await query.select("id");
    if (updateError) throw updateError;
    if (updated?.length) return { reservations: result.reservations };
  }

  return { error: "Rezervacija tuo pat metu pasikeitė. Pabandyk dar kartą." };
}

async function loadMovieState() {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("event_state")
    .select("payload")
    .eq("id", STATE_ID)
    .maybeSingle();
  if (error) throw error;
  const payload = isRecord(data?.payload) ? data.payload : {};
  return {
    reservations: parseReservations(payload.movieSeatReservations),
    settings: normalizeMovieSettings(payload.movieSettings),
  };
}

async function clearExpiredHolds() {
  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from("movie_seat_holds")
    .delete()
    .lte("expires_at", new Date().toISOString());
  if (error) throw error;
}

function formatDateTime(date = new Date()) {
  return new Intl.DateTimeFormat("lt-LT", {
    timeZone: "Europe/Vilnius",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function notifyNextWaitlistGuest() {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.REMINDER_EMAIL_FROM;
  if (!apiKey || !from) return;

  const supabase = createSupabaseServerClient();
  const { data: candidate, error: selectError } = await supabase
    .from("movie_waitlist")
    .select("id, first_name, email")
    .eq("status", "waiting")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (selectError || !candidate) return;

  const notifiedAt = new Date().toISOString();
  const { data: claimed, error: claimError } = await supabase
    .from("movie_waitlist")
    .update({ status: "notified", notified_at: notifiedAt })
    .eq("id", candidate.id)
    .eq("status", "waiting")
    .select("id")
    .maybeSingle();
  if (claimError || !claimed) return;

  const { settings } = await loadMovieState();
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [candidate.email],
      subject: `Atsilaisvino vieta: ${settings.eventName}`,
      html: `<p>Sveiki, ${escapeHtml(candidate.first_name)}!</p><p>Į kino peržiūrą ką tik atsilaisvino vieta. Užsukite į <a href="https://klaipedosvakaras.fun">klaipedosvakaras.fun</a> ir pasirinkite ją, kol ji dar laisva.</p><p><strong>${escapeHtml(settings.eventName)}</strong><br>${escapeHtml(settings.dateLabel)}<br>${escapeHtml(settings.place)}</p>`,
    }),
  });

  if (!response.ok) {
    await supabase
      .from("movie_waitlist")
      .update({ status: "waiting", notified_at: null })
      .eq("id", candidate.id)
      .eq("status", "notified");
  }
}

export async function GET(request: Request) {
  try {
    await clearExpiredHolds();
    const holdToken = new URL(request.url).searchParams.get("holdToken") ?? "";
    const supabase = createSupabaseServerClient();
    const [{ reservations, settings }, holdsResult] = await Promise.all([
      loadMovieState(),
      supabase.from("movie_seat_holds").select("seat_id, hold_token, expires_at").gt("expires_at", new Date().toISOString()),
    ]);
    if (holdsResult.error) throw holdsResult.error;

    return NextResponse.json({
      reservations: publicReservations(reservations),
      settings,
      holds: (holdsResult.data ?? []).map((hold) => ({
        seatId: hold.seat_id,
        expiresAt: hold.expires_at,
        owned: Boolean(holdToken) && hold.hold_token === holdToken,
      })),
      serverTime: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Failed to load movie seats", error);
    return NextResponse.json({ error: "Nepavyko atnaujinti kino vietų." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const action = cleanText(body?.action, 40);
    const holdToken = cleanText(body?.holdToken, 40);
    const supabase = createSupabaseServerClient();

    if (action === "hold") {
      const seatId = cleanText(body?.seatId, 12);
      if (!UUID_PATTERN.test(holdToken) || !isValidMovieSeatId(seatId)) {
        return NextResponse.json({ error: "Neteisinga vieta arba laikymo kodas." }, { status: 400 });
      }

      await clearExpiredHolds();
      const { reservations } = await loadMovieState();
      if (reservations.some((reservation) => reservation.seatId === seatId)) {
        return NextResponse.json({ error: `Vieta ${seatId} jau rezervuota.` }, { status: 409 });
      }

      const expiresAt = new Date(Date.now() + MOVIE_SEAT_HOLD_SECONDS * 1000).toISOString();
      const { data: ownHold, error: ownHoldError } = await supabase
        .from("movie_seat_holds")
        .update({ expires_at: expiresAt })
        .eq("seat_id", seatId)
        .eq("hold_token", holdToken)
        .select("seat_id")
        .maybeSingle();
      if (ownHoldError) throw ownHoldError;

      if (!ownHold) {
        const { error: insertError } = await supabase.from("movie_seat_holds").insert({
          seat_id: seatId,
          hold_token: holdToken,
          expires_at: expiresAt,
        });
        if (insertError?.code === "23505") {
          return NextResponse.json({ error: `Vietą ${seatId} šiuo metu renkasi kitas žmogus.` }, { status: 409 });
        }
        if (insertError) throw insertError;
      }

      return NextResponse.json({ ok: true, hold: { seatId, expiresAt, owned: true } });
    }

    if (action === "release") {
      const seatId = cleanText(body?.seatId, 12);
      if (!UUID_PATTERN.test(holdToken) || !isValidMovieSeatId(seatId)) {
        return NextResponse.json({ error: "Neteisinga vieta arba laikymo kodas." }, { status: 400 });
      }
      const { error } = await supabase
        .from("movie_seat_holds")
        .delete()
        .eq("seat_id", seatId)
        .eq("hold_token", holdToken);
      if (error) throw error;
      return NextResponse.json({ ok: true });
    }

    if (action === "reserve") {
      if (!UUID_PATTERN.test(holdToken) || !Array.isArray(body?.guests) || body.guests.length < 1 || body.guests.length > 12) {
        return NextResponse.json({ error: "Neteisingi rezervacijos duomenys." }, { status: 400 });
      }

      const reminderEmail = cleanText(body?.contactEmail, 254).toLowerCase();
      if (reminderEmail && !EMAIL_PATTERN.test(reminderEmail)) {
        return NextResponse.json({ error: "Patikrink kontaktinį el. paštą." }, { status: 400 });
      }

      const guests = body.guests.map((guest: unknown) => {
        const value = isRecord(guest) ? guest : {};
        return {
          seatId: cleanText(value.seatId, 12),
          firstName: cleanText(value.firstName),
          lastName: cleanText(value.lastName),
        };
      });
      const seatIds = guests.map((guest: { seatId: string }) => guest.seatId);
      if (new Set(seatIds).size !== seatIds.length || guests.some((guest: { seatId: string; firstName: string; lastName: string }) => !isValidMovieSeatId(guest.seatId) || !guest.firstName || !guest.lastName)) {
        return NextResponse.json({ error: "Patikrink vietas, vardus ir pavardes." }, { status: 400 });
      }

      await clearExpiredHolds();
      const { data: holds, error: holdsError } = await supabase
        .from("movie_seat_holds")
        .select("seat_id")
        .in("seat_id", seatIds)
        .eq("hold_token", holdToken)
        .gt("expires_at", new Date().toISOString());
      if (holdsError) throw holdsError;
      if ((holds ?? []).length !== seatIds.length) {
        return NextResponse.json({ error: "Baigėsi 3 minučių vietų laikymo laikas. Pasirink vietas iš naujo." }, { status: 409 });
      }

      const createdAt = formatDateTime();
      const baseId = Date.now() * 1000 + Math.floor(Math.random() * 800);
      let createdReservations: StoredMovieReservation[] = [];
      const updateResult = await updateMovieReservations((existing) => {
        const collision = guests.find((guest: { seatId: string }) => existing.some((reservation) => reservation.seatId === guest.seatId));
        if (collision) return { error: `Vieta ${collision.seatId} ką tik buvo rezervuota.` };

        createdReservations = guests.map((guest: { seatId: string; firstName: string; lastName: string }, index: number) => {
          const [row, seatNumber] = guest.seatId.split("-").map(Number);
          return {
            id: baseId + index,
            seatId: guest.seatId,
            row: String(row),
            seatNumber,
            firstName: guest.firstName,
            lastName: guest.lastName,
            reminderEmail,
            reminderRequested: Boolean(reminderEmail),
            reminderSentAt: null,
            paymentStatus: "reserved",
            paidAt: null,
            reservationStatus: "active",
            cancelledAt: null,
            createdAt,
          };
        });
        return { reservations: [...existing, ...createdReservations] };
      });
      if (updateResult.error) return NextResponse.json({ error: updateResult.error }, { status: 409 });

      const { error: releaseError } = await supabase
        .from("movie_seat_holds")
        .delete()
        .in("seat_id", seatIds)
        .eq("hold_token", holdToken);
      if (releaseError) console.error("Failed to release reserved movie holds", releaseError);

      return NextResponse.json({ ok: true, reservations: publicReservations(createdReservations), allReservations: publicReservations(updateResult.reservations) });
    }

    if (action === "payment") {
      const ids = Array.isArray(body?.reservationIds)
        ? body.reservationIds.map(Number).filter(Number.isSafeInteger).slice(0, 12)
        : [];
      if (!ids.length) return NextResponse.json({ error: "Nepasirinktos rezervacijos." }, { status: 400 });
      const idSet = new Set(ids);
      const paidAt = formatDateTime();
      const updateResult = await updateMovieReservations((existing) => ({
        reservations: existing.map((reservation) => idSet.has(reservation.id)
          ? { ...reservation, paymentStatus: "paid_pending_review", paidAt }
          : reservation),
      }));
      if (updateResult.error) return NextResponse.json({ error: updateResult.error }, { status: 409 });
      return NextResponse.json({ ok: true, reservations: publicReservations(updateResult.reservations) });
    }

    if (action === "cancel") {
      const reservationId = Number(body?.reservationId);
      const seatId = cleanText(body?.seatId, 12);
      const firstName = normalizeName(body?.firstName);
      const lastName = normalizeName(body?.lastName);
      if (!Number.isSafeInteger(reservationId) || !isValidMovieSeatId(seatId) || !firstName || !lastName) {
        return NextResponse.json({ error: "Neteisingi atšaukimo duomenys." }, { status: 400 });
      }

      const updateResult = await updateMovieReservations((existing) => {
        const match = existing.find((reservation) => reservation.id === reservationId);
        if (!match || match.seatId !== seatId || normalizeName(match.firstName) !== firstName || normalizeName(match.lastName) !== lastName) {
          return { error: "Rezervacija nerasta arba jos duomenys pasikeitė." };
        }
        return { reservations: existing.filter((reservation) => reservation.id !== reservationId) };
      });
      if (updateResult.error) return NextResponse.json({ error: updateResult.error }, { status: 409 });
      await notifyNextWaitlistGuest().catch((error) => console.error("Failed to notify movie waitlist", error));
      return NextResponse.json({ ok: true, reservations: publicReservations(updateResult.reservations) });
    }

    if (action === "join_waitlist") {
      const firstName = cleanText(body?.firstName);
      const lastName = cleanText(body?.lastName);
      const email = cleanText(body?.email, 254).toLowerCase();
      if (!firstName || !lastName || !EMAIL_PATTERN.test(email)) {
        return NextResponse.json({ error: "Įrašyk vardą, pavardę ir teisingą el. paštą." }, { status: 400 });
      }
      const { reservations } = await loadMovieState();
      if (reservations.length < MOVIE_SEAT_COUNT) {
        return NextResponse.json({ error: "Šiuo metu dar yra laisvų vietų." }, { status: 409 });
      }
      const { error } = await supabase.from("movie_waitlist").insert({
        first_name: firstName,
        last_name: lastName,
        email,
      });
      if (error?.code === "23505") {
        return NextResponse.json({ ok: true, alreadyJoined: true });
      }
      if (error) throw error;
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Nežinomas veiksmas." }, { status: 400 });
  } catch (error) {
    console.error("Failed to update movie seats", error);
    return NextResponse.json({ error: "Nepavyko atlikti veiksmo. Pabandyk dar kartą." }, { status: 500 });
  }
}
