"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import styles from "./kvadratas.module.css";

type KvadratasTeam = {
  id: string;
  name: string;
  sortOrder: number;
  captainPlayerId: string | null;
  maxPlayers: number;
  createdAt: string;
  updatedAt: string;
};

type KvadratasPlayer = {
  id: string;
  firstName: string;
  lastName: string;
  preferredTeamId: string | null;
  assignedTeamId: string | null;
  skillLevel: "A" | "B" | "C" | "D" | null;
  arrived: boolean;
  createdAt: string;
  updatedAt: string;
};

type KvadratasMatch = {
  id: string;
  court: string;
  startsAt: string;
  teamAId: string;
  teamBId: string;
  teamAScore: number;
  teamBScore: number;
  status: "scheduled" | "live" | "finished";
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

type KvadratasState = {
  teams: KvadratasTeam[];
  players: KvadratasPlayer[];
  matches: KvadratasMatch[];
  serverTime?: string;
};

type Notice = { type: "success" | "warning"; text: string };
type MatchDraft = { teamAScore: number; teamBScore: number; status: KvadratasMatch["status"] };

const PAGE_SIZE = 10;
const EVENT_START = "2026-09-12T18:30";
const SKILL_LEVELS = ["A", "B", "C", "D"] as const;

function playerName(player?: KvadratasPlayer | null) {
  return player ? `${player.firstName} ${player.lastName}`.trim() : "";
}

function normalizeText(value: string) {
  return value.trim().toLocaleLowerCase("lt");
}

function formatMatchTime(value: string) {
  return new Intl.DateTimeFormat("lt-LT", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function matchStatusLabel(status: KvadratasMatch["status"]) {
  if (status === "live") return "Vyksta dabar";
  if (status === "finished") return "Baigta";
  return "Suplanuota";
}

function teamCode(team: KvadratasTeam, index: number) {
  const match = team.name.toUpperCase().match(/([A-ZĄČĘĖĮŠŲŪŽ]\d+)$/);
  return match?.[1] ?? `${String.fromCharCode(65 + index)}${index + 1}`;
}

function CaptainIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 17h16l-1.4-9-4.2 3.5L12 5l-2.4 6.5L5.4 8 4 17Zm1 2h14v2H5v-2Z" />
    </svg>
  );
}

export default function KvadratasPage() {
  const [teams, setTeams] = useState<KvadratasTeam[]>([]);
  const [players, setPlayers] = useState<KvadratasPlayer[]>([]);
  const [matches, setMatches] = useState<KvadratasMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [preferredTeamId, setPreferredTeamId] = useState("");
  const [skillLevel, setSkillLevel] = useState("");
  const [quickTeamId, setQuickTeamId] = useState("");
  const [quickPlayerSearch, setQuickPlayerSearch] = useState("");
  const [quickPlayerId, setQuickPlayerId] = useState("");
  const [cancelSearch, setCancelSearch] = useState("");
  const [directorySearch, setDirectorySearch] = useState("");
  const [directoryPage, setDirectoryPage] = useState(1);
  const [captainTeamId, setCaptainTeamId] = useState("");
  const [captainCode, setCaptainCode] = useState("");
  const [captainUnlockedTeamId, setCaptainUnlockedTeamId] = useState("");
  const [adminPin, setAdminPin] = useState("");
  const [adminUnlocked, setAdminUnlocked] = useState(false);
  const [newTeamName, setNewTeamName] = useState("");
  const [teamNames, setTeamNames] = useState<Record<string, string>>({});
  const [teamCapacities, setTeamCapacities] = useState<Record<string, number>>({});
  const [captainSelections, setCaptainSelections] = useState<Record<string, string>>({});
  const [captainCodes, setCaptainCodes] = useState<Record<string, string>>({});
  const [captainNotices, setCaptainNotices] = useState<Record<string, Notice>>({});
  const [matchTeamA, setMatchTeamA] = useState("");
  const [matchTeamB, setMatchTeamB] = useState("");
  const [matchCourt, setMatchCourt] = useState("Aikštelė 1");
  const [matchStartsAt, setMatchStartsAt] = useState(EVENT_START);
  const [matchDrafts, setMatchDrafts] = useState<Record<string, MatchDraft>>({});

  function applyState(data: KvadratasState) {
    setTeams(Array.isArray(data.teams) ? data.teams : []);
    setPlayers(Array.isArray(data.players) ? data.players : []);
    setMatches(Array.isArray(data.matches) ? data.matches : []);
    setLastSyncedAt(new Date());
  }

  useEffect(() => {
    let stopped = false;

    async function refresh() {
      try {
        const response = await fetch("/api/kvadratas", { cache: "no-store" });
        const data = (await response.json()) as KvadratasState & { error?: string };
        if (!response.ok) throw new Error(data.error || "Nepavyko atnaujinti registracijos.");
        if (!stopped) applyState(data);
      } catch (error) {
        if (!stopped) console.error("Failed to refresh kvadratas", error);
      } finally {
        if (!stopped) setLoading(false);
      }
    }

    void refresh();
    const timer = window.setInterval(() => void refresh(), 3000);
    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    setTeamNames((current) => Object.fromEntries(teams.map((team) => [team.id, current[team.id] ?? team.name])));
    setTeamCapacities((current) => Object.fromEntries(teams.map((team) => [team.id, current[team.id] ?? team.maxPlayers])));
    setCaptainSelections((current) => Object.fromEntries(teams.map((team) => [team.id, current[team.id] ?? team.captainPlayerId ?? ""])));
  }, [teams]);

  useEffect(() => {
    setMatchDrafts((current) => Object.fromEntries(matches.map((match) => [
      match.id,
      current[match.id] ?? {
        teamAScore: match.teamAScore,
        teamBScore: match.teamBScore,
        status: match.status,
      },
    ])));
  }, [matches]);

  async function runAction(body: Record<string, unknown>, successText?: string, inlineNotice?: (notice: Notice) => void) {
    setSaving(true);
    setNotice(null);
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch("/api/kvadratas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      const data = (await response.json()) as KvadratasState & { error?: string; ok?: boolean };
      if (!response.ok) throw new Error(data.error || "Nepavyko išsaugoti pakeitimo.");
      if (Array.isArray(data.teams) && Array.isArray(data.players)) applyState(data);
      if (successText) {
        const nextNotice: Notice = { type: "success", text: successText };
        setNotice(nextNotice);
        inlineNotice?.(nextNotice);
      }
      return true;
    } catch (error) {
      const message = error instanceof DOMException && error.name === "AbortError"
        ? "Serveris neatsakė per 15 sekundžių. Bandyk dar kartą."
        : error instanceof Error ? error.message : "Nepavyko išsaugoti pakeitimo.";
      const nextNotice: Notice = { type: "warning", text: message };
      setNotice(nextNotice);
      inlineNotice?.(nextNotice);
      return false;
    } finally {
      window.clearTimeout(timeout);
      setSaving(false);
    }
  }

  async function assignCaptain(team: KvadratasTeam) {
    const playerId = captainSelections[team.id] || "";
    const enteredCode = (captainCodes[team.id] ?? "").trim();
    const generatedCode = String(100000 + crypto.getRandomValues(new Uint32Array(1))[0] % 900000);
    const code = playerId ? enteredCode || generatedCode : "";
    const setInlineNotice = (nextNotice: Notice) => {
      setCaptainNotices((current) => ({ ...current, [team.id]: nextNotice }));
    };

    if (playerId && !enteredCode) {
      setCaptainCodes((current) => ({ ...current, [team.id]: code }));
    }
    setCaptainNotices((current) => {
      const next = { ...current };
      delete next[team.id];
      return next;
    });

    const successText = playerId
      ? `Kapitonas paskirtas. Jo prisijungimo kodas: ${code}`
      : "Kapitonas pašalintas.";
    const success = await runAction({
      action: "assign_captain",
      adminPin,
      teamId: team.id,
      playerId: playerId || null,
      captainCode: code,
    }, successText, setInlineNotice);

    if (success && !playerId) {
      setCaptainCodes((current) => ({ ...current, [team.id]: "" }));
    }
  }

  async function submitRegistration(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const success = await runAction({
      action: "register",
      firstName,
      lastName,
      preferredTeamId: preferredTeamId || null,
      skillLevel: skillLevel || null,
    }, "Registracija išsaugota. Tavo vardas jau matomas bendrame sąraše.");
    if (success) {
      setFirstName("");
      setLastName("");
      setPreferredTeamId("");
      setSkillLevel("");
    }
  }

  async function submitTeamWish(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const team = teams.find((item) => item.id === quickTeamId);
    const player = players.find((item) => item.id === quickPlayerId);
    if (!team || !player) return;
    const success = await runAction({
      action: "set_team_preference",
      playerId: player.id,
      teamId: team.id,
    }, `Pageidavimas prisijungti prie „${team.name}“ išsaugotas. Kapitonas jį matys savo valdyme.`);
    if (success) {
      closeTeamWish();
    }
  }

  function openTeamWish(teamId: string) {
    setQuickTeamId(teamId);
    setQuickPlayerSearch("");
    setQuickPlayerId("");
  }

  function closeTeamWish() {
    setQuickTeamId("");
    setQuickPlayerSearch("");
    setQuickPlayerId("");
  }

  async function unlockCaptain(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setNotice(null);
    try {
      const response = await fetch("/api/kvadratas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "captain_verify", teamId: captainTeamId, captainCode }),
      });
      const data = (await response.json()) as { ok?: boolean; teamId?: string; error?: string };
      if (!response.ok || !data.ok || !data.teamId) throw new Error(data.error || "Nepavyko atrakinti komandos.");
      setCaptainUnlockedTeamId(data.teamId);
      setNotice({ type: "success", text: "Kapitono valdymas atrakintas." });
    } catch (error) {
      setCaptainUnlockedTeamId("");
      setNotice({ type: "warning", text: error instanceof Error ? error.message : "Neteisingas kapitono kodas." });
    } finally {
      setSaving(false);
    }
  }

  async function unlockAdmin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setNotice(null);
    try {
      const response = await fetch("/api/admin-auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: adminPin, scope: "admin" }),
      });
      if (!response.ok) throw new Error("Neteisingas administratoriaus PIN.");
      setAdminUnlocked(true);
      setNotice({ type: "success", text: "Administratoriaus valdymas atrakintas." });
    } catch (error) {
      setAdminUnlocked(false);
      setNotice({ type: "warning", text: error instanceof Error ? error.message : "Nepavyko atrakinti valdymo." });
    } finally {
      setSaving(false);
    }
  }

  const playersById = useMemo(() => new Map(players.map((player) => [player.id, player])), [players]);
  const teamsById = useMemo(() => new Map(teams.map((team) => [team.id, team])), [teams]);
  const assignedCount = players.filter((player) => player.assignedTeamId).length;
  const arrivedCount = players.filter((player) => player.arrived).length;
  const unassignedPlayers = players.filter((player) => !player.assignedTeamId);
  const neutralWaitingPlayers = unassignedPlayers.filter((player) => !player.preferredTeamId);
  const captainTeams = teams.filter((team) => team.captainPlayerId);
  const quickTeam = teamsById.get(quickTeamId) ?? null;
  const quickSelectedPlayer = playersById.get(quickPlayerId) ?? null;
  const normalizedQuickPlayerSearch = normalizeText(quickPlayerSearch);
  const quickPlayerCandidates = normalizedQuickPlayerSearch.length >= 2
    ? players
      .filter((player) => normalizeText(playerName(player)).includes(normalizedQuickPlayerSearch))
      .slice(0, 8)
    : [];
  const unlockedCaptainTeam = teamsById.get(captainUnlockedTeamId) ?? null;
  const unlockedCaptainMembers = players.filter((player) => player.assignedTeamId === captainUnlockedTeamId);
  const captainCandidates = unassignedPlayers.slice().sort((a, b) => {
    const aPreferred = a.preferredTeamId === captainUnlockedTeamId ? 0 : 1;
    const bPreferred = b.preferredTeamId === captainUnlockedTeamId ? 0 : 1;
    return aPreferred - bPreferred || playerName(a).localeCompare(playerName(b), "lt");
  });
  const cancellationCandidates = normalizeText(cancelSearch).length >= 2
    ? players.filter((player) => normalizeText(playerName(player)).includes(normalizeText(cancelSearch))).slice(0, 8)
    : [];
  const filteredPlayers = players.filter((player) => {
    const team = player.assignedTeamId ? teamsById.get(player.assignedTeamId) : null;
    const preference = player.preferredTeamId ? teamsById.get(player.preferredTeamId) : null;
    return normalizeText(`${playerName(player)} ${team?.name ?? ""} ${preference?.name ?? ""} ${player.skillLevel ?? ""}`).includes(normalizeText(directorySearch));
  });
  const pageCount = Math.max(1, Math.ceil(filteredPlayers.length / PAGE_SIZE));
  const safePage = Math.min(directoryPage, pageCount);
  const visiblePlayers = filteredPlayers.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const liveMatch = matches.find((match) => match.status === "live") ?? null;
  const scheduledMatches = matches.filter((match) => match.status === "scheduled");
  const featuredMatch = liveMatch ?? scheduledMatches[0] ?? null;
  const nextMatch = liveMatch ? scheduledMatches[0] ?? null : scheduledMatches[1] ?? null;

  const standings = useMemo(() => {
    const table = new Map(teams.map((team) => [team.id, {
      team,
      played: 0,
      wins: 0,
      losses: 0,
      draws: 0,
      scored: 0,
      conceded: 0,
      points: 0,
    }]));
    for (const match of matches.filter((item) => item.status === "finished")) {
      const teamA = table.get(match.teamAId);
      const teamB = table.get(match.teamBId);
      if (!teamA || !teamB) continue;
      teamA.played += 1;
      teamB.played += 1;
      teamA.scored += match.teamAScore;
      teamA.conceded += match.teamBScore;
      teamB.scored += match.teamBScore;
      teamB.conceded += match.teamAScore;
      if (match.teamAScore > match.teamBScore) {
        teamA.wins += 1;
        teamA.points += 3;
        teamB.losses += 1;
      } else if (match.teamBScore > match.teamAScore) {
        teamB.wins += 1;
        teamB.points += 3;
        teamA.losses += 1;
      } else {
        teamA.draws += 1;
        teamB.draws += 1;
        teamA.points += 1;
        teamB.points += 1;
      }
    }
    return [...table.values()].sort((a, b) =>
      b.points - a.points
      || (b.scored - b.conceded) - (a.scored - a.conceded)
      || b.scored - a.scored
      || a.team.sortOrder - b.team.sortOrder);
  }, [matches, teams]);

  async function cancelPlayer(player: KvadratasPlayer) {
    if (!window.confirm(`Ar tikrai nori atšaukti ${playerName(player)} dalyvavimą ir nebežaisti?`)) return;
    const success = await runAction({
      action: "cancel_registration",
      playerId: player.id,
      firstName: player.firstName,
      lastName: player.lastName,
    }, "Registracija atšaukta. Vieta žaidėjų sąraše atlaisvinta.");
    if (success) setCancelSearch("");
  }

  return (
    <main className={styles.page}>
      <div className={styles.orangeGlow} />
      <div className={styles.blueGlow} />

      <div className={styles.topbar}>
        <Link className={styles.backLink} href="/">Grįžti į renginių pasirinkimą</Link>
        <span className={styles.liveStatus}>
          <i aria-hidden="true" /> Duomenys atnaujinami automatiškai
          {lastSyncedAt ? ` · ${lastSyncedAt.toLocaleTimeString("lt-LT", { hour: "2-digit", minute: "2-digit" })}` : ""}
        </span>
      </div>

      <header className={styles.hero}>
        <div className={styles.heroCopy}>
          <span className={styles.kicker}>Klaipėdos kvadratas</span>
          <h1>Susitinkame aikštelėje</h1>
          <p>Užsiregistruok žaidimui, pasirink norimą komandą kaip rekomendaciją ir stebėk gyvą turnyro eigą.</p>
          <div className={styles.heroRules}>
            <span>Registracija vieša</span>
            <span>Pageidavimas neprivalomas</span>
            <span>Galutinai tvirtina kapitonas</span>
          </div>
        </div>
        <div className={styles.court} aria-hidden="true">
          <div className={styles.courtLine} />
          <div className={styles.centerCircle} />
          <div className={styles.courtKeyLeft} />
          <div className={styles.courtKeyRight} />
          <div className={styles.ball}><i /><b /><span /></div>
        </div>
      </header>

      <section className={styles.eventInfo} aria-label="Renginio informacija">
        <div className={styles.eventDate}>
          <span>Kada</span>
          <strong>Rugsėjo 12 d.</strong>
          <small>šeštadienis · nuo 18:30</small>
        </div>
        <div>
          <span>Trukmė</span>
          <strong>2 valandos</strong>
          <small>18:30–20:30</small>
        </div>
        <div>
          <span>Vieta</span>
          <strong>Taikos pr. 64, „Akropolis“</strong>
          <small>buvusi „Neptūnas“ aikštė</small>
        </div>
      </section>

      <section className={styles.scoreboard} aria-label="Kvadrato registracijos suvestinė">
        <div><span>Užsiregistravo</span><strong>{players.length}</strong><small>žaidėjų</small></div>
        <div><span>Komandose</span><strong>{assignedCount}</strong><small>patvirtinta</small></div>
        <div><span>Laukia</span><strong>{players.length - assignedCount}</strong><small>paskyrimo</small></div>
        <div><span>Atvyko</span><strong>{arrivedCount}</strong><small>pažymėta</small></div>
      </section>

      {notice ? <div className={`${styles.notice} ${styles[notice.type]}`} role="status">{notice.text}</div> : null}

      <section className={styles.registrationGrid} id="registracija">
        <div className={styles.registrationIntro}>
          <span className={styles.sectionNumber}>01</span>
          <p className={styles.sectionEyebrow}>Žaidėjo registracija</p>
          <h2>Įrašyk save į rungtynių sąrašą</h2>
          <p>Komandos ir pajėgumo pasirinkimai nėra privalomi. Jie padės organizatoriui sudaryti lygesnes komandas.</p>
        </div>

        <form className={styles.registrationForm} onSubmit={submitRegistration}>
          <label>
            <span>Vardas</span>
            <input value={firstName} onChange={(event) => setFirstName(event.target.value)} autoComplete="given-name" placeholder="Tavo vardas" maxLength={80} required />
          </label>
          <label>
            <span>Pavardė</span>
            <input value={lastName} onChange={(event) => setLastName(event.target.value)} autoComplete="family-name" placeholder="Tavo pavardė" maxLength={80} required />
          </label>
          <fieldset>
            <legend>Jėgų lygis <small>nebūtina</small></legend>
            <div className={styles.preferenceGrid}>
              <button className={!skillLevel ? styles.selectedPreference : ""} type="button" onClick={() => setSkillLevel("")}>Nepasirinkti</button>
              {SKILL_LEVELS.map((level) => (
                <button className={skillLevel === level ? styles.selectedPreference : ""} type="button" key={level} onClick={() => setSkillLevel(level)}>
                  {level} lygis
                </button>
              ))}
            </div>
            <p className={styles.fieldHint}>A – stipriausias, D – pradedantysis. Pasirinkimas matomas organizatoriui ir bendrame sąraše.</p>
          </fieldset>
          <fieldset>
            <legend>Kurioje komandoje norėtum žaisti? <small>nebūtina</small></legend>
            <p className={styles.fieldHint}>Prie kiekvienos komandos matysi jos kapitoną, kai organizatorius jį paskirs.</p>
            <div className={styles.teamPreferenceGrid}>
              <button className={!preferredTeamId ? styles.selectedTeamPreference : ""} type="button" onClick={() => setPreferredTeamId("")}>
                <b>?</b>
                <span><strong>Nesvarbu</strong><small>Lauksiu kapitono pasirinkimo</small></span>
              </button>
              {teams.map((team, index) => {
                const captain = team.captainPlayerId ? playersById.get(team.captainPlayerId) : null;
                return (
                  <button className={preferredTeamId === team.id ? styles.selectedTeamPreference : ""} type="button" key={team.id} onClick={() => setPreferredTeamId(team.id)}>
                    <b>{teamCode(team, index)}</b>
                    <span>
                      <strong>{team.name}</strong>
                      <small className={captain ? styles.hasCaptain : ""}><CaptainIcon /> {captain ? playerName(captain) : "Kapitonas dar nepaskirtas"}</small>
                    </span>
                  </button>
                );
              })}
            </div>
          </fieldset>
          <button className={styles.primaryButton} type="submit" disabled={saving || loading}>
            {saving ? "Saugoma..." : "Registruotis į kvadratą"}
          </button>
        </form>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeading}>
          <div><span className={styles.sectionNumber}>02</span><p className={styles.sectionEyebrow}>Komandų lenta</p></div>
          <div><h2>Sudėtys matomos visiems</h2><p>Aiškiai matyti, kiek vietų komandoje liko, kas atvyko ir kurių pageidavimų kapitonas dar nepatvirtino.</p></div>
        </div>
        <div className={styles.teamGrid}>
          {teams.map((team, index) => {
            const members = players.filter((player) => player.assignedTeamId === team.id);
            const captain = team.captainPlayerId ? playersById.get(team.captainPlayerId) : null;
            const wishes = players.filter((player) => player.preferredTeamId === team.id && !player.assignedTeamId);
            const missing = Math.max(0, team.maxPlayers - members.length);
            return (
              <article className={styles.teamCard} key={team.id} style={{ "--team-index": index } as React.CSSProperties}>
                <header>
                  <div className={styles.teamIdentity}>
                    <b className={styles.teamLogo}>{teamCode(team, index)}</b>
                    <span>Komanda {String(index + 1).padStart(2, "0")}</span>
                    <strong>{team.name}</strong>
                  </div>
                  <small>{members.length}/{team.maxPlayers}</small>
                </header>
                <div className={styles.teamCapacity}>
                  <span style={{ width: `${Math.min(100, members.length / team.maxPlayers * 100)}%` }} />
                  <strong>{missing ? `Trūksta ${missing} žaid.` : "Komanda pilna"}</strong>
                </div>
                <div className={styles.captainRow}>
                  <i><CaptainIcon /></i>
                  <span>KAPITONAS</span>
                  <strong>{captain ? playerName(captain) : "Dar nepaskirtas"}</strong>
                </div>
                <ol className={styles.memberList}>
                  {members.length ? members.map((player) => (
                    <li key={player.id} className={player.id === team.captainPlayerId ? styles.captainMember : ""}>
                      <span>{playerName(player)}</span>
                      <span className={styles.memberMeta}>
                        {player.skillLevel ? <small className={styles.skillBadge}>{player.skillLevel}</small> : null}
                        {player.arrived ? <small className={styles.arrivedBadge} title="Atvyko">✓</small> : null}
                        {player.id === team.captainPlayerId ? <small>C</small> : null}
                      </span>
                    </li>
                  )) : <li className={styles.emptyRow}>Komanda dar renkama</li>}
                </ol>
                <div className={styles.wishList}>
                  <div>
                    <span>NORI Į ŠIĄ KOMANDĄ</span>
                    <button type="button" title={`Surask savo registraciją ir išreikšk norą prisijungti prie „${team.name}“`} aria-label={`Noriu prisijungti prie ${team.name}`} onClick={() => openTeamWish(team.id)}>+</button>
                  </div>
                  <small className={styles.plusTip}>Spausk +, jei norėtum žaisti šioje komandoje</small>
                  {wishes.length ? <p>{wishes.map(playerName).join(" · ")}</p> : <p>Pageidavimų dar nėra</p>}
                </div>
              </article>
            );
          })}
        </div>
        <div className={styles.waitingPool}>
          <div className={styles.waitingPoolHeader}>
            <div>
              <span>Laisvi žaidėjai</span>
              <h3>Laukia kapitono kvietimo</h3>
              <p>Čia patenka pasirinkę „Nesvarbu“. Prisijungęs kapitonas gali vienu paspaudimu pakviesti žaidėją į savo komandą.</p>
            </div>
            <strong>{neutralWaitingPlayers.length}</strong>
          </div>
          <div className={styles.waitingPlayerGrid}>
            {neutralWaitingPlayers.map((player) => (
              <article key={player.id}>
                <span className={styles.waitingAvatar}>{player.firstName.slice(0, 1)}{player.lastName.slice(0, 1)}</span>
                <div><strong>{playerName(player)}</strong><small>{player.skillLevel ? `${player.skillLevel} lygis` : "Lygis nepasirinktas"}</small></div>
                <button
                  type="button"
                  disabled={saving || Boolean(captainUnlockedTeamId && unlockedCaptainMembers.length >= (unlockedCaptainTeam?.maxPlayers ?? 0))}
                  title={captainUnlockedTeamId ? `Pakviesti į „${unlockedCaptainTeam?.name}“` : "Pirmiausia prisijunk kapitono valdyme žemiau"}
                  onClick={() => {
                    if (!captainUnlockedTeamId) {
                      document.getElementById("kapitonams")?.scrollIntoView({ behavior: "smooth", block: "start" });
                      return;
                    }
                    void runAction({ action: "captain_assign_player", teamId: captainUnlockedTeamId, captainCode, playerId: player.id }, `${playerName(player)} perkeltas į „${unlockedCaptainTeam?.name}“.`);
                  }}
                >
                  <b>+</b><span>{captainUnlockedTeamId ? unlockedCaptainTeam?.name : "Kapitonui"}</span>
                </button>
              </article>
            ))}
            {!neutralWaitingPlayers.length ? <p className={styles.emptyWaiting}>Pasirinkusių „Nesvarbu“ kol kas nėra.</p> : null}
          </div>
        </div>
      </section>

      <section className={`${styles.section} ${styles.tournamentSection}`}>
        <div className={styles.sectionHeading}>
          <div><span className={styles.sectionNumber}>03</span><p className={styles.sectionEyebrow}>Turnyras gyvai</p></div>
          <div><h2>Dabar žaidžia ir kas ruošiasi</h2><p>Tvarkaraštis ir rezultatai atsinaujina automatiškai kas kelias sekundes.</p></div>
        </div>
        <div className={styles.gameStage}>
          <article className={`${styles.featuredGame} ${featuredMatch?.status === "live" ? styles.liveGame : ""}`}>
            <span>{featuredMatch ? (featuredMatch.status === "live" ? "Vyksta dabar" : "Kitas žaidimas") : "Tvarkaraštis ruošiamas"}</span>
            {featuredMatch ? (
              <>
                <small>{formatMatchTime(featuredMatch.startsAt)} · {featuredMatch.court}</small>
                <div>
                  <strong>{teamsById.get(featuredMatch.teamAId)?.name ?? "Komanda A1"}</strong>
                  <b>{featuredMatch.status === "scheduled" ? "VS" : `${featuredMatch.teamAScore} : ${featuredMatch.teamBScore}`}</b>
                  <strong>{teamsById.get(featuredMatch.teamBId)?.name ?? "Komanda B2"}</strong>
                </div>
              </>
            ) : <p>Organizatorius čia paskelbs rungtynių laikus ir komandas.</p>}
          </article>
          <article className={styles.nextGame}>
            <span>Ruošiasi</span>
            {nextMatch ? (
              <>
                <strong>{teamsById.get(nextMatch.teamAId)?.name} <i>prieš</i> {teamsById.get(nextMatch.teamBId)?.name}</strong>
                <small>{formatMatchTime(nextMatch.startsAt)} · {nextMatch.court}</small>
              </>
            ) : <p>Kitas žaidimas dar nepaskelbtas.</p>}
          </article>
        </div>

        <div className={styles.tournamentGrid}>
          <div>
            <h3>Rungtynių tvarkaraštis</h3>
            <div className={styles.scheduleList}>
              {matches.map((match) => (
                <article key={match.id}>
                  <time>{formatMatchTime(match.startsAt)}</time>
                  <div><strong>{teamsById.get(match.teamAId)?.name} – {teamsById.get(match.teamBId)?.name}</strong><small>{match.court}</small></div>
                  <b className={styles[match.status]}>{match.status === "scheduled" ? "VS" : `${match.teamAScore}:${match.teamBScore}`}</b>
                  <span>{matchStatusLabel(match.status)}</span>
                </article>
              ))}
              {!matches.length ? <p className={styles.emptyControl}>Tvarkaraštis dar nepaskelbtas.</p> : null}
            </div>
          </div>
          <div>
            <h3>Turnyrinė lentelė</h3>
            <div className={styles.tableWrap}>
              <table className={styles.standingsTable}>
                <thead><tr><th>Vieta</th><th>Komanda</th><th>Ž.</th><th>P.</th><th>Pr.</th><th>Taškai</th></tr></thead>
                <tbody>
                  {standings.map((row, index) => (
                    <tr key={row.team.id}>
                      <td><strong>{index + 1}</strong></td>
                      <td>{row.team.name}<small>{row.scored}:{row.conceded}</small></td>
                      <td>{row.played}</td>
                      <td>{row.wins}</td>
                      <td>{row.losses}</td>
                      <td><b>{row.points}</b></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeading}>
          <div><span className={styles.sectionNumber}>04</span><p className={styles.sectionEyebrow}>Viešas sąrašas</p></div>
          <div><h2>Visi užsiregistravę žaidėjai</h2><p>Greitai rask vardą ir pamatyk pajėgumo lygį, pageidavimą bei patvirtintą komandą.</p></div>
        </div>
        <div className={styles.directoryToolbar}>
          <input type="search" value={directorySearch} onChange={(event) => { setDirectorySearch(event.target.value); setDirectoryPage(1); }} placeholder="Ieškoti pagal vardą, pavardę, lygį ar komandą" />
          <strong>{filteredPlayers.length} įraš.</strong>
        </div>
        <div className={styles.tableWrap}>
          <table className={styles.playerTable}>
            <thead><tr><th>Nr.</th><th>Žaidėjas</th><th>Lygis</th><th>Pageidavimas</th><th>Patvirtinta komanda</th></tr></thead>
            <tbody>
              {visiblePlayers.map((player, index) => (
                <tr key={player.id}>
                  <td>{(safePage - 1) * PAGE_SIZE + index + 1}</td>
                  <td><strong>{playerName(player)}</strong>{player.arrived ? <small className={styles.arrivalText}>Atvyko</small> : null}</td>
                  <td>{player.skillLevel ? <span className={styles.levelPill}>{player.skillLevel}</span> : "–"}</td>
                  <td>{player.preferredTeamId ? teamsById.get(player.preferredTeamId)?.name ?? "–" : "Nesvarbu"}</td>
                  <td>{player.assignedTeamId ? <span className={styles.confirmedBadge}>{teamsById.get(player.assignedTeamId)?.name ?? "Komanda"}</span> : <span className={styles.waitingBadge}>Laukia kapitono</span>}</td>
                </tr>
              ))}
              {!visiblePlayers.length ? <tr><td colSpan={5} className={styles.emptyTable}>{loading ? "Kraunamas sąrašas..." : "Žaidėjų dar nėra."}</td></tr> : null}
            </tbody>
          </table>
        </div>
        {pageCount > 1 ? (
          <div className={styles.pagination}>
            <button type="button" onClick={() => setDirectoryPage((page) => Math.max(1, page - 1))} disabled={safePage === 1}>Ankstesnis</button>
            <span>{safePage} / {pageCount}</span>
            <button type="button" onClick={() => setDirectoryPage((page) => Math.min(pageCount, page + 1))} disabled={safePage === pageCount}>Kitas</button>
          </div>
        ) : null}
      </section>

      <section className={styles.cancelSection}>
        <div>
          <span className={styles.sectionEyebrow}>Pasikeitė planai?</span>
          <h2>Atšauk savo registraciją</h2>
          <p>Įrašyk vardą arba pavardę, surask save ir paspausk savo įrašą. Prieš ištrinant dar kartą paklausime, ar tikrai nebežaisi.</p>
        </div>
        <div className={styles.cancelSearch}>
          <input type="search" value={cancelSearch} onChange={(event) => setCancelSearch(event.target.value)} placeholder="Pradėk rašyti vardą arba pavardę" />
          {normalizeText(cancelSearch).length > 0 && normalizeText(cancelSearch).length < 2 ? <small>Įrašyk bent 2 raides.</small> : null}
          {cancellationCandidates.length ? (
            <div className={styles.cancelResults}>
              {cancellationCandidates.map((player) => (
                <button type="button" key={player.id} disabled={saving} onClick={() => void cancelPlayer(player)}>
                  <span><strong>{playerName(player)}</strong><small>{player.assignedTeamId ? teamsById.get(player.assignedTeamId)?.name : "Dar nepriskirtas"}</small></span>
                  <b>Atšaukti</b>
                </button>
              ))}
            </div>
          ) : normalizeText(cancelSearch).length >= 2 ? <p className={styles.emptyControl}>Atitinkančios registracijos nerasta.</p> : null}
        </div>
      </section>

      <section id="kapitonams" className={`${styles.section} ${styles.controlSection}`}>
        <div className={styles.sectionHeading}>
          <div><span className={styles.sectionNumber}>05</span><p className={styles.sectionEyebrow}>Kapitonams</p></div>
          <div><h2>Formuok ir sužymėk savo komandą</h2><p>Patvirtink arba atmesk pageidavimus, grąžink žaidėją į bendrą sąrašą ir renginio dieną pažymėk atvykusius.</p></div>
        </div>
        {!captainUnlockedTeamId ? (
          <form className={styles.unlockForm} onSubmit={unlockCaptain}>
            <label><span>Komanda</span><select value={captainTeamId} onChange={(event) => setCaptainTeamId(event.target.value)} required><option value="">Pasirink komandą</option>{captainTeams.map((team) => <option value={team.id} key={team.id}>{team.name}</option>)}</select></label>
            <label><span>Kapitono kodas</span><input type="password" value={captainCode} onChange={(event) => setCaptainCode(event.target.value)} placeholder="Įvesk suteiktą kodą" minLength={4} required /></label>
            <button className={styles.secondaryButton} type="submit" disabled={saving}>Atrakinti komandos valdymą</button>
          </form>
        ) : (
          <div className={styles.captainDashboard}>
            <div className={styles.controlHeader}>
              <div><span>Atrakinta komanda</span><strong>{unlockedCaptainTeam?.name}</strong></div>
              <div className={styles.captainStat}><span>Dar trūksta</span><strong>{Math.max(0, (unlockedCaptainTeam?.maxPlayers ?? 0) - unlockedCaptainMembers.length)}</strong></div>
              <button type="button" onClick={() => { setCaptainUnlockedTeamId(""); setCaptainCode(""); }}>Atsijungti</button>
            </div>

            <div className={styles.captainColumns}>
              <div>
                <h3>Komandos pageidavimai ir laisvi žaidėjai</h3>
                <div className={styles.candidateGrid}>
                  {captainCandidates.map((player) => (
                    <article key={player.id} className={player.preferredTeamId === captainUnlockedTeamId ? styles.preferredCandidate : ""}>
                      <div><strong>{playerName(player)}</strong><small>{player.preferredTeamId === captainUnlockedTeamId ? "Nori į tavo komandą" : player.preferredTeamId ? `Pageidauja: ${teamsById.get(player.preferredTeamId)?.name ?? "kita komanda"}` : "Komanda nesvarbi"}{player.skillLevel ? ` · ${player.skillLevel} lygis` : ""}</small></div>
                      <span className={styles.inlineActions}>
                        <button type="button" disabled={saving || unlockedCaptainMembers.length >= (unlockedCaptainTeam?.maxPlayers ?? 0)} onClick={() => void runAction({ action: "captain_assign_player", teamId: captainUnlockedTeamId, captainCode, playerId: player.id }, `${playerName(player)} patvirtintas komandoje.`)}>Priimti</button>
                        {player.preferredTeamId === captainUnlockedTeamId ? <button className={styles.rejectButton} type="button" disabled={saving} onClick={() => void runAction({ action: "captain_reject_preference", teamId: captainUnlockedTeamId, captainCode, playerId: player.id }, "Pageidavimas atmestas.")}>Atmesti</button> : null}
                      </span>
                    </article>
                  ))}
                  {!captainCandidates.length ? <p className={styles.emptyControl}>Visi žaidėjai jau paskirstyti.</p> : null}
                </div>
              </div>

              <div>
                <h3>Mano komanda ir atvykimas</h3>
                <div className={styles.rosterControl}>
                  {unlockedCaptainMembers.map((player) => (
                    <article key={player.id}>
                      <button className={player.arrived ? styles.arrivedToggle : ""} type="button" disabled={saving} onClick={() => void runAction({ action: "captain_set_arrival", teamId: captainUnlockedTeamId, captainCode, playerId: player.id, arrived: !player.arrived }, player.arrived ? "Atvykimo žyma nuimta." : `${playerName(player)} pažymėtas kaip atvykęs.`)}>
                        <i>{player.arrived ? "✓" : ""}</i>
                        <span><strong>{playerName(player)}</strong><small>{player.arrived ? "Atvyko" : "Dar nepažymėtas"}{player.skillLevel ? ` · ${player.skillLevel} lygis` : ""}</small></span>
                      </button>
                      {player.id !== unlockedCaptainTeam?.captainPlayerId ? <button className={styles.removeButton} type="button" disabled={saving} onClick={() => { if (window.confirm(`Grąžinti ${playerName(player)} į nepriskirtų žaidėjų sąrašą?`)) void runAction({ action: "captain_remove_player", teamId: captainUnlockedTeamId, captainCode, playerId: player.id }, "Žaidėjas grąžintas į nepriskirtų sąrašą."); }}>Pašalinti</button> : <b>Kapitonas</b>}
                    </article>
                  ))}
                  {!unlockedCaptainMembers.length ? <p className={styles.emptyControl}>Komandoje žaidėjų dar nėra.</p> : null}
                </div>
              </div>
            </div>
          </div>
        )}
      </section>

      <section className={`${styles.section} ${styles.adminSection}`}>
        <div className={styles.sectionHeading}>
          <div><span className={styles.sectionNumber}>06</span><p className={styles.sectionEyebrow}>Organizatoriui</p></div>
          <div><h2>Komandos ir turnyras vienoje vietoje</h2><p>Administruok sudėtis, subalansuok pajėgumus, kurk rungtynes ir telefone gyvai keisk rezultatą.</p></div>
        </div>
        {!adminUnlocked ? (
          <form className={styles.unlockForm} onSubmit={unlockAdmin}>
            <label><span>Administratoriaus PIN</span><input type="password" value={adminPin} onChange={(event) => setAdminPin(event.target.value)} placeholder="Įvesk PIN" required /></label>
            <button className={styles.secondaryButton} type="submit" disabled={saving}>Atrakinti administravimą</button>
          </form>
        ) : (
          <div className={styles.adminDashboard}>
            <div className={styles.balancePanel}>
              <div><span>Automatinis komandų balansavimas</span><strong>Paskirsto žaidėjus pagal A–D lygį ir komandų talpą</strong><small>Kapitonai lieka savo komandose. Kitų žaidėjų komandos bus perskirstytos.</small></div>
              <button type="button" disabled={saving || !players.length} onClick={() => { if (window.confirm("Ar tikrai automatiškai perskirstyti žaidėjus į kuo lygesnes komandas?")) void runAction({ action: "balance_teams", adminPin }, "Komandos automatiškai subalansuotos."); }}>Subalansuoti komandas</button>
            </div>

            <form className={styles.newTeamForm} onSubmit={(event) => { event.preventDefault(); void runAction({ action: "create_team", adminPin, name: newTeamName }, "Komanda sukurta.").then((success) => { if (success) setNewTeamName(""); }); }}>
              <label><span>Nauja komanda</span><input value={newTeamName} onChange={(event) => setNewTeamName(event.target.value)} placeholder="Pvz. Žaibai" maxLength={60} required /></label>
              <button className={styles.primaryButton} type="submit" disabled={saving}>Sukurti komandą</button>
            </form>

            <div className={styles.adminTeamGrid}>
              {teams.map((team) => (
                <article key={team.id}>
                  <label><span>Komandos pavadinimas</span><input value={teamNames[team.id] ?? team.name} onChange={(event) => setTeamNames((current) => ({ ...current, [team.id]: event.target.value }))} /></label>
                  <button type="button" disabled={saving} onClick={() => void runAction({ action: "rename_team", adminPin, teamId: team.id, name: teamNames[team.id] }, "Komandos pavadinimas išsaugotas.")}>{saving ? "Saugoma..." : "Išsaugoti pavadinimą"}</button>
                  <label><span>Žaidėjų vietų</span><input type="number" min={2} max={30} value={teamCapacities[team.id] ?? team.maxPlayers} onChange={(event) => setTeamCapacities((current) => ({ ...current, [team.id]: Number(event.target.value) }))} /></label>
                  <button type="button" disabled={saving} onClick={() => void runAction({ action: "update_team_capacity", adminPin, teamId: team.id, maxPlayers: teamCapacities[team.id] }, "Komandos vietų skaičius išsaugotas.")}>{saving ? "Saugoma..." : "Išsaugoti vietų skaičių"}</button>
                  <label><span>Kapitonas</span><select value={captainSelections[team.id] ?? ""} onChange={(event) => setCaptainSelections((current) => ({ ...current, [team.id]: event.target.value }))}><option value="">Nepaskirtas</option>{players.map((player) => <option value={player.id} key={player.id}>{playerName(player)}</option>)}</select></label>
                  <label><span>Kapitono prisijungimo kodas</span><input type="text" value={captainCodes[team.id] ?? ""} onChange={(event) => setCaptainCodes((current) => ({ ...current, [team.id]: event.target.value }))} placeholder="Nebūtina – sistema sugeneruos" /></label>
                  {captainSelections[team.id] ? <small className={styles.adminHint}>Kodo įrašyti nebūtina. Palikus lauką tuščią, sistema pati sugeneruos 6 skaitmenų kodą.</small> : null}
                  <button type="button" disabled={saving} onClick={() => void assignCaptain(team)}>{saving ? "Saugoma..." : captainSelections[team.id] ? "Paskirti kapitoną" : "Pašalinti kapitoną"}</button>
                  {captainNotices[team.id] ? <div className={`${styles.inlineAdminNotice} ${styles[captainNotices[team.id].type]}`} role="status">{captainNotices[team.id].text}</div> : null}
                  <button className={styles.dangerButton} type="button" disabled={saving} onClick={() => { if (window.confirm(`Ar tikrai ištrinti komandą „${team.name}“? Žaidėjai liks registruoti, bet taps nepriskirti.`)) void runAction({ action: "delete_team", adminPin, teamId: team.id }, "Komanda ištrinta."); }}>Ištrinti komandą</button>
                </article>
              ))}
            </div>

            <div className={styles.adminPlayers}>
              <h3>Žaidėjų paskyrimas ir pajėgumas</h3>
              {players.map((player) => (
                <div key={player.id}>
                  <strong>{playerName(player)}</strong>
                  <select value={player.skillLevel ?? ""} onChange={(event) => void runAction({ action: "update_player_skill", adminPin, playerId: player.id, skillLevel: event.target.value || null }, "Žaidėjo lygis atnaujintas.")} disabled={saving}>
                    <option value="">Lygis nepasirinktas</option>
                    {SKILL_LEVELS.map((level) => <option value={level} key={level}>{level} lygis</option>)}
                  </select>
                  <select value={player.assignedTeamId ?? ""} onChange={(event) => void runAction({ action: "assign_player", adminPin, playerId: player.id, teamId: event.target.value || null }, "Žaidėjo komanda atnaujinta.")} disabled={saving}>
                    <option value="">Dar nepriskirtas</option>
                    {teams.map((team) => <option value={team.id} key={team.id}>{team.name}</option>)}
                  </select>
                  <button className={styles.dangerButton} type="button" disabled={saving} onClick={() => { if (window.confirm(`Ar tikrai pašalinti ${playerName(player)} iš kvadrato registracijos?`)) void runAction({ action: "delete_player", adminPin, playerId: player.id }, "Žaidėjas pašalintas."); }}>Pašalinti</button>
                </div>
              ))}
            </div>

            <div className={styles.matchAdmin}>
              <h3>Gyvas rungtynių valdymas</h3>
              <form className={styles.matchForm} onSubmit={(event) => {
                event.preventDefault();
                void runAction({ action: "create_match", adminPin, teamAId: matchTeamA, teamBId: matchTeamB, court: matchCourt, startsAt: new Date(matchStartsAt).toISOString() }, "Rungtynės įtrauktos į tvarkaraštį.");
              }}>
                <label><span>Laikas</span><input type="datetime-local" value={matchStartsAt} onChange={(event) => setMatchStartsAt(event.target.value)} required /></label>
                <label><span>Aikštelė</span><input value={matchCourt} onChange={(event) => setMatchCourt(event.target.value)} maxLength={60} required /></label>
                <label><span>Pirma komanda</span><select value={matchTeamA} onChange={(event) => setMatchTeamA(event.target.value)} required><option value="">Pasirink</option>{teams.map((team) => <option value={team.id} key={team.id}>{team.name}</option>)}</select></label>
                <label><span>Antra komanda</span><select value={matchTeamB} onChange={(event) => setMatchTeamB(event.target.value)} required><option value="">Pasirink</option>{teams.map((team) => <option value={team.id} key={team.id}>{team.name}</option>)}</select></label>
                <button className={styles.primaryButton} type="submit" disabled={saving || !matchTeamA || !matchTeamB || matchTeamA === matchTeamB}>Pridėti rungtynes</button>
              </form>

              <div className={styles.matchEditorList}>
                {matches.map((match) => {
                  const draft = matchDrafts[match.id] ?? { teamAScore: match.teamAScore, teamBScore: match.teamBScore, status: match.status };
                  return (
                    <article key={match.id}>
                      <header><span>{formatMatchTime(match.startsAt)} · {match.court}</span><strong>{teamsById.get(match.teamAId)?.name} – {teamsById.get(match.teamBId)?.name}</strong></header>
                      <label><span>{teamsById.get(match.teamAId)?.name}</span><input type="number" min={0} max={999} value={draft.teamAScore} onChange={(event) => setMatchDrafts((current) => ({ ...current, [match.id]: { ...draft, teamAScore: Number(event.target.value) } }))} /></label>
                      <b>:</b>
                      <label><span>{teamsById.get(match.teamBId)?.name}</span><input type="number" min={0} max={999} value={draft.teamBScore} onChange={(event) => setMatchDrafts((current) => ({ ...current, [match.id]: { ...draft, teamBScore: Number(event.target.value) } }))} /></label>
                      <select value={draft.status} onChange={(event) => setMatchDrafts((current) => ({ ...current, [match.id]: { ...draft, status: event.target.value as KvadratasMatch["status"] } }))}>
                        <option value="scheduled">Suplanuota</option>
                        <option value="live">Vyksta dabar</option>
                        <option value="finished">Baigta</option>
                      </select>
                      <button type="button" disabled={saving} onClick={() => void runAction({ action: "update_match", adminPin, matchId: match.id, ...draft }, "Rezultatas atnaujintas.")}>Išsaugoti</button>
                      <button className={styles.dangerButton} type="button" disabled={saving} onClick={() => { if (window.confirm("Ar tikrai ištrinti šias rungtynes?")) void runAction({ action: "delete_match", adminPin, matchId: match.id }, "Rungtynės ištrintos."); }}>Ištrinti</button>
                    </article>
                  );
                })}
                {!matches.length ? <p className={styles.emptyControl}>Rungtynių dar nesukurta.</p> : null}
              </div>
            </div>
          </div>
        )}
      </section>

      {quickTeam ? (
        <div className={styles.modalBackdrop} role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) closeTeamWish(); }}>
          <form className={styles.teamWishModal} role="dialog" aria-modal="true" aria-labelledby="team-wish-title" onSubmit={submitTeamWish}>
            <button className={styles.modalClose} type="button" aria-label="Uždaryti" onClick={closeTeamWish}>×</button>
            <div className={styles.modalTeamLogo}>{teamCode(quickTeam, Math.max(0, teams.findIndex((team) => team.id === quickTeam.id)))}</div>
            <span className={styles.sectionEyebrow}>Komandos pageidavimas</span>
            <h2 id="team-wish-title">Noriu į „{quickTeam.name}“</h2>
            <p>Pirma surask savo jau esančią registraciją. Taip atnaujinsime tavo pageidavimą nesukurdami antro įrašo.</p>
            <label className={styles.modalPlayerSearch}>
              <span>Ieškok savęs pagal vardą arba pavardę</span>
              <input autoFocus type="search" value={quickPlayerSearch} onChange={(event) => { setQuickPlayerSearch(event.target.value); setQuickPlayerId(""); }} placeholder="Pradėk rašyti bent 2 raides" autoComplete="off" />
            </label>
            <div className={styles.modalPlayerResults} aria-live="polite">
              {normalizedQuickPlayerSearch.length < 2 ? <p>Įrašyk bent 2 vardo arba pavardės raides.</p> : null}
              {quickPlayerCandidates.map((player) => {
                const assignedTeam = player.assignedTeamId ? teamsById.get(player.assignedTeamId) : null;
                const preferredTeam = player.preferredTeamId ? teamsById.get(player.preferredTeamId) : null;
                const selected = player.id === quickPlayerId;
                return (
                  <button key={player.id} className={selected ? styles.selectedModalPlayer : ""} type="button" disabled={Boolean(assignedTeam)} onClick={() => setQuickPlayerId(player.id)}>
                    <span className={styles.modalPlayerInitials}>{player.firstName[0]}{player.lastName[0]}</span>
                    <span><strong>{playerName(player)}</strong><small>{assignedTeam ? `Jau patvirtinta: ${assignedTeam.name}` : preferredTeam ? `Dabartinis pageidavimas: ${preferredTeam.name}` : "Komandos dar nepasirinko"}</small></span>
                    <b>{assignedTeam ? "Patvirtinta" : selected ? "Pasirinkta" : "Pasirinkti"}</b>
                  </button>
                );
              })}
              {normalizedQuickPlayerSearch.length >= 2 && !quickPlayerCandidates.length ? (
                <div className={styles.modalNoPlayer}>
                  <p>Tokios registracijos neradome.</p>
                  <button type="button" onClick={() => { closeTeamWish(); window.setTimeout(() => document.getElementById("registracija")?.scrollIntoView({ behavior: "smooth", block: "start" }), 50); }}>Pirma užsiregistruoti</button>
                </div>
              ) : null}
            </div>
            <button className={styles.primaryButton} type="submit" disabled={saving || !quickSelectedPlayer || Boolean(quickSelectedPlayer.assignedTeamId)}>{saving ? "Saugoma..." : quickSelectedPlayer ? `Patvirtinti: ${playerName(quickSelectedPlayer)} → ${quickTeam.name}` : "Pirma pasirink save"}</button>
          </form>
        </div>
      ) : null}

      <footer className={styles.footer}>Klaipėdos kvadrato registracija · klaipedosvakaras.fun</footer>
    </main>
  );
}
