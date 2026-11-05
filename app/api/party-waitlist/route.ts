import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "../../../lib/supabase/server";
import {
  PARTY_CAPACITY,
  PARTY_WAITLIST_STATE_ID,
  parsePartyWaitlist,
  partyOccupied,
} from "../../../lib/party-waitlist";

export const dynamic = "force-dynamic";

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

export async function POST() {
  return response({ error: "Laukiančiųjų sąrašas naujų įrašų nebepriima." }, 410);
}
