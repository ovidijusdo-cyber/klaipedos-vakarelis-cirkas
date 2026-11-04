import { createHash, randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "../../../lib/supabase/server";
import {
  hasDeviceVoted,
  isPartyBallotCategory,
  parsePartyBallotVotes,
  partyBallotParticipants,
  partyBallotResults,
  PARTY_BALLOT_STATE_ID,
  type PartyBallotVote,
} from "../../../lib/party-ballot";

export const dynamic = "force-dynamic";

const COOKIE_NAME = "party_ballot_device_2026";
const MAX_UPDATE_RETRIES = 8;

function deviceToken(request: NextRequest) {
  const token = request.cookies.get(COOKIE_NAME)?.value;
  return token && /^[a-f0-9]{64}$/.test(token) ? token : null;
}

function hashDevice(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

export async function GET(request: NextRequest) {
  try {
    const supabase = createSupabaseServerClient();
    const [party, ballot] = await Promise.all([
      supabase.from("event_state").select("payload").eq("id", "main").maybeSingle(),
      supabase.from("event_state").select("payload").eq("id", PARTY_BALLOT_STATE_ID).maybeSingle(),
    ]);
    if (party.error) throw party.error;
    if (ballot.error) throw ballot.error;

    const participants = partyBallotParticipants(party.data?.payload);
    const votes = parsePartyBallotVotes(ballot.data?.payload);
    const token = deviceToken(request) ?? randomBytes(32).toString("hex");
    const deviceHash = hashDevice(token);
    const response = json({
      participants,
      results: partyBallotResults(votes, participants),
      votedCategoryIds: votes.filter((vote) => vote.deviceHash === deviceHash).map((vote) => vote.categoryId),
    });
    if (!deviceToken(request)) {
      response.cookies.set(COOKIE_NAME, token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        path: "/api/balsavimas",
        maxAge: 60 * 60 * 24 * 90,
      });
    }
    return response;
  } catch (error) {
    console.error("Failed to load party ballot", error);
    return json({ error: "Balsavimo duomenų įkelti nepavyko." }, 500);
  }
}

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  const allowedHosts = new Set([
    new URL(request.url).host,
    request.headers.get("host"),
    request.headers.get("x-forwarded-host")?.split(",")[0].trim(),
    "klaipedosvakaras.fun",
    "www.klaipedosvakaras.fun",
  ]);
  let originHost: string | null = null;
  try {
    originHost = origin ? new URL(origin).host : null;
  } catch {
    return json({ error: "Neleistina užklausa." }, 403);
  }
  if (!originHost || !allowedHosts.has(originHost)) return json({ error: "Neleistina užklausa." }, 403);
  const token = deviceToken(request);
  if (!token) return json({ error: "Atnaujink puslapį ir bandyk dar kartą. Naršyklėje turi būti įjungti slapukai." }, 428);

  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return json({ error: "Neteisingi balsavimo duomenys." }, 400);
  }
  const body = input && typeof input === "object" && !Array.isArray(input) ? input as Record<string, unknown> : {};
  if (!isPartyBallotCategory(body.categoryId) || typeof body.targetPersonId !== "string") {
    return json({ error: "Pasirink nominaciją ir dalyvį." }, 400);
  }

  try {
    const supabase = createSupabaseServerClient();
    const { data: party, error: partyError } = await supabase.from("event_state")
      .select("payload").eq("id", "main").maybeSingle();
    if (partyError) throw partyError;
    const participants = partyBallotParticipants(party?.payload);
    if (!participants.some((person) => person.id === body.targetPersonId)) {
      return json({ error: "Šio dalyvio registracijoje nebėra. Atnaujink puslapį." }, 409);
    }

    const deviceHash = hashDevice(token);
    for (let attempt = 0; attempt < MAX_UPDATE_RETRIES; attempt += 1) {
      const { data: state, error: loadError } = await supabase.from("event_state")
        .select("payload, updated_at").eq("id", PARTY_BALLOT_STATE_ID).maybeSingle();
      if (loadError) throw loadError;
      const votes = parsePartyBallotVotes(state?.payload);
      if (hasDeviceVoted(votes, deviceHash, body.categoryId)) {
        return json({ error: "Iš šio įrenginio už šią nominaciją jau balsuota." }, 409);
      }
      const nextVote: PartyBallotVote = {
        categoryId: body.categoryId,
        targetPersonId: body.targetPersonId,
        deviceHash,
        createdAt: new Date().toISOString(),
      };
      const nextVotes = [...votes, nextVote];
      if (!state) {
        const { error } = await supabase.from("event_state").insert({
          id: PARTY_BALLOT_STATE_ID,
          payload: { votes: nextVotes },
        });
        if (error?.code === "23505") continue;
        if (error) throw error;
      } else {
        const { data: updated, error } = await supabase.from("event_state")
          .update({ payload: { votes: nextVotes } })
          .eq("id", PARTY_BALLOT_STATE_ID)
          .eq("updated_at", state.updated_at)
          .select("id");
        if (error) throw error;
        if (!updated?.length) continue;
      }
      return json({
        results: partyBallotResults(nextVotes, participants),
        votedCategoryIds: nextVotes.filter((vote) => vote.deviceHash === deviceHash).map((vote) => vote.categoryId),
      });
    }
    return json({ error: "Daug balsų vienu metu. Bandyk dar kartą." }, 409);
  } catch (error) {
    console.error("Failed to save party ballot vote", error);
    return json({ error: "Balso išsaugoti nepavyko. Bandyk dar kartą." }, 500);
  }
}
