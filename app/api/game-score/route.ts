import { createHash, createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "../../../lib/supabase/server";

export const runtime = "nodejs";

const STATE_ID = "main";
const INTERNAL_SESSIONS_KEY = "__gameScoreSessions";
const SECTION_TIMESTAMPS_KEY = "__sectionUpdatedAt";
const SESSION_TTL_MS = 2 * 60 * 60 * 1000;
const MIN_GAME_MS = 5_000;
const MAX_SAVE_RETRIES = 5;
const MAX_STORED_SCORES = 100;
const MAX_STORED_SESSIONS = 500;
const LINE_POINTS = [0, 100, 300, 500, 800];

type SessionPayload = {
  fingerprint: string;
  id: string;
  issuedAt: number;
  version: 1;
};

type ProofEvent = {
  cleared: number;
  dropPoints: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function signingSecret() {
  const secret = process.env.GAME_SCORE_SECRET ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw new Error("Missing game score signing secret");
  return secret;
}

function requestFingerprint(request: Request) {
  const source = `${request.headers.get("user-agent") ?? ""}|${request.headers.get("accept-language") ?? ""}`;
  return createHash("sha256").update(source).digest("hex").slice(0, 24);
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

function sign(value: string) {
  return createHmac("sha256", signingSecret()).update(value).digest("base64url");
}

function createSessionToken(request: Request) {
  const payload: SessionPayload = {
    fingerprint: requestFingerprint(request),
    id: randomUUID(),
    issuedAt: Date.now(),
    version: 1,
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${encoded}.${sign(encoded)}`;
}

function verifySessionToken(request: Request, token: unknown): SessionPayload | null {
  if (typeof token !== "string" || token.length > 1_000) return null;
  const [encoded, receivedSignature, extra] = token.split(".");
  if (!encoded || !receivedSignature || extra) return null;
  const expectedSignature = sign(encoded);
  const received = Buffer.from(receivedSignature);
  const expected = Buffer.from(expectedSignature);
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) return null;

  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as SessionPayload;
    if (
      payload.version !== 1 ||
      typeof payload.id !== "string" ||
      typeof payload.issuedAt !== "number" ||
      payload.fingerprint !== requestFingerprint(request)
    ) return null;
    const age = Date.now() - payload.issuedAt;
    return age >= 0 && age <= SESSION_TTL_MS ? payload : null;
  } catch {
    return null;
  }
}

function normalizeName(value: unknown) {
  const name = String(value ?? "").trim().replace(/\s+/g, " ");
  return name.length >= 2 && name.length <= 50 && /^[\p{L}\p{M}0-9 .'-]+$/u.test(name) ? name : null;
}

function parseProofEvents(value: unknown): ProofEvent[] | null {
  if (!Array.isArray(value) || value.length < 5 || value.length > 2_000) return null;
  const events: ProofEvent[] = [];
  for (const item of value) {
    if (!isRecord(item)) return null;
    const cleared = Number(item.cleared);
    const dropPoints = Number(item.dropPoints);
    if (!Number.isInteger(cleared) || cleared < 0 || cleared > 4) return null;
    if (!Number.isInteger(dropPoints) || dropPoints < 0 || dropPoints > 34) return null;
    events.push({ cleared, dropPoints });
  }
  return events;
}

function verifyScore(body: Record<string, unknown>, session: SessionPayload) {
  const proof = isRecord(body.proof) ? body.proof : null;
  const events = parseProofEvents(proof?.events);
  const submittedScore = Number(body.score);
  if (!proof || !events || !Number.isInteger(submittedScore) || submittedScore < 0 || submittedScore > 2_000_000) return null;

  const elapsed = Date.now() - session.issuedAt;
  if (elapsed < Math.max(MIN_GAME_MS, events.length * 60) || elapsed > SESSION_TTL_MS) return null;

  let combo = 0;
  let lines = 0;
  let maxClear = 0;
  let maxCombo = 0;
  let score = 0;

  for (const event of events) {
    const levelBeforeClear = 1 + Math.floor(lines / 10);
    combo = event.cleared ? combo + 1 : 0;
    score += event.dropPoints;
    score += (LINE_POINTS[event.cleared] ?? 0) * levelBeforeClear;
    score += event.cleared ? Math.max(0, combo - 1) * 50 * levelBeforeClear : 0;
    lines += event.cleared;
    maxClear = Math.max(maxClear, event.cleared);
    maxCombo = Math.max(maxCombo, combo);
  }

  const level = 1 + Math.floor(lines / 10);
  const physicallyPossibleLines = Math.floor((events.length * 4) / 10);
  if (lines > physicallyPossibleLines || score !== submittedScore) return null;
  if (
    Number(proof.lines) !== lines ||
    Number(proof.level) !== level ||
    Number(proof.maxClear) !== maxClear ||
    Number(proof.maxCombo) !== maxCombo
  ) return null;

  return { eventsCount: events.length, level, lines, maxClear, maxCombo, score };
}

function publicScores(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!isRecord(item)) return [];
    const id = Number(item.id);
    const score = Number(item.score);
    const name = normalizeName(item.name);
    const createdAt = typeof item.createdAt === "string" ? item.createdAt : "";
    return Number.isFinite(id) && Number.isInteger(score) && score >= 0 && name && createdAt
      ? [{ id, name, score, createdAt }]
      : [];
  });
}

export async function POST(request: Request) {
  try {
    if (!isSameOrigin(request)) {
      return NextResponse.json({ error: "Invalid request origin" }, { status: 403 });
    }

    const body = await request.json();
    if (!isRecord(body)) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

    if (body.action === "start") {
      return NextResponse.json(
        { token: createSessionToken(request), expiresInMs: SESSION_TTL_MS },
        { headers: { "Cache-Control": "no-store" } },
      );
    }

    if (body.action !== "finish") {
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }

    const proof = isRecord(body.proof) ? body.proof : null;
    const session = verifySessionToken(request, proof?.sessionToken);
    const name = normalizeName(body.name);
    if (!session || !name) return NextResponse.json({ error: "Invalid game session" }, { status: 400 });
    const verified = verifyScore(body, session);
    if (!verified) return NextResponse.json({ error: "Score verification failed" }, { status: 422 });

    const sessionHash = createHash("sha256").update(session.id).digest("hex");
    const now = new Date().toISOString();
    const scoreEntry = {
      id: Date.now() * 100 + Math.floor(Math.random() * 100),
      name,
      score: verified.score,
      createdAt: now,
    };
    const notificationEntry = {
      id: scoreEntry.id + 1,
      message: `${name} išsaugojo žaidimo rezultatą: ${verified.score} tšk.`,
      createdAt: now,
    };
    const supabase = createSupabaseServerClient();

    for (let attempt = 1; attempt <= MAX_SAVE_RETRIES; attempt += 1) {
      const { data: existingState, error: loadError } = await supabase
        .from("event_state")
        .select("payload, updated_at")
        .eq("id", STATE_ID)
        .maybeSingle();
      if (loadError) throw loadError;

      const existingPayload = isRecord(existingState?.payload) ? existingState.payload : {};
      const existingSessions = Array.isArray(existingPayload[INTERNAL_SESSIONS_KEY])
        ? (existingPayload[INTERNAL_SESSIONS_KEY] as unknown[]).filter(isRecord)
        : [];
      const previousSession = existingSessions.find((item) => item.hash === sessionHash);
      if (previousSession) {
        return NextResponse.json({ ok: true, gameScores: publicScores(existingPayload.gameScores), duplicate: true });
      }

      const gameScores = [...publicScores(existingPayload.gameScores), scoreEntry]
        .sort((a, b) => b.score - a.score || Date.parse(b.createdAt) - Date.parse(a.createdAt))
        .slice(0, MAX_STORED_SCORES);
      const notifications = [notificationEntry, ...(Array.isArray(existingPayload.notifications) ? existingPayload.notifications : [])]
        .slice(0, 500);
      const sessions = [
        { hash: sessionHash, scoreId: scoreEntry.id, expiresAt: Date.now() + SESSION_TTL_MS },
        ...existingSessions.filter((item) => Number(item.expiresAt) > Date.now() - SESSION_TTL_MS),
      ].slice(0, MAX_STORED_SESSIONS);
      const existingSectionUpdatedAt = isRecord(existingPayload[SECTION_TIMESTAMPS_KEY])
        ? existingPayload[SECTION_TIMESTAMPS_KEY]
        : {};
      const updatedAt = Date.now();
      const nextPayload = {
        ...existingPayload,
        gameScores,
        notifications,
        [INTERNAL_SESSIONS_KEY]: sessions,
        [SECTION_TIMESTAMPS_KEY]: {
          ...existingSectionUpdatedAt,
          gameScores: updatedAt,
          notifications: updatedAt,
        },
      };

      let query = supabase.from("event_state").update({ payload: nextPayload }).eq("id", STATE_ID);
      if (existingState?.updated_at) query = query.eq("updated_at", existingState.updated_at);
      const { data: updatedRows, error: updateError } = await query.select("id");
      if (updateError) throw updateError;
      if (updatedRows?.length) {
        return NextResponse.json({ ok: true, gameScores, notification: notificationEntry });
      }
    }

    return NextResponse.json({ error: "Could not save verified score" }, { status: 409 });
  } catch (error) {
    console.error("Failed to process game score", error);
    return NextResponse.json({ error: "Failed to process game score" }, { status: 500 });
  }
}
