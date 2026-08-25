"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import styles from "./kvadratas.module.css";

type KvadratasTeam = {
  id: string;
  name: string;
  sortOrder: number;
  captainPlayerId: string | null;
  createdAt: string;
  updatedAt: string;
};

type KvadratasPlayer = {
  id: string;
  firstName: string;
  lastName: string;
  preferredTeamId: string | null;
  assignedTeamId: string | null;
  createdAt: string;
  updatedAt: string;
};

type KvadratasState = {
  teams: KvadratasTeam[];
  players: KvadratasPlayer[];
  serverTime?: string;
};

type Notice = { type: "success" | "warning"; text: string };

const PAGE_SIZE = 10;

function playerName(player?: KvadratasPlayer | null) {
  return player ? `${player.firstName} ${player.lastName}`.trim() : "";
}

function normalizeText(value: string) {
  return value.trim().toLocaleLowerCase("lt");
}

export default function KvadratasPage() {
  const [teams, setTeams] = useState<KvadratasTeam[]>([]);
  const [players, setPlayers] = useState<KvadratasPlayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [preferredTeamId, setPreferredTeamId] = useState("");
  const [directorySearch, setDirectorySearch] = useState("");
  const [directoryPage, setDirectoryPage] = useState(1);
  const [captainTeamId, setCaptainTeamId] = useState("");
  const [captainCode, setCaptainCode] = useState("");
  const [captainUnlockedTeamId, setCaptainUnlockedTeamId] = useState("");
  const [adminPin, setAdminPin] = useState("");
  const [adminUnlocked, setAdminUnlocked] = useState(false);
  const [newTeamName, setNewTeamName] = useState("");
  const [teamNames, setTeamNames] = useState<Record<string, string>>({});
  const [captainSelections, setCaptainSelections] = useState<Record<string, string>>({});
  const [captainCodes, setCaptainCodes] = useState<Record<string, string>>({});

  function applyState(data: KvadratasState) {
    setTeams(Array.isArray(data.teams) ? data.teams : []);
    setPlayers(Array.isArray(data.players) ? data.players : []);
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
    setCaptainSelections((current) => Object.fromEntries(teams.map((team) => [team.id, current[team.id] ?? team.captainPlayerId ?? ""])));
  }, [teams]);

  async function runAction(body: Record<string, unknown>, successText?: string) {
    setSaving(true);
    setNotice(null);
    try {
      const response = await fetch("/api/kvadratas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await response.json()) as KvadratasState & { error?: string; ok?: boolean };
      if (!response.ok) throw new Error(data.error || "Nepavyko išsaugoti pakeitimo.");
      if (Array.isArray(data.teams) && Array.isArray(data.players)) applyState(data);
      if (successText) setNotice({ type: "success", text: successText });
      return true;
    } catch (error) {
      setNotice({ type: "warning", text: error instanceof Error ? error.message : "Nepavyko išsaugoti pakeitimo." });
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function submitRegistration(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const success = await runAction({
      action: "register",
      firstName,
      lastName,
      preferredTeamId: preferredTeamId || null,
    }, "Registracija išsaugota. Tavo vardas jau matomas bendrame sąraše.");
    if (success) {
      setFirstName("");
      setLastName("");
      setPreferredTeamId("");
    }
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
  const unassignedPlayers = players.filter((player) => !player.assignedTeamId);
  const captainTeams = teams.filter((team) => team.captainPlayerId);
  const unlockedCaptainTeam = teamsById.get(captainUnlockedTeamId) ?? null;
  const captainCandidates = unassignedPlayers.slice().sort((a, b) => {
    const aPreferred = a.preferredTeamId === captainUnlockedTeamId ? 0 : 1;
    const bPreferred = b.preferredTeamId === captainUnlockedTeamId ? 0 : 1;
    return aPreferred - bPreferred || playerName(a).localeCompare(playerName(b), "lt");
  });
  const filteredPlayers = players.filter((player) => {
    const team = player.assignedTeamId ? teamsById.get(player.assignedTeamId) : null;
    const preference = player.preferredTeamId ? teamsById.get(player.preferredTeamId) : null;
    return normalizeText(`${playerName(player)} ${team?.name ?? ""} ${preference?.name ?? ""}`).includes(normalizeText(directorySearch));
  });
  const pageCount = Math.max(1, Math.ceil(filteredPlayers.length / PAGE_SIZE));
  const safePage = Math.min(directoryPage, pageCount);
  const visiblePlayers = filteredPlayers.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  return (
    <main className={styles.page}>
      <div className={styles.orangeGlow} />
      <div className={styles.blueGlow} />

      <div className={styles.topbar}>
        <Link className={styles.backLink} href="/">Grįžti į renginių pasirinkimą</Link>
        <span className={styles.liveStatus}>
          <i aria-hidden="true" /> Sąrašas atnaujinamas automatiškai
          {lastSyncedAt ? ` · ${lastSyncedAt.toLocaleTimeString("lt-LT", { hour: "2-digit", minute: "2-digit" })}` : ""}
        </span>
      </div>

      <header className={styles.hero}>
        <div className={styles.heroCopy}>
          <span className={styles.kicker}>Klaipėdos kvadratas</span>
          <h1>Susitinkame aikštelėje</h1>
          <p>Užsiregistruok žaidimui, pasirink norimą komandą kaip rekomendaciją ir stebėk, kaip kapitonai formuoja sudėtis.</p>
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

      <section className={styles.scoreboard} aria-label="Kvadrato registracijos suvestinė">
        <div><span>Užsiregistravo</span><strong>{players.length}</strong><small>žaidėjų</small></div>
        <div><span>Komandose</span><strong>{assignedCount}</strong><small>patvirtinta</small></div>
        <div><span>Laukia</span><strong>{players.length - assignedCount}</strong><small>paskyrimo</small></div>
        <div><span>Komandos</span><strong>{teams.length}</strong><small>sukurta</small></div>
      </section>

      {notice ? <div className={`${styles.notice} ${styles[notice.type]}`} role="status">{notice.text}</div> : null}

      <section className={styles.registrationGrid}>
        <div className={styles.registrationIntro}>
          <span className={styles.sectionNumber}>01</span>
          <p className={styles.sectionEyebrow}>Žaidėjo registracija</p>
          <h2>Įrašyk save į rungtynių sąrašą</h2>
          <p>Vardas ir pavardė bus matomi visiems dalyviams. Komandos pasirinkimas yra tik tavo pageidavimas, kol jo nepatvirtino kapitonas.</p>
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
            <legend>Kurioje komandoje norėtum žaisti? <small>nebūtina</small></legend>
            <div className={styles.preferenceGrid}>
              <button className={!preferredTeamId ? styles.selectedPreference : ""} type="button" onClick={() => setPreferredTeamId("")}>Nesvarbu</button>
              {teams.map((team) => (
                <button className={preferredTeamId === team.id ? styles.selectedPreference : ""} type="button" key={team.id} onClick={() => setPreferredTeamId(team.id)}>{team.name}</button>
              ))}
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
          <div><h2>Sudėtys matomos visiems</h2><p>Pageidaujantys rodomi atskirai, kol kapitonas juos patvirtina.</p></div>
        </div>
        <div className={styles.teamGrid}>
          {teams.map((team, index) => {
            const members = players.filter((player) => player.assignedTeamId === team.id);
            const captain = team.captainPlayerId ? playersById.get(team.captainPlayerId) : null;
            const wishes = players.filter((player) => player.preferredTeamId === team.id && !player.assignedTeamId);
            return (
              <article className={styles.teamCard} key={team.id} style={{ "--team-index": index } as React.CSSProperties}>
                <header>
                  <span>Komanda {String(index + 1).padStart(2, "0")}</span>
                  <strong>{team.name}</strong>
                  <small>{members.length} žaid.</small>
                </header>
                <div className={styles.captainRow}>
                  <span>KAPITONAS</span>
                  <strong>{captain ? playerName(captain) : "Dar nepaskirtas"}</strong>
                </div>
                <ol className={styles.memberList}>
                  {members.length ? members.map((player) => (
                    <li key={player.id} className={player.id === team.captainPlayerId ? styles.captainMember : ""}>
                      <span>{playerName(player)}</span>
                      {player.id === team.captainPlayerId ? <small>C</small> : null}
                    </li>
                  )) : <li className={styles.emptyRow}>Komanda dar renkama</li>}
                </ol>
                <div className={styles.wishList}>
                  <span>NORI Į ŠIĄ KOMANDĄ</span>
                  {wishes.length ? <p>{wishes.map(playerName).join(" · ")}</p> : <p>Pageidavimų dar nėra</p>}
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeading}>
          <div><span className={styles.sectionNumber}>03</span><p className={styles.sectionEyebrow}>Viešas sąrašas</p></div>
          <div><h2>Visi užsiregistravę žaidėjai</h2><p>Greitai rask vardą ir pamatyk komandos pageidavimą bei patvirtintą sudėtį.</p></div>
        </div>
        <div className={styles.directoryToolbar}>
          <input type="search" value={directorySearch} onChange={(event) => { setDirectorySearch(event.target.value); setDirectoryPage(1); }} placeholder="Ieškoti pagal vardą, pavardę ar komandą" />
          <strong>{filteredPlayers.length} įraš.</strong>
        </div>
        <div className={styles.tableWrap}>
          <table className={styles.playerTable}>
            <thead><tr><th>Nr.</th><th>Žaidėjas</th><th>Pageidavimas</th><th>Patvirtinta komanda</th></tr></thead>
            <tbody>
              {visiblePlayers.map((player, index) => (
                <tr key={player.id}>
                  <td>{(safePage - 1) * PAGE_SIZE + index + 1}</td>
                  <td><strong>{playerName(player)}</strong></td>
                  <td>{player.preferredTeamId ? teamsById.get(player.preferredTeamId)?.name ?? "-" : "Nesvarbu"}</td>
                  <td>{player.assignedTeamId ? <span className={styles.confirmedBadge}>{teamsById.get(player.assignedTeamId)?.name ?? "Komanda"}</span> : <span className={styles.waitingBadge}>Laukia kapitono</span>}</td>
                </tr>
              ))}
              {!visiblePlayers.length ? <tr><td colSpan={4} className={styles.emptyTable}>{loading ? "Kraunamas sąrašas..." : "Žaidėjų dar nėra."}</td></tr> : null}
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

      <section className={`${styles.section} ${styles.controlSection}`}>
        <div className={styles.sectionHeading}>
          <div><span className={styles.sectionNumber}>04</span><p className={styles.sectionEyebrow}>Kapitonams</p></div>
          <div><h2>Formuok savo komandą</h2><p>Prisijunk su administratoriaus suteiktu komandos kodu ir patvirtink žaidėjus.</p></div>
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
              <button type="button" onClick={() => { setCaptainUnlockedTeamId(""); setCaptainCode(""); }}>Atsijungti</button>
            </div>
            <div className={styles.candidateGrid}>
              {captainCandidates.map((player) => (
                <article key={player.id} className={player.preferredTeamId === captainUnlockedTeamId ? styles.preferredCandidate : ""}>
                  <div><strong>{playerName(player)}</strong><small>{player.preferredTeamId === captainUnlockedTeamId ? "Nori į tavo komandą" : player.preferredTeamId ? `Pageidauja: ${teamsById.get(player.preferredTeamId)?.name ?? "kita komanda"}` : "Komanda nesvarbi"}</small></div>
                  <button type="button" disabled={saving} onClick={() => void runAction({ action: "captain_assign_player", teamId: captainUnlockedTeamId, captainCode, playerId: player.id }, `${playerName(player)} patvirtintas komandoje.`)}>Priimti</button>
                </article>
              ))}
              {!captainCandidates.length ? <p className={styles.emptyControl}>Visi žaidėjai jau paskirstyti.</p> : null}
            </div>
          </div>
        )}
      </section>

      <section className={`${styles.section} ${styles.adminSection}`}>
        <div className={styles.sectionHeading}>
          <div><span className={styles.sectionNumber}>05</span><p className={styles.sectionEyebrow}>Organizatoriui</p></div>
          <div><h2>Komandų administravimas</h2><p>Čia paskiriami kapitonai, jų kodai ir galutinės žaidėjų komandos.</p></div>
        </div>
        {!adminUnlocked ? (
          <form className={styles.unlockForm} onSubmit={unlockAdmin}>
            <label><span>Administratoriaus PIN</span><input type="password" value={adminPin} onChange={(event) => setAdminPin(event.target.value)} placeholder="Įvesk PIN" required /></label>
            <button className={styles.secondaryButton} type="submit" disabled={saving}>Atrakinti administravimą</button>
          </form>
        ) : (
          <div className={styles.adminDashboard}>
            <form className={styles.newTeamForm} onSubmit={(event) => { event.preventDefault(); void runAction({ action: "create_team", adminPin, name: newTeamName }, "Komanda sukurta.").then((success) => { if (success) setNewTeamName(""); }); }}>
              <label><span>Nauja komanda</span><input value={newTeamName} onChange={(event) => setNewTeamName(event.target.value)} placeholder="Pvz. Žaibai" maxLength={60} required /></label>
              <button className={styles.primaryButton} type="submit" disabled={saving}>Sukurti komandą</button>
            </form>

            <div className={styles.adminTeamGrid}>
              {teams.map((team) => (
                <article key={team.id}>
                  <label><span>Komandos pavadinimas</span><input value={teamNames[team.id] ?? team.name} onChange={(event) => setTeamNames((current) => ({ ...current, [team.id]: event.target.value }))} /></label>
                  <button type="button" disabled={saving || (teamNames[team.id] ?? team.name).trim() === team.name} onClick={() => void runAction({ action: "rename_team", adminPin, teamId: team.id, name: teamNames[team.id] }, "Komandos pavadinimas pakeistas.")}>Išsaugoti pavadinimą</button>
                  <label><span>Kapitonas</span><select value={captainSelections[team.id] ?? ""} onChange={(event) => setCaptainSelections((current) => ({ ...current, [team.id]: event.target.value }))}><option value="">Nepaskirtas</option>{players.map((player) => <option value={player.id} key={player.id}>{playerName(player)}</option>)}</select></label>
                  <label><span>Kapitono kodas</span><input type="text" value={captainCodes[team.id] ?? ""} onChange={(event) => setCaptainCodes((current) => ({ ...current, [team.id]: event.target.value }))} placeholder={team.captainPlayerId ? "Įrašyk naują tik keičiant" : "Bent 4 simboliai"} /></label>
                  <button type="button" disabled={saving || (Boolean(captainSelections[team.id]) && (captainCodes[team.id]?.trim().length ?? 0) < 4)} onClick={() => void runAction({ action: "assign_captain", adminPin, teamId: team.id, playerId: captainSelections[team.id] || null, captainCode: captainCodes[team.id] ?? "" }, captainSelections[team.id] ? "Kapitonas paskirtas. Perduok jam įrašytą kodą." : "Kapitonas pašalintas.").then((success) => { if (success) setCaptainCodes((current) => ({ ...current, [team.id]: "" })); })}>{captainSelections[team.id] ? "Paskirti kapitoną" : "Pašalinti kapitoną"}</button>
                  <button className={styles.dangerButton} type="button" disabled={saving} onClick={() => { if (window.confirm(`Ar tikrai ištrinti komandą „${team.name}“? Žaidėjai liks registruoti, bet taps nepriskirti.`)) void runAction({ action: "delete_team", adminPin, teamId: team.id }, "Komanda ištrinta."); }}>Ištrinti komandą</button>
                </article>
              ))}
            </div>

            <div className={styles.adminPlayers}>
              <h3>Žaidėjų paskyrimas</h3>
              {players.map((player) => (
                <div key={player.id}>
                  <strong>{playerName(player)}</strong>
                  <select value={player.assignedTeamId ?? ""} onChange={(event) => void runAction({ action: "assign_player", adminPin, playerId: player.id, teamId: event.target.value || null }, "Žaidėjo komanda atnaujinta.")} disabled={saving}>
                    <option value="">Dar nepriskirtas</option>
                    {teams.map((team) => <option value={team.id} key={team.id}>{team.name}</option>)}
                  </select>
                  <button className={styles.dangerButton} type="button" disabled={saving} onClick={() => { if (window.confirm(`Ar tikrai pašalinti ${playerName(player)} iš kvadrato registracijos?`)) void runAction({ action: "delete_player", adminPin, playerId: player.id }, "Žaidėjas pašalintas."); }}>Pašalinti</button>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      <footer className={styles.footer}>Klaipėdos kvadrato registracija · klaipedosvakaras.fun</footer>
    </main>
  );
}
