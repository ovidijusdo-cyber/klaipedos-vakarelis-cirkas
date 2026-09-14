import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "../../../lib/supabase/server";

const STATE_ID = "main";
const SECTION_TIMESTAMPS_KEY = "__sectionUpdatedAt";
const MAX_SAVE_RETRIES = 5;

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return process.env.NODE_ENV !== "production";
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  try {
    return Boolean(host) && new URL(origin).host === host;
  } catch {
    return false;
  }
}

function activePeople(reservation: JsonRecord) {
  return Array.isArray(reservation.people)
    ? reservation.people.filter((person): person is JsonRecord => isRecord(person) && person.active !== false)
    : [];
}

function personName(person: JsonRecord) {
  return `${String(person.firstName ?? "").trim()} ${String(person.lastName ?? "").trim()}`.trim();
}

function maskName(person: JsonRecord) {
  const firstName = String(person.firstName ?? "").trim();
  const lastName = String(person.lastName ?? "").trim();
  return lastName ? `${firstName} ${lastName[0]?.toUpperCase()}.` : firstName;
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

function publicReservation(reservation: JsonRecord) {
  const publicItem = { ...reservation };
  delete publicItem.rideContactPhone;
  delete publicItem.rideNotificationEmail;
  return publicItem;
}

async function sendDriverNotification({
  bookingKey,
  driverEmail,
  driverName,
  passengerName,
}: {
  bookingKey: string;
  driverEmail: string;
  driverName: string;
  passengerName: string;
}) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.REMINDER_EMAIL_FROM;
  if (!apiKey || !from || !driverEmail) return false;

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": `ride-${bookingKey}`.slice(0, 256),
      },
      body: JSON.stringify({
        from,
        to: [driverEmail],
        subject: `Naujas keleivis į vakarėlį: ${passengerName}`,
        html: `
          <div style="font-family: Arial, sans-serif; line-height: 1.55; color: #111827;">
            <h2 style="margin: 0 0 12px;">Tavo automobilyje rezervuota vieta</h2>
            <p>Sveiki, ${escapeHtml(driverName || "vairuotojau")}!</p>
            <p><strong>${escapeHtml(passengerName)}</strong> pažymėjo, kad į šventę vyks kartu su jumis.</p>
            <p><strong>Renginys:</strong> Tautos. Aplink pasaulį per 360 minučių<br />
            <strong>Laikas:</strong> 2026 m. lapkričio 7 d., 17:00<br />
            <strong>Vieta:</strong> Priekulės kultūros centras</p>
            <p>Jei reikės suderinti kelionės detales, organizatorius matys jūsų registracijoje nurodytą kontaktinį telefono numerį.</p>
          </div>
        `,
      }),
    });

    return response.ok;
  } catch (error) {
    console.error("Failed to send ride notification", error);
    return false;
  }
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Netinkama užklausos kilmė." }, { status: 403 });
  }

  try {
    const body = await request.json();
    const driverReservationId = Number(body?.driverReservationId);
    const passengerReservationId = Number(body?.passengerReservationId);
    const passengerPersonId = String(body?.passengerPersonId ?? "").trim();
    if (!Number.isFinite(driverReservationId) || !Number.isFinite(passengerReservationId) || !passengerPersonId) {
      return NextResponse.json({ error: "Pasirinkimas netinkamas." }, { status: 400 });
    }
    if (driverReservationId === passengerReservationId) {
      return NextResponse.json({ error: "Negalima rezervuoti vietos savo automobilyje." }, { status: 400 });
    }

    const supabase = createSupabaseServerClient();

    for (let attempt = 1; attempt <= MAX_SAVE_RETRIES; attempt += 1) {
      const { data: state, error: loadError } = await supabase
        .from("event_state")
        .select("payload, updated_at")
        .eq("id", STATE_ID)
        .maybeSingle();
      if (loadError) throw loadError;
      if (!state || !isRecord(state.payload)) {
        return NextResponse.json({ error: "Registracijos duomenys nerasti." }, { status: 404 });
      }

      const payload = state.payload;
      const reservations = Array.isArray(payload.reservations) ? payload.reservations.filter(isRecord) : [];
      const driver = reservations.find((item) => Number(item.id) === driverReservationId);
      const passengerReservation = reservations.find((item) => Number(item.id) === passengerReservationId);
      if (!driver || !passengerReservation) {
        return NextResponse.json({ error: "Vairuotojas arba dalyvis neberastas." }, { status: 404 });
      }

      const passenger = activePeople(passengerReservation).find((person) => String(person.id ?? "") === passengerPersonId);
      if (!passenger) {
        return NextResponse.json({ error: "Šis dalyvis neberastas aktyvioje registracijoje." }, { status: 404 });
      }

      const alreadyBooked = reservations.some((reservation) =>
        Array.isArray(reservation.rideReservations) &&
        reservation.rideReservations.some((booking) => isRecord(booking) && String(booking.passengerPersonId ?? "") === passengerPersonId),
      );
      if (alreadyBooked) {
        return NextResponse.json({ error: "Šis dalyvis jau turi rezervuotą transporto vietą." }, { status: 409 });
      }

      const offeredSeats = Math.max(0, Math.floor(Number(driver.rideOfferSeats) || 0));
      const currentBookings = Array.isArray(driver.rideReservations) ? driver.rideReservations.filter(isRecord) : [];
      if (!offeredSeats || currentBookings.length >= offeredSeats) {
        return NextResponse.json({ error: "Pas šį vairuotoją laisvų vietų nebėra." }, { status: 409 });
      }

      const now = new Date();
      const passengerFullName = personName(passenger);
      const booking = {
        passengerReservationId,
        passengerPersonId,
        passengerName: maskName(passenger),
        createdAt: formatDateTime(now),
      };
      const nextDriver = { ...driver, rideReservations: [...currentBookings, booking] };
      const nextReservations = reservations.map((item) => (Number(item.id) === driverReservationId ? nextDriver : item));
      const driverName = personName(activePeople(driver)[0] ?? {});
      const notification = {
        id: now.getTime(),
        message: `${booking.passengerName} rezervavo transporto vietą pas ${maskName(activePeople(driver)[0] ?? {})}.`,
        createdAt: booking.createdAt,
      };
      const notifications = Array.isArray(payload.notifications) ? payload.notifications.filter(isRecord) : [];
      const nextNotifications = [notification, ...notifications];
      const previousSectionUpdatedAt = isRecord(payload[SECTION_TIMESTAMPS_KEY]) ? payload[SECTION_TIMESTAMPS_KEY] : {};
      const timestamp = now.getTime();
      const nextPayload = {
        ...payload,
        reservations: nextReservations,
        notifications: nextNotifications,
        [SECTION_TIMESTAMPS_KEY]: {
          ...previousSectionUpdatedAt,
          reservations: timestamp,
          notifications: timestamp,
        },
      };

      let update = supabase.from("event_state").update({ payload: nextPayload }).eq("id", STATE_ID);
      if (state.updated_at) update = update.eq("updated_at", state.updated_at);
      const { data: updatedRows, error: updateError } = await update.select("id");
      if (updateError) throw updateError;
      if (!updatedRows?.length) continue;

      const driverEmail = String(driver.rideNotificationEmail ?? "").trim().toLowerCase();
      const notificationSent = await sendDriverNotification({
        bookingKey: `${driverReservationId}-${passengerPersonId}`,
        driverEmail,
        driverName,
        passengerName: passengerFullName,
      });

      return NextResponse.json({
        ok: true,
        notificationSent,
        reservations: nextReservations.map(publicReservation),
        notifications: nextNotifications,
      });
    }

    return NextResponse.json({ error: "Rezervaciją tuo pat metu pakeitė kitas žmogus. Bandyk dar kartą." }, { status: 409 });
  } catch (error) {
    console.error("Failed to reserve a ride seat", error);
    return NextResponse.json({ error: "Nepavyko rezervuoti transporto vietos." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Netinkama užklausos kilmė." }, { status: 403 });
  }

  try {
    const body = await request.json();
    const driverReservationId = Number(body?.driverReservationId);
    const passengerPersonId = String(body?.passengerPersonId ?? "").trim();
    if (!Number.isFinite(driverReservationId) || !passengerPersonId) {
      return NextResponse.json({ error: "Pasirinkimas netinkamas." }, { status: 400 });
    }

    const supabase = createSupabaseServerClient();
    for (let attempt = 1; attempt <= MAX_SAVE_RETRIES; attempt += 1) {
      const { data: state, error: loadError } = await supabase
        .from("event_state")
        .select("payload, updated_at")
        .eq("id", STATE_ID)
        .maybeSingle();
      if (loadError) throw loadError;
      if (!state || !isRecord(state.payload)) {
        return NextResponse.json({ error: "Registracijos duomenys nerasti." }, { status: 404 });
      }

      const payload = state.payload;
      const reservations = Array.isArray(payload.reservations) ? payload.reservations.filter(isRecord) : [];
      const driver = reservations.find((item) => Number(item.id) === driverReservationId);
      if (!driver) {
        return NextResponse.json({ error: "Vairuotojas neberastas." }, { status: 404 });
      }

      const currentBookings = Array.isArray(driver.rideReservations) ? driver.rideReservations.filter(isRecord) : [];
      const removedBooking = currentBookings.find((booking) => String(booking.passengerPersonId ?? "") === passengerPersonId);
      if (!removedBooking) {
        return NextResponse.json({ error: "Ši transporto rezervacija jau atšaukta." }, { status: 409 });
      }

      const now = new Date();
      const nextDriver = {
        ...driver,
        rideReservations: currentBookings.filter((booking) => String(booking.passengerPersonId ?? "") !== passengerPersonId),
      };
      const nextReservations = reservations.map((item) => (Number(item.id) === driverReservationId ? nextDriver : item));
      const driverLabel = maskName(activePeople(driver)[0] ?? {});
      const passengerLabel = String(removedBooking.passengerName ?? "Dalyvis");
      const notification = {
        id: now.getTime(),
        message: `${passengerLabel} atšaukė transporto vietą pas ${driverLabel}.`,
        createdAt: formatDateTime(now),
      };
      const notifications = Array.isArray(payload.notifications) ? payload.notifications.filter(isRecord) : [];
      const nextNotifications = [notification, ...notifications];
      const previousSectionUpdatedAt = isRecord(payload[SECTION_TIMESTAMPS_KEY]) ? payload[SECTION_TIMESTAMPS_KEY] : {};
      const timestamp = now.getTime();
      const nextPayload = {
        ...payload,
        reservations: nextReservations,
        notifications: nextNotifications,
        [SECTION_TIMESTAMPS_KEY]: {
          ...previousSectionUpdatedAt,
          reservations: timestamp,
          notifications: timestamp,
        },
      };

      let update = supabase.from("event_state").update({ payload: nextPayload }).eq("id", STATE_ID);
      if (state.updated_at) update = update.eq("updated_at", state.updated_at);
      const { data: updatedRows, error: updateError } = await update.select("id");
      if (updateError) throw updateError;
      if (!updatedRows?.length) continue;

      return NextResponse.json({
        ok: true,
        reservations: nextReservations.map(publicReservation),
        notifications: nextNotifications,
      });
    }

    return NextResponse.json({ error: "Rezervaciją tuo pat metu pakeitė kitas žmogus. Bandyk dar kartą." }, { status: 409 });
  } catch (error) {
    console.error("Failed to cancel a ride seat", error);
    return NextResponse.json({ error: "Nepavyko atšaukti transporto vietos." }, { status: 500 });
  }
}
