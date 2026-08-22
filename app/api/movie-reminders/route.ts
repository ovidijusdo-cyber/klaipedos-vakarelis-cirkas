import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "../../../lib/supabase/server";

export const dynamic = "force-dynamic";

const STATE_ID = "main";
const SECTION_TIMESTAMPS_KEY = "__sectionUpdatedAt";
const MOVIE_EVENT_NAME = process.env.MOVIE_EVENT_NAME ?? "JW filmų peržiūra";
const MOVIE_EVENT_DATE = process.env.MOVIE_EVENT_DATE ?? "Data ir laikas bus patikslinti";
const MOVIE_EVENT_PLACE = process.env.MOVIE_EVENT_PLACE ?? "Forum Cinemas";
const MOVIE_EVENT_START_ISO = process.env.MOVIE_EVENT_START_ISO ?? process.env.NEXT_PUBLIC_MOVIE_EVENT_START_ISO ?? "";

type MovieSeatReservation = {
  id: number;
  seatId: string;
  firstName: string;
  lastName: string;
  reminderEmail?: string;
  reminderRequested?: boolean;
  reminderSentAt?: string | null;
  reservationStatus?: "active" | "cancelled";
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function parseReservations(value: unknown): MovieSeatReservation[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((item) => {
    if (!isRecord(item)) return [];
    const id = Number(item.id);
    const seatId = String(item.seatId ?? "").trim().toUpperCase();
    const firstName = String(item.firstName ?? "").trim();
    const lastName = String(item.lastName ?? "").trim();
    const reminderEmail = String(item.reminderEmail ?? "").trim().toLowerCase();

    if (!Number.isFinite(id) || !seatId || !firstName || !reminderEmail) return [];

    return [{
      id,
      seatId,
      firstName,
      lastName,
      reminderEmail,
      reminderRequested: Boolean(item.reminderRequested),
      reminderSentAt: typeof item.reminderSentAt === "string" ? item.reminderSentAt : null,
      reservationStatus: item.reservationStatus === "cancelled" ? "cancelled" : "active",
    }];
  });
}

async function sendReminderEmail(reservation: MovieSeatReservation) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.REMINDER_EMAIL_FROM;

  if (!apiKey || !from) {
    return { sent: false, skipped: "missing_email_config" };
  }

  const fullName = `${reservation.firstName} ${reservation.lastName}`.trim();
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: reservation.reminderEmail,
      subject: `Priminimas: ${MOVIE_EVENT_NAME}`,
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.55; color: #111827;">
          <h2 style="margin: 0 0 12px;">Primename apie kino peržiūrą</h2>
          <p>Sveiki, ${escapeHtml(fullName)}.</p>
          <p>Iki renginio liko apie 24 val.</p>
          <p>
            <strong>Renginys:</strong> ${escapeHtml(MOVIE_EVENT_NAME)}<br />
            <strong>Vieta:</strong> ${escapeHtml(MOVIE_EVENT_PLACE)}<br />
            <strong>Laikas:</strong> ${escapeHtml(MOVIE_EVENT_DATE)}<br />
            <strong>Jūsų vieta:</strong> ${escapeHtml(reservation.seatId)}
          </p>
          <p>Iki susitikimo!</p>
        </div>
      `,
    }),
  });

  if (!response.ok) {
    return { sent: false, skipped: `resend_${response.status}` };
  }

  return { sent: true, skipped: "" };
}

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET ?? process.env.REMINDER_CRON_SECRET;
  const authorization = request.headers.get("authorization") ?? "";
  const url = new URL(request.url);

  if (cronSecret && authorization !== `Bearer ${cronSecret}` && url.searchParams.get("secret") !== cronSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!MOVIE_EVENT_START_ISO) {
    return NextResponse.json({ sent: 0, skipped: "missing_movie_event_start" });
  }

  const eventStart = new Date(MOVIE_EVENT_START_ISO);
  if (Number.isNaN(eventStart.getTime())) {
    return NextResponse.json({ sent: 0, skipped: "invalid_movie_event_start" });
  }

  const msUntilEvent = eventStart.getTime() - Date.now();
  const twentyFourHours = 24 * 60 * 60 * 1000;
  if (msUntilEvent <= 0 || msUntilEvent > twentyFourHours) {
    return NextResponse.json({ sent: 0, skipped: "not_due_yet" });
  }

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase.from("event_state").select("payload").eq("id", STATE_ID).maybeSingle();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const payload = isRecord(data?.payload) ? { ...data.payload } : {};
  const reservations = parseReservations(payload.movieSeatReservations);
  const dueReservations = reservations.filter(
    (reservation) =>
      reservation.reservationStatus !== "cancelled" &&
      reservation.reminderRequested &&
      reservation.reminderEmail &&
      !reservation.reminderSentAt,
  );

  let sent = 0;
  const skipped: string[] = [];
  const sentAt = new Date().toISOString();
  const sentIds = new Set<number>();

  for (const reservation of dueReservations) {
    const result = await sendReminderEmail(reservation);
    if (result.sent) {
      sent += 1;
      sentIds.add(reservation.id);
    } else if (result.skipped) {
      skipped.push(`${reservation.seatId}:${result.skipped}`);
    }
  }

  if (sentIds.size > 0 && Array.isArray(payload.movieSeatReservations)) {
    payload.movieSeatReservations = payload.movieSeatReservations.map((item) => {
      if (!isRecord(item)) return item;
      const id = Number(item.id);
      return sentIds.has(id) ? { ...item, reminderSentAt: sentAt } : item;
    });
    payload[SECTION_TIMESTAMPS_KEY] = {
      ...(isRecord(payload[SECTION_TIMESTAMPS_KEY]) ? payload[SECTION_TIMESTAMPS_KEY] : {}),
      movieSeatReservations: Date.now(),
    };

    const { error: updateError } = await supabase.from("event_state").update({ payload }).eq("id", STATE_ID);
    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }
  }

  return NextResponse.json({ due: dueReservations.length, sent, skipped });
}
