import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "../../../lib/supabase/server";

const STATE_ID = "main";
const ADMIN_PIN = process.env.ADMIN_PIN;

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function isAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");

  if (!secret) {
    return false;
  }

  return authHeader === `Bearer ${secret}`;
}

async function createBackup() {
  const supabase = createSupabaseServerClient();
  const { data: state, error: stateError } = await supabase
    .from("event_state")
    .select("payload, updated_at")
    .eq("id", STATE_ID)
    .maybeSingle();

  if (stateError) {
    throw stateError;
  }

  if (!state?.payload) {
    return NextResponse.json({ error: "No state found to back up" }, { status: 404 });
  }

  const backupDate = todayIsoDate();
  const { error: backupError } = await supabase.from("event_state_backups").upsert(
    {
      state_id: STATE_ID,
      backup_date: backupDate,
      payload: state.payload,
      source_updated_at: state.updated_at,
    },
    {
      onConflict: "state_id,backup_date",
    },
  );

  if (backupError) {
    throw backupError;
  }

  return NextResponse.json({ ok: true, backupDate });
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    return await createBackup();
  } catch (error) {
    console.error("Failed to create event state backup", error);
    return NextResponse.json({ error: "Failed to create backup" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const pin = String(body?.adminPin ?? "").trim();

    if (!ADMIN_PIN || pin !== ADMIN_PIN.trim()) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return await createBackup();
  } catch (error) {
    console.error("Failed to create manual event state backup", error);
    return NextResponse.json({ error: "Failed to create backup" }, { status: 500 });
  }
}
