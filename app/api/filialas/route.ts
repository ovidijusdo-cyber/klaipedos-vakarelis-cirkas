import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "../../../lib/supabase/server";

export const dynamic = "force-dynamic";

const STATE_ID = "filialas-interest-2027-04";
const MAX_INTERESTS = 500;

type Interest = {
  id: string;
  fullName: string;
  createdAt: string;
};

function storedInterests(payload: unknown): Interest[] {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return [];
  const registrations = (payload as Record<string, unknown>).registrations;
  if (!Array.isArray(registrations)) return [];
  return registrations.filter((item): item is Interest =>
    item !== null &&
    typeof item === "object" &&
    typeof item.id === "string" &&
    typeof item.fullName === "string" &&
    typeof item.createdAt === "string",
  );
}

function response(registrations: Interest[], status = 200) {
  return NextResponse.json({ registrations, count: registrations.length }, {
    status,
    headers: { "Cache-Control": "private, no-store, max-age=0" },
  });
}

export async function GET() {
  try {
    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase
      .from("event_state")
      .select("payload")
      .eq("id", STATE_ID)
      .maybeSingle();
    if (error) throw error;
    return response(storedInterests(data?.payload));
  } catch (error) {
    console.error("Failed to load filialas interest list", error);
    return NextResponse.json({ error: "Nepavyko įkelti norinčiųjų sąrašo." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    if (Number(request.headers.get("content-length") ?? 0) > 2048) {
      return NextResponse.json({ error: "Prašymas per ilgas." }, { status: 413 });
    }

    const body = await request.json();
    const fullName: string = typeof body?.fullName === "string"
      ? body.fullName.normalize("NFC").trim().replace(/\s+/g, " ")
      : "";
    const words = fullName.split(" ");
    if (
      fullName.length < 3 ||
      fullName.length > 100 ||
      words.length < 2 ||
      words.some((word) => !/^[\p{L}\p{M}]+(?:[-'’][\p{L}\p{M}]+)*$/u.test(word))
    ) {
      return NextResponse.json({ error: "Įrašyk vardą ir pavardę." }, { status: 400 });
    }
    if (body?.publicNameConsent !== true) {
      return NextResponse.json({ error: "Patvirtink, kad tavo vardas bus matomas šiame sąraše." }, { status: 400 });
    }

    const supabase = createSupabaseServerClient();
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const { data: state, error: loadError } = await supabase
        .from("event_state")
        .select("payload, updated_at")
        .eq("id", STATE_ID)
        .maybeSingle();
      if (loadError) throw loadError;

      const registrations = storedInterests(state?.payload);
      if (registrations.some((item) => item.fullName.toLocaleLowerCase("lt-LT") === fullName.toLocaleLowerCase("lt-LT"))) {
        return NextResponse.json({ error: "Šis vardas ir pavardė jau įrašyti." }, { status: 409 });
      }
      if (registrations.length >= MAX_INTERESTS) {
        return NextResponse.json({ error: "Norinčiųjų sąrašas šiuo metu pilnas." }, { status: 409 });
      }

      const next = [...registrations, { id: randomUUID(), fullName, createdAt: new Date().toISOString() }];
      if (!state) {
        const { error } = await supabase.from("event_state").insert({
          id: STATE_ID,
          payload: { registrations: next },
        });
        if (!error) return response(next, 201);
        if (error.code === "23505") continue;
        throw error;
      }

      const { data: updated, error } = await supabase
        .from("event_state")
        .update({ payload: { registrations: next } })
        .eq("id", STATE_ID)
        .eq("updated_at", state.updated_at)
        .select("id");
      if (error) throw error;
      if (updated?.length) return response(next, 201);
    }

    return NextResponse.json({ error: "Sąrašas ką tik pasikeitė. Bandyk dar kartą." }, { status: 409 });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "Netinkami registracijos duomenys." }, { status: 400 });
    }
    console.error("Failed to save filialas interest", error);
    return NextResponse.json({ error: "Nepavyko įrašyti vardo. Bandyk dar kartą." }, { status: 500 });
  }
}
