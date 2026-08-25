import { createHmac, timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "../../../lib/supabase/server";

const ADMIN_PIN = process.env.ADMIN_PIN;
const MAX_PLAYERS = 200;
const MAX_TEAMS = 12;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type KvadratasTeamRow = {
  id: string;
  name: string;
  sort_order: number;
  captain_player_id: string | null;
  captain_code_hash?: string | null;
  created_at: string;
  updated_at: string;
};

type KvadratasPlayerRow = {
  id: string;
  first_name: string;
  last_name: string;
  preferred_team_id: string | null;
  assigned_team_id: string | null;
  created_at: string;
  updated_at: string;
};

function cleanText(value: unknown, maxLength = 80) {
  return String(value ?? "").trim().replace(/\s+/g, " ").slice(0, maxLength);
}

function cleanId(value: unknown) {
  const id = cleanText(value, 40);
  return UUID_PATTERN.test(id) ? id : "";
}

function normalizeCaptainCode(value: unknown) {
  return cleanText(value, 40).toLocaleLowerCase("lt");
}

function captainCodeHash(code: string) {
  const secret = process.env.KVADRATAS_CAPTAIN_SECRET ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw new Error("Missing captain code secret");
  return createHmac("sha256", secret).update(`kvadratas:${code}`).digest("hex");
}

function hashesMatch(actual: string | null | undefined, expected: string) {
  if (!actual || actual.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(actual), Buffer.from(expected));
}

function isAdminPin(value: unknown) {
  return Boolean(ADMIN_PIN) && cleanText(value, 100) === ADMIN_PIN;
}

function publicTeam(row: KvadratasTeamRow) {
  return {
    id: row.id,
    name: row.name,
    sortOrder: row.sort_order,
    captainPlayerId: row.captain_player_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function publicPlayer(row: KvadratasPlayerRow) {
  return {
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    preferredTeamId: row.preferred_team_id,
    assignedTeamId: row.assigned_team_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function loadPublicState() {
  const supabase = createSupabaseServerClient();
  const [teamsResult, playersResult] = await Promise.all([
    supabase
      .from("kvadratas_teams")
      .select("id, name, sort_order, captain_player_id, created_at, updated_at")
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true }),
    supabase
      .from("kvadratas_players")
      .select("id, first_name, last_name, preferred_team_id, assigned_team_id, created_at, updated_at")
      .order("created_at", { ascending: true }),
  ]);

  if (teamsResult.error) throw teamsResult.error;
  if (playersResult.error) throw playersResult.error;

  return {
    teams: ((teamsResult.data ?? []) as KvadratasTeamRow[]).map(publicTeam),
    players: ((playersResult.data ?? []) as KvadratasPlayerRow[]).map(publicPlayer),
    serverTime: new Date().toISOString(),
  };
}

async function stateResponse(status = 200) {
  return NextResponse.json(await loadPublicState(), {
    status,
    headers: { "Cache-Control": "no-store, max-age=0" },
  });
}

async function existingTeam(teamId: string) {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("kvadratas_teams")
    .select("id, name, sort_order, captain_player_id, captain_code_hash, created_at, updated_at")
    .eq("id", teamId)
    .maybeSingle();
  if (error) throw error;
  return data as KvadratasTeamRow | null;
}

async function verifyCaptain(teamId: string, rawCode: unknown) {
  const code = normalizeCaptainCode(rawCode);
  if (!teamId || code.length < 4) return null;
  const team = await existingTeam(teamId);
  if (!team?.captain_player_id || !hashesMatch(team.captain_code_hash, captainCodeHash(code))) return null;
  return team;
}

export async function GET() {
  try {
    return await stateResponse();
  } catch (error) {
    console.error("Failed to load kvadratas state", error);
    return NextResponse.json({ error: "Nepavyko atnaujinti kvadrato registracijos." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const action = cleanText(body?.action, 40);
    const supabase = createSupabaseServerClient();
    const now = new Date().toISOString();

    if (action === "register") {
      const firstName = cleanText(body?.firstName);
      const lastName = cleanText(body?.lastName);
      const preferredTeamId = cleanId(body?.preferredTeamId) || null;
      if (!firstName || !lastName) {
        return NextResponse.json({ error: "Įrašyk vardą ir pavardę." }, { status: 400 });
      }
      if (preferredTeamId && !(await existingTeam(preferredTeamId))) {
        return NextResponse.json({ error: "Pasirinkta komanda neberasta." }, { status: 409 });
      }
      const { count, error: countError } = await supabase
        .from("kvadratas_players")
        .select("id", { count: "exact", head: true });
      if (countError) throw countError;
      if ((count ?? 0) >= MAX_PLAYERS) {
        return NextResponse.json({ error: "Registracijos vietos užpildytos." }, { status: 409 });
      }

      const { error } = await supabase.from("kvadratas_players").insert({
        first_name: firstName,
        last_name: lastName,
        preferred_team_id: preferredTeamId,
      });
      if (error?.code === "23505") {
        return NextResponse.json({ error: "Šis vardas ir pavardė jau užregistruoti." }, { status: 409 });
      }
      if (error) throw error;
      return await stateResponse(201);
    }

    if (action === "captain_verify") {
      const teamId = cleanId(body?.teamId);
      const team = await verifyCaptain(teamId, body?.captainCode);
      if (!team) return NextResponse.json({ error: "Neteisinga komanda arba kapitono kodas." }, { status: 401 });
      return NextResponse.json({ ok: true, teamId: team.id });
    }

    if (action === "captain_assign_player") {
      const teamId = cleanId(body?.teamId);
      const playerId = cleanId(body?.playerId);
      const team = await verifyCaptain(teamId, body?.captainCode);
      if (!team || !playerId) return NextResponse.json({ error: "Neteisingi kapitono duomenys." }, { status: 401 });

      const { data: player, error: playerError } = await supabase
        .from("kvadratas_players")
        .select("id, assigned_team_id")
        .eq("id", playerId)
        .maybeSingle();
      if (playerError) throw playerError;
      if (!player) return NextResponse.json({ error: "Žaidėjas neberastas." }, { status: 404 });
      if (player.assigned_team_id && player.assigned_team_id !== teamId) {
        return NextResponse.json({ error: "Žaidėją jau patvirtino kita komanda." }, { status: 409 });
      }

      const { error } = await supabase
        .from("kvadratas_players")
        .update({ assigned_team_id: teamId, updated_at: now })
        .eq("id", playerId);
      if (error) throw error;
      return await stateResponse();
    }

    if (!isAdminPin(body?.adminPin)) {
      return NextResponse.json({ error: "Neteisingas administratoriaus PIN." }, { status: 401 });
    }

    if (action === "create_team") {
      const name = cleanText(body?.name, 60);
      if (!name) return NextResponse.json({ error: "Įrašyk komandos pavadinimą." }, { status: 400 });
      const { data: teams, error: teamsError } = await supabase.from("kvadratas_teams").select("sort_order");
      if (teamsError) throw teamsError;
      if ((teams ?? []).length >= MAX_TEAMS) {
        return NextResponse.json({ error: `Galima sukurti iki ${MAX_TEAMS} komandų.` }, { status: 409 });
      }
      const maxOrder = Math.max(0, ...(teams ?? []).map((team) => Number(team.sort_order) || 0));
      const { error } = await supabase.from("kvadratas_teams").insert({ name, sort_order: maxOrder + 10 });
      if (error?.code === "23505") return NextResponse.json({ error: "Tokia komanda jau yra." }, { status: 409 });
      if (error) throw error;
      return await stateResponse(201);
    }

    if (action === "rename_team") {
      const teamId = cleanId(body?.teamId);
      const name = cleanText(body?.name, 60);
      if (!teamId || !name) return NextResponse.json({ error: "Patikrink komandą ir pavadinimą." }, { status: 400 });
      const { error } = await supabase.from("kvadratas_teams").update({ name, updated_at: now }).eq("id", teamId);
      if (error?.code === "23505") return NextResponse.json({ error: "Tokia komanda jau yra." }, { status: 409 });
      if (error) throw error;
      return await stateResponse();
    }

    if (action === "delete_team") {
      const teamId = cleanId(body?.teamId);
      if (!teamId) return NextResponse.json({ error: "Komanda nepasirinkta." }, { status: 400 });
      const { error } = await supabase.from("kvadratas_teams").delete().eq("id", teamId);
      if (error) throw error;
      return await stateResponse();
    }

    if (action === "assign_captain") {
      const teamId = cleanId(body?.teamId);
      const playerId = cleanId(body?.playerId) || null;
      const code = normalizeCaptainCode(body?.captainCode);
      if (!teamId || !(await existingTeam(teamId))) {
        return NextResponse.json({ error: "Komanda neberasta." }, { status: 404 });
      }
      if (!playerId) {
        const { error } = await supabase
          .from("kvadratas_teams")
          .update({ captain_player_id: null, captain_code_hash: null, updated_at: now })
          .eq("id", teamId);
        if (error) throw error;
        return await stateResponse();
      }
      if (code.length < 4) {
        return NextResponse.json({ error: "Kapitono kodą turi sudaryti bent 4 simboliai." }, { status: 400 });
      }
      const { data: player, error: playerError } = await supabase
        .from("kvadratas_players")
        .select("id")
        .eq("id", playerId)
        .maybeSingle();
      if (playerError) throw playerError;
      if (!player) return NextResponse.json({ error: "Žaidėjas neberastas." }, { status: 404 });

      const { error: clearError } = await supabase
        .from("kvadratas_teams")
        .update({ captain_player_id: null, captain_code_hash: null, updated_at: now })
        .eq("captain_player_id", playerId);
      if (clearError) throw clearError;
      const { error: playerUpdateError } = await supabase
        .from("kvadratas_players")
        .update({ assigned_team_id: teamId, updated_at: now })
        .eq("id", playerId);
      if (playerUpdateError) throw playerUpdateError;
      const { error: teamUpdateError } = await supabase
        .from("kvadratas_teams")
        .update({
          captain_player_id: playerId,
          captain_code_hash: captainCodeHash(code),
          updated_at: now,
        })
        .eq("id", teamId);
      if (teamUpdateError) throw teamUpdateError;
      return await stateResponse();
    }

    if (action === "assign_player") {
      const playerId = cleanId(body?.playerId);
      const teamId = cleanId(body?.teamId) || null;
      if (!playerId) return NextResponse.json({ error: "Žaidėjas nepasirinktas." }, { status: 400 });
      if (teamId && !(await existingTeam(teamId))) {
        return NextResponse.json({ error: "Komanda neberasta." }, { status: 404 });
      }
      const { data: captainTeams, error: captainTeamsError } = await supabase
        .from("kvadratas_teams")
        .select("id")
        .eq("captain_player_id", playerId);
      if (captainTeamsError) throw captainTeamsError;
      const captainMustBeCleared = (captainTeams ?? []).some((team) => team.id !== teamId);
      if (captainMustBeCleared) {
        const { error: clearCaptainError } = await supabase
          .from("kvadratas_teams")
          .update({ captain_player_id: null, captain_code_hash: null, updated_at: now })
          .eq("captain_player_id", playerId);
        if (clearCaptainError) throw clearCaptainError;
      }
      const { error } = await supabase
        .from("kvadratas_players")
        .update({ assigned_team_id: teamId, updated_at: now })
        .eq("id", playerId);
      if (error) throw error;
      return await stateResponse();
    }

    if (action === "delete_player") {
      const playerId = cleanId(body?.playerId);
      if (!playerId) return NextResponse.json({ error: "Žaidėjas nepasirinktas." }, { status: 400 });
      const { error: clearCaptainError } = await supabase
        .from("kvadratas_teams")
        .update({ captain_player_id: null, captain_code_hash: null, updated_at: now })
        .eq("captain_player_id", playerId);
      if (clearCaptainError) throw clearCaptainError;
      const { error } = await supabase.from("kvadratas_players").delete().eq("id", playerId);
      if (error) throw error;
      return await stateResponse();
    }

    return NextResponse.json({ error: "Nežinomas veiksmas." }, { status: 400 });
  } catch (error) {
    console.error("Failed to update kvadratas state", error);
    return NextResponse.json({ error: "Nepavyko išsaugoti pakeitimo. Pabandyk dar kartą." }, { status: 500 });
  }
}
