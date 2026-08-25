import { createHmac, timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "../../../lib/supabase/server";

const ADMIN_PIN = process.env.ADMIN_PIN;
const MAX_PLAYERS = 200;
const MAX_TEAMS = 12;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SKILL_LEVELS = new Set(["A", "B", "C", "D"]);
const MATCH_STATUSES = new Set(["scheduled", "live", "finished"]);

type KvadratasTeamRow = {
  id: string;
  name: string;
  sort_order: number;
  captain_player_id: string | null;
  captain_code_hash?: string | null;
  max_players: number;
  created_at: string;
  updated_at: string;
};

type KvadratasPlayerRow = {
  id: string;
  first_name: string;
  last_name: string;
  preferred_team_id: string | null;
  assigned_team_id: string | null;
  skill_level: string | null;
  arrived: boolean;
  created_at: string;
  updated_at: string;
};

type KvadratasMatchRow = {
  id: string;
  court: string;
  starts_at: string;
  team_a_id: string;
  team_b_id: string;
  team_a_score: number;
  team_b_score: number;
  status: "scheduled" | "live" | "finished";
  sort_order: number;
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

function cleanSkillLevel(value: unknown) {
  const level = cleanText(value, 1).toUpperCase();
  return SKILL_LEVELS.has(level) ? level : null;
}

function cleanInteger(value: unknown, minimum: number, maximum: number) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) return null;
  return Math.min(maximum, Math.max(minimum, parsed));
}

function cleanMatchStatus(value: unknown) {
  const status = cleanText(value, 20);
  return MATCH_STATUSES.has(status) ? status as KvadratasMatchRow["status"] : null;
}

function normalizeName(value: unknown) {
  return cleanText(value).toLocaleLowerCase("lt");
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
    maxPlayers: row.max_players,
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
    skillLevel: row.skill_level,
    arrived: row.arrived,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function publicMatch(row: KvadratasMatchRow) {
  return {
    id: row.id,
    court: row.court,
    startsAt: row.starts_at,
    teamAId: row.team_a_id,
    teamBId: row.team_b_id,
    teamAScore: row.team_a_score,
    teamBScore: row.team_b_score,
    status: row.status,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function loadPublicState() {
  const supabase = createSupabaseServerClient();
  const [teamsResult, playersResult, matchesResult] = await Promise.all([
    supabase
      .from("kvadratas_teams")
      .select("id, name, sort_order, captain_player_id, max_players, created_at, updated_at")
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true }),
    supabase
      .from("kvadratas_players")
      .select("id, first_name, last_name, preferred_team_id, assigned_team_id, skill_level, arrived, created_at, updated_at")
      .order("created_at", { ascending: true }),
    supabase
      .from("kvadratas_matches")
      .select("id, court, starts_at, team_a_id, team_b_id, team_a_score, team_b_score, status, sort_order, created_at, updated_at")
      .order("starts_at", { ascending: true })
      .order("sort_order", { ascending: true }),
  ]);

  if (teamsResult.error) throw teamsResult.error;
  if (playersResult.error) throw playersResult.error;
  if (matchesResult.error) throw matchesResult.error;

  return {
    teams: ((teamsResult.data ?? []) as KvadratasTeamRow[]).map(publicTeam),
    players: ((playersResult.data ?? []) as KvadratasPlayerRow[]).map(publicPlayer),
    matches: ((matchesResult.data ?? []) as KvadratasMatchRow[]).map(publicMatch),
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
    .select("id, name, sort_order, captain_player_id, captain_code_hash, max_players, created_at, updated_at")
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

async function teamMemberCount(teamId: string) {
  const supabase = createSupabaseServerClient();
  const { count, error } = await supabase
    .from("kvadratas_players")
    .select("id", { count: "exact", head: true })
    .eq("assigned_team_id", teamId);
  if (error) throw error;
  return count ?? 0;
}

async function clearCaptainForPlayer(playerId: string, now: string) {
  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from("kvadratas_teams")
    .update({ captain_player_id: null, captain_code_hash: null, updated_at: now })
    .eq("captain_player_id", playerId);
  if (error) throw error;
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
    const action = cleanText(body?.action, 50);
    const supabase = createSupabaseServerClient();
    const now = new Date().toISOString();

    if (action === "register") {
      const firstName = cleanText(body?.firstName);
      const lastName = cleanText(body?.lastName);
      const preferredTeamId = cleanId(body?.preferredTeamId) || null;
      const skillLevel = cleanSkillLevel(body?.skillLevel);
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
        skill_level: skillLevel,
      });
      if (error?.code === "23505") {
        return NextResponse.json({ error: "Šis vardas ir pavardė jau užregistruoti." }, { status: 409 });
      }
      if (error) throw error;
      return await stateResponse(201);
    }

    if (action === "cancel_registration") {
      const playerId = cleanId(body?.playerId);
      const firstName = normalizeName(body?.firstName);
      const lastName = normalizeName(body?.lastName);
      if (!playerId || !firstName || !lastName) {
        return NextResponse.json({ error: "Pasirink savo registraciją iš paieškos." }, { status: 400 });
      }
      const { data: player, error: playerError } = await supabase
        .from("kvadratas_players")
        .select("id, first_name, last_name")
        .eq("id", playerId)
        .maybeSingle();
      if (playerError) throw playerError;
      if (!player || normalizeName(player.first_name) !== firstName || normalizeName(player.last_name) !== lastName) {
        return NextResponse.json({ error: "Registracija neberasta. Atnaujink paiešką." }, { status: 404 });
      }
      await clearCaptainForPlayer(playerId, now);
      const { error } = await supabase.from("kvadratas_players").delete().eq("id", playerId);
      if (error) throw error;
      return await stateResponse();
    }

    if (action === "captain_verify") {
      const teamId = cleanId(body?.teamId);
      const team = await verifyCaptain(teamId, body?.captainCode);
      if (!team) return NextResponse.json({ error: "Neteisinga komanda arba kapitono kodas." }, { status: 401 });
      return NextResponse.json({ ok: true, teamId: team.id });
    }

    if (action.startsWith("captain_")) {
      const teamId = cleanId(body?.teamId);
      const playerId = cleanId(body?.playerId);
      const team = await verifyCaptain(teamId, body?.captainCode);
      if (!team || !playerId) return NextResponse.json({ error: "Neteisingi kapitono duomenys." }, { status: 401 });

      const { data: player, error: playerError } = await supabase
        .from("kvadratas_players")
        .select("id, preferred_team_id, assigned_team_id, arrived")
        .eq("id", playerId)
        .maybeSingle();
      if (playerError) throw playerError;
      if (!player) return NextResponse.json({ error: "Žaidėjas neberastas." }, { status: 404 });

      if (action === "captain_assign_player") {
        if (player.assigned_team_id && player.assigned_team_id !== teamId) {
          return NextResponse.json({ error: "Žaidėją jau patvirtino kita komanda." }, { status: 409 });
        }
        if (!player.assigned_team_id && await teamMemberCount(teamId) >= team.max_players) {
          return NextResponse.json({ error: "Komanda jau pilna." }, { status: 409 });
        }
        const { error } = await supabase
          .from("kvadratas_players")
          .update({ assigned_team_id: teamId, preferred_team_id: null, updated_at: now })
          .eq("id", playerId);
        if (error) throw error;
        return await stateResponse();
      }

      if (action === "captain_reject_preference") {
        if (player.preferred_team_id !== teamId || player.assigned_team_id) {
          return NextResponse.json({ error: "Šis pageidavimas nebeaktyvus." }, { status: 409 });
        }
        const { error } = await supabase
          .from("kvadratas_players")
          .update({ preferred_team_id: null, updated_at: now })
          .eq("id", playerId);
        if (error) throw error;
        return await stateResponse();
      }

      if (action === "captain_remove_player") {
        if (player.assigned_team_id !== teamId) {
          return NextResponse.json({ error: "Žaidėjas nėra tavo komandoje." }, { status: 409 });
        }
        if (team.captain_player_id === playerId) {
          return NextResponse.json({ error: "Kapitono pašalinti negalima. Tai gali padaryti organizatorius." }, { status: 409 });
        }
        const { error } = await supabase
          .from("kvadratas_players")
          .update({ assigned_team_id: null, arrived: false, updated_at: now })
          .eq("id", playerId);
        if (error) throw error;
        return await stateResponse();
      }

      if (action === "captain_set_arrival") {
        if (player.assigned_team_id !== teamId) {
          return NextResponse.json({ error: "Žaidėjas nėra tavo komandoje." }, { status: 409 });
        }
        const { error } = await supabase
          .from("kvadratas_players")
          .update({ arrived: Boolean(body?.arrived), updated_at: now })
          .eq("id", playerId);
        if (error) throw error;
        return await stateResponse();
      }
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

    if (action === "update_team_capacity") {
      const teamId = cleanId(body?.teamId);
      const maxPlayers = cleanInteger(body?.maxPlayers, 2, 30);
      if (!teamId || maxPlayers === null) return NextResponse.json({ error: "Patikrink komandos vietų skaičių." }, { status: 400 });
      if (await teamMemberCount(teamId) > maxPlayers) {
        return NextResponse.json({ error: "Pirmiausia sumažink šios komandos žaidėjų skaičių." }, { status: 409 });
      }
      const { error } = await supabase.from("kvadratas_teams").update({ max_players: maxPlayers, updated_at: now }).eq("id", teamId);
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
        .select("id, assigned_team_id")
        .eq("id", playerId)
        .maybeSingle();
      if (playerError) throw playerError;
      if (!player) return NextResponse.json({ error: "Žaidėjas neberastas." }, { status: 404 });
      const targetTeam = await existingTeam(teamId);
      if (player.assigned_team_id !== teamId && targetTeam && await teamMemberCount(teamId) >= targetTeam.max_players) {
        return NextResponse.json({ error: "Komanda jau pilna." }, { status: 409 });
      }

      await clearCaptainForPlayer(playerId, now);
      const { error: playerUpdateError } = await supabase
        .from("kvadratas_players")
        .update({ assigned_team_id: teamId, updated_at: now })
        .eq("id", playerId);
      if (playerUpdateError) throw playerUpdateError;
      const { error: teamUpdateError } = await supabase
        .from("kvadratas_teams")
        .update({ captain_player_id: playerId, captain_code_hash: captainCodeHash(code), updated_at: now })
        .eq("id", teamId);
      if (teamUpdateError) throw teamUpdateError;
      return await stateResponse();
    }

    if (action === "assign_player") {
      const playerId = cleanId(body?.playerId);
      const teamId = cleanId(body?.teamId) || null;
      if (!playerId) return NextResponse.json({ error: "Žaidėjas nepasirinktas." }, { status: 400 });
      if (teamId) {
        const team = await existingTeam(teamId);
        if (!team) return NextResponse.json({ error: "Komanda neberasta." }, { status: 404 });
        const { data: currentPlayer, error: currentPlayerError } = await supabase
          .from("kvadratas_players")
          .select("assigned_team_id")
          .eq("id", playerId)
          .maybeSingle();
        if (currentPlayerError) throw currentPlayerError;
        if (currentPlayer?.assigned_team_id !== teamId && await teamMemberCount(teamId) >= team.max_players) {
          return NextResponse.json({ error: "Komanda jau pilna." }, { status: 409 });
        }
      }
      const { data: captainTeams, error: captainTeamsError } = await supabase
        .from("kvadratas_teams")
        .select("id")
        .eq("captain_player_id", playerId);
      if (captainTeamsError) throw captainTeamsError;
      if ((captainTeams ?? []).some((team) => team.id !== teamId)) await clearCaptainForPlayer(playerId, now);
      const update = teamId
        ? { assigned_team_id: teamId, arrived: false, updated_at: now }
        : { assigned_team_id: null, arrived: false, updated_at: now };
      const { error } = await supabase.from("kvadratas_players").update(update).eq("id", playerId);
      if (error) throw error;
      return await stateResponse();
    }

    if (action === "update_player_skill") {
      const playerId = cleanId(body?.playerId);
      const skillLevel = cleanSkillLevel(body?.skillLevel);
      if (!playerId) return NextResponse.json({ error: "Žaidėjas nepasirinktas." }, { status: 400 });
      const { error } = await supabase.from("kvadratas_players").update({ skill_level: skillLevel, updated_at: now }).eq("id", playerId);
      if (error) throw error;
      return await stateResponse();
    }

    if (action === "balance_teams") {
      const [teamsResult, playersResult] = await Promise.all([
        supabase.from("kvadratas_teams").select("id, sort_order, captain_player_id, max_players").order("sort_order"),
        supabase.from("kvadratas_players").select("id, skill_level, created_at"),
      ]);
      if (teamsResult.error) throw teamsResult.error;
      if (playersResult.error) throw playersResult.error;
      const balanceTeams = (teamsResult.data ?? []).map((team) => ({
        ...team,
        total: 0,
        levels: { A: 0, B: 0, C: 0, D: 0, N: 0 } as Record<string, number>,
      }));
      if (!balanceTeams.length) return NextResponse.json({ error: "Pirmiausia sukurk komandas." }, { status: 409 });
      if (balanceTeams.reduce((sum, team) => sum + team.max_players, 0) < (playersResult.data ?? []).length) {
        return NextResponse.json({ error: "Komandose neužtenka vietų visiems žaidėjams." }, { status: 409 });
      }
      const captainIds = new Set(balanceTeams.map((team) => team.captain_player_id).filter(Boolean));
      const players = (playersResult.data ?? []).slice().sort((a, b) => {
        const levels = { A: 0, B: 1, C: 2, D: 3 } as Record<string, number>;
        return (levels[a.skill_level ?? ""] ?? 4) - (levels[b.skill_level ?? ""] ?? 4) || a.created_at.localeCompare(b.created_at);
      });
      const assignments: Array<{ id: string; teamId: string }> = [];
      for (const player of players) {
        const level = player.skill_level ?? "N";
        const captainTeam = balanceTeams.find((team) => team.captain_player_id === player.id);
        const target = captainTeam ?? balanceTeams
          .filter((team) => team.total < team.max_players)
          .sort((a, b) => a.levels[level] - b.levels[level] || a.total - b.total || a.sort_order - b.sort_order)[0];
        if (!target) return NextResponse.json({ error: "Nepavyko sutalpinti visų žaidėjų į komandas." }, { status: 409 });
        target.total += 1;
        target.levels[level] += 1;
        if (!captainIds.has(player.id)) assignments.push({ id: player.id, teamId: target.id });
      }
      for (const assignment of assignments) {
        const { error } = await supabase
          .from("kvadratas_players")
          .update({ assigned_team_id: assignment.teamId, arrived: false, updated_at: now })
          .eq("id", assignment.id);
        if (error) throw error;
      }
      return await stateResponse();
    }

    if (action === "delete_player") {
      const playerId = cleanId(body?.playerId);
      if (!playerId) return NextResponse.json({ error: "Žaidėjas nepasirinktas." }, { status: 400 });
      await clearCaptainForPlayer(playerId, now);
      const { error } = await supabase.from("kvadratas_players").delete().eq("id", playerId);
      if (error) throw error;
      return await stateResponse();
    }

    if (action === "create_match") {
      const teamAId = cleanId(body?.teamAId);
      const teamBId = cleanId(body?.teamBId);
      const court = cleanText(body?.court, 60) || "Aikštelė";
      const startsAt = new Date(String(body?.startsAt ?? ""));
      if (!teamAId || !teamBId || teamAId === teamBId || Number.isNaN(startsAt.getTime())) {
        return NextResponse.json({ error: "Patikrink rungtynių laiką ir komandas." }, { status: 400 });
      }
      if (!(await existingTeam(teamAId)) || !(await existingTeam(teamBId))) {
        return NextResponse.json({ error: "Viena iš komandų neberasta." }, { status: 404 });
      }
      const { count, error: countError } = await supabase.from("kvadratas_matches").select("id", { count: "exact", head: true });
      if (countError) throw countError;
      const { error } = await supabase.from("kvadratas_matches").insert({
        court,
        starts_at: startsAt.toISOString(),
        team_a_id: teamAId,
        team_b_id: teamBId,
        sort_order: (count ?? 0) * 10 + 10,
      });
      if (error) throw error;
      return await stateResponse(201);
    }

    if (action === "update_match") {
      const matchId = cleanId(body?.matchId);
      const status = cleanMatchStatus(body?.status);
      const teamAScore = cleanInteger(body?.teamAScore, 0, 999);
      const teamBScore = cleanInteger(body?.teamBScore, 0, 999);
      if (!matchId || !status || teamAScore === null || teamBScore === null) {
        return NextResponse.json({ error: "Patikrink rungtynių rezultatą." }, { status: 400 });
      }
      const { error } = await supabase.from("kvadratas_matches").update({
        team_a_score: teamAScore,
        team_b_score: teamBScore,
        status,
        updated_at: now,
      }).eq("id", matchId);
      if (error) throw error;
      return await stateResponse();
    }

    if (action === "delete_match") {
      const matchId = cleanId(body?.matchId);
      if (!matchId) return NextResponse.json({ error: "Rungtynės nepasirinktos." }, { status: 400 });
      const { error } = await supabase.from("kvadratas_matches").delete().eq("id", matchId);
      if (error) throw error;
      return await stateResponse();
    }

    return NextResponse.json({ error: "Nežinomas veiksmas." }, { status: 400 });
  } catch (error) {
    console.error("Failed to update kvadratas state", error);
    return NextResponse.json({ error: "Nepavyko išsaugoti pakeitimo. Pabandyk dar kartą." }, { status: 500 });
  }
}
