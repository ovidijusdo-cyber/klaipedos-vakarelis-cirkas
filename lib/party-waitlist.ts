import { createSupabaseServerClient } from "./supabase/server";

export const PARTY_CAPACITY = 157;
export const PARTY_WAITLIST_STATE_ID = "party-waitlist-2026-11-07";
const MAX_UPDATE_RETRIES = 6;

export type PartyWaitlistEntry = {
  id: string;
  fullName: string;
  email: string;
  status: "waiting" | "sending" | "notified" | "expired";
  createdAt: string;
  claimAt: string | null;
  notifiedAt: string | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function partyOccupied(payload: unknown) {
  if (!isRecord(payload) || !Array.isArray(payload.reservations)) return 0;
  return payload.reservations.reduce((total: number, reservation: unknown) => {
    if (!isRecord(reservation) || !Array.isArray(reservation.people)) return total;
    return total + reservation.people.filter((person: unknown) => isRecord(person) && person.active !== false).length;
  }, 0);
}

export function parsePartyWaitlist(payload: unknown): PartyWaitlistEntry[] {
  if (!isRecord(payload) || !Array.isArray(payload.entries)) return [];
  return payload.entries.filter((entry: unknown): entry is PartyWaitlistEntry =>
    isRecord(entry) &&
    typeof entry.id === "string" &&
    typeof entry.fullName === "string" &&
    typeof entry.email === "string" &&
    typeof entry.createdAt === "string" &&
    (entry.status === "waiting" || entry.status === "sending" || entry.status === "notified" || entry.status === "expired"),
  );
}

function escapeHtml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

async function updateEntry(id: string, status: PartyWaitlistEntry["status"], now: string | null) {
  const supabase = createSupabaseServerClient();
  for (let attempt = 0; attempt < MAX_UPDATE_RETRIES; attempt += 1) {
    const { data: state, error: loadError } = await supabase.from("event_state")
      .select("payload, updated_at").eq("id", PARTY_WAITLIST_STATE_ID).maybeSingle();
    if (loadError) throw loadError;
    if (!state) return;
    const entries = parsePartyWaitlist(state.payload);
    const target = entries.find((entry) => entry.id === id && entry.status === "sending");
    if (!target) return;
    const next = entries.map((entry) => entry.id === id ? {
      ...entry,
      status,
      claimAt: null,
      notifiedAt: status === "notified" ? now : null,
    } : entry);
    const { data: updated, error } = await supabase.from("event_state")
      .update({ payload: { entries: next } })
      .eq("id", PARTY_WAITLIST_STATE_ID)
      .eq("updated_at", state.updated_at)
      .select("id");
    if (error) throw error;
    if (updated?.length) return;
  }
  throw new Error("Failed to update party waitlist notification status");
}

async function claimNextEntry() {
  const supabase = createSupabaseServerClient();
  for (let attempt = 0; attempt < MAX_UPDATE_RETRIES; attempt += 1) {
    const [mainResult, queueResult] = await Promise.all([
      supabase.from("event_state").select("payload").eq("id", "main").maybeSingle(),
      supabase.from("event_state").select("payload, updated_at").eq("id", PARTY_WAITLIST_STATE_ID).maybeSingle(),
    ]);
    if (mainResult.error) throw mainResult.error;
    if (queueResult.error) throw queueResult.error;
    if (!queueResult.data) return null;

    const available = Math.max(0, PARTY_CAPACITY - partyOccupied(mainResult.data?.payload));
    const entries = parsePartyWaitlist(queueResult.data.payload);
    const now = Date.now();
    const alreadyInvited = entries.filter((entry) =>
      entry.status === "notified" || (entry.status === "sending" && entry.claimAt && now - Date.parse(entry.claimAt) < 5 * 60_000),
    ).length;
    if (available <= alreadyInvited) return null;

    const candidate = entries.find((entry) =>
      entry.status === "waiting" || (entry.status === "sending" && (!entry.claimAt || now - Date.parse(entry.claimAt) >= 5 * 60_000)),
    );
    if (!candidate) return null;
    const next = entries.map((entry) => entry.id === candidate.id ? {
      ...entry,
      status: "sending" as const,
      claimAt: new Date(now).toISOString(),
    } : entry);
    const { data: updated, error } = await supabase.from("event_state")
      .update({ payload: { entries: next } })
      .eq("id", PARTY_WAITLIST_STATE_ID)
      .eq("updated_at", queueResult.data.updated_at)
      .select("id");
    if (error) throw error;
    if (updated?.length) return candidate;
  }
  return null;
}

export async function expirePartyWaitlistInvitations() {
  const supabase = createSupabaseServerClient();
  for (let attempt = 0; attempt < MAX_UPDATE_RETRIES; attempt += 1) {
    const { data: state, error: loadError } = await supabase.from("event_state")
      .select("payload, updated_at").eq("id", PARTY_WAITLIST_STATE_ID).maybeSingle();
    if (loadError) throw loadError;
    if (!state) return;
    const entries = parsePartyWaitlist(state.payload);
    if (!entries.some((entry) => entry.status === "notified")) return;
    const next = entries.map((entry) => entry.status === "notified" ? { ...entry, status: "expired" as const } : entry);
    const { data: updated, error } = await supabase.from("event_state")
      .update({ payload: { entries: next } })
      .eq("id", PARTY_WAITLIST_STATE_ID)
      .eq("updated_at", state.updated_at)
      .select("id");
    if (error) throw error;
    if (updated?.length) return;
  }
  throw new Error("Failed to expire party waitlist invitations");
}

export async function notifyAvailablePartyWaitlistGuests() {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.REMINDER_EMAIL_FROM;
  if (!apiKey || !from) return { sent: 0, skipped: "missing_email_config" };

  let sent = 0;
  for (let seat = 0; seat < PARTY_CAPACITY; seat += 1) {
    const candidate = await claimNextEntry();
    if (!candidate) break;
    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "Idempotency-Key": `party-waitlist-${candidate.id}`,
        },
        body: JSON.stringify({
          from,
          to: [candidate.email],
          subject: "Atsilaisvino vieta vakarėlyje „Tautos“",
          html: `<p>Sveiki, ${escapeHtml(candidate.fullName)}!</p><p>Į vakarėlį „Tautos. Aplink pasaulį per 360 minučių“ atsilaisvino vieta. Jei dar nori dalyvauti, atidaryk <a href="https://klaipedosvakaras.fun/vakarelis">registracijos puslapį</a> ir užsiregistruok.</p><p><strong>Svarbu:</strong> šis laiškas vietos nerezervuoja. Ji atiteks pirmam registraciją užbaigusiam žmogui.</p>`,
        }),
      });
      if (!response.ok) throw new Error(`Resend returned ${response.status}`);
      await updateEntry(candidate.id, "notified", new Date().toISOString());
      sent += 1;
    } catch (error) {
      console.error("Failed to notify party waitlist guest", error);
      await updateEntry(candidate.id, "waiting", null);
      break;
    }
  }
  return { sent };
}
