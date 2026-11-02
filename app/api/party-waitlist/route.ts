import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "../../../lib/supabase/server";
import {
  PARTY_CAPACITY,
  PARTY_WAITLIST_STATE_ID,
  notifyAvailablePartyWaitlistGuests,
  parsePartyWaitlist,
  partyOccupied,
  type PartyWaitlistEntry,
} from "../../../lib/party-waitlist";

export const dynamic = "force-dynamic";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_ENTRIES = 500;

function isSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (!origin) return process.env.NODE_ENV !== "production";
  try {
    return Boolean(host) && new URL(origin).host === host;
  } catch {
    return false;
  }
}

function response(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store, max-age=0" } });
}

async function loadSummary(adminPin: string) {
  const supabase = createSupabaseServerClient();
  const [mainResult, queueResult] = await Promise.all([
    supabase.from("event_state").select("payload").eq("id", "main").maybeSingle(),
    supabase.from("event_state").select("payload").eq("id", PARTY_WAITLIST_STATE_ID).maybeSingle(),
  ]);
  if (mainResult.error) throw mainResult.error;
  if (queueResult.error) throw queueResult.error;
  const occupied = partyOccupied(mainResult.data?.payload);
  const entries = parsePartyWaitlist(queueResult.data?.payload);
  const isAdmin = Boolean(process.env.ADMIN_PIN) && adminPin === process.env.ADMIN_PIN;
  return {
    occupied,
    remaining: Math.max(0, PARTY_CAPACITY - occupied),
    waitingCount: entries.filter((entry) => entry.status === "waiting" || entry.status === "sending").length,
    emailConfigured: Boolean(process.env.RESEND_API_KEY && process.env.REMINDER_EMAIL_FROM),
    ...(isAdmin ? { entries } : {}),
  };
}

export async function GET(request: Request) {
  try {
    return response(await loadSummary(request.headers.get("x-admin-pin") ?? ""));
  } catch (error) {
    console.error("Failed to load party waitlist", error);
    return response({ error: "Nepavyko patikrinti vietų. Bandyk dar kartą." }, 500);
  }
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return response({ error: "Netinkama užklausos kilmė." }, 403);
  try {
    const raw = await request.text();
    if (raw.length > 2048) return response({ error: "Prašymas per ilgas." }, 413);
    const body = JSON.parse(raw);
    const fullName: string = typeof body?.fullName === "string" ? body.fullName.normalize("NFC").trim().replace(/\s+/g, " ") : "";
    const email: string = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
    const words = fullName.split(" ");
    if (fullName.length < 3 || fullName.length > 100 || words.length < 2 ||
      words.some((word) => !/^[\p{L}\p{M}]+(?:[-'’][\p{L}\p{M}]+)*$/u.test(word)) ||
      email.length > 254 || !EMAIL_PATTERN.test(email)) {
      return response({ error: "Įrašyk vardą, pavardę ir galiojantį el. paštą." }, 400);
    }
    if (body?.consent !== true) return response({ error: "Patvirtink duomenų tvarkymą pranešimui apie vietą." }, 400);

    const supabase = createSupabaseServerClient();
    for (let attempt = 0; attempt < 6; attempt += 1) {
      const [mainResult, queueResult] = await Promise.all([
        supabase.from("event_state").select("payload").eq("id", "main").maybeSingle(),
        supabase.from("event_state").select("payload, updated_at").eq("id", PARTY_WAITLIST_STATE_ID).maybeSingle(),
      ]);
      if (mainResult.error) throw mainResult.error;
      if (queueResult.error) throw queueResult.error;
      if (partyOccupied(mainResult.data?.payload) < PARTY_CAPACITY) {
        return response({ error: "Atsirado laisva vieta. Užsiregistruok įprastu būdu.", hasSpace: true }, 409);
      }

      const entries = parsePartyWaitlist(queueResult.data?.payload);
      const normalizedName = fullName.toLocaleLowerCase("lt-LT");
      const existing = entries.find((entry) => entry.email === email && entry.fullName.toLocaleLowerCase("lt-LT") === normalizedName);
      if (existing) return response({ ok: true, alreadyJoined: true });
      if (entries.length >= MAX_ENTRIES) return response({ error: "Laukiančiųjų sąrašas pilnas." }, 409);

      const entry: PartyWaitlistEntry = {
        id: randomUUID(), fullName, email, status: "waiting",
        createdAt: new Date().toISOString(), claimAt: null, notifiedAt: null,
      };
      const payload = { entries: [...entries, entry] };
      if (!queueResult.data) {
        const { error } = await supabase.from("event_state").insert({ id: PARTY_WAITLIST_STATE_ID, payload });
        if (error?.code === "23505") continue;
        if (error) throw error;
      } else {
        const { data: updated, error } = await supabase.from("event_state")
          .update({ payload })
          .eq("id", PARTY_WAITLIST_STATE_ID)
          .eq("updated_at", queueResult.data.updated_at)
          .select("id");
        if (error) throw error;
        if (!updated?.length) continue;
      }
      await notifyAvailablePartyWaitlistGuests().catch((error) => console.error("Failed to check party waitlist availability", error));
      return response({ ok: true, alreadyJoined: false }, 201);
    }
    return response({ error: "Sąrašas ką tik pasikeitė. Bandyk dar kartą." }, 409);
  } catch (error) {
    if (error instanceof SyntaxError) return response({ error: "Netinkami registracijos duomenys." }, 400);
    console.error("Failed to join party waitlist", error);
    return response({ error: "Nepavyko įtraukti į sąrašą. Bandyk dar kartą." }, 500);
  }
}
