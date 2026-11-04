"use client";

import { useEffect, useMemo, useState } from "react";
import {
  PARTY_BALLOT_CATEGORIES,
  type PartyBallotCategoryId,
  type PartyBallotParticipant,
  partyBallotResults,
} from "../../lib/party-ballot";
import styles from "./balsavimas.module.css";

type Results = ReturnType<typeof partyBallotResults>;
type BallotResponse = {
  participants?: PartyBallotParticipant[];
  results?: Results;
  votedCategoryIds?: PartyBallotCategoryId[];
  error?: string;
};

function normalize(value: string) {
  return value.toLocaleLowerCase("lt").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function voteWord(count: number) {
  if (count % 100 >= 11 && count % 100 <= 19) return "balsų";
  if (count % 10 === 1) return "balsas";
  if (count % 10 >= 2 && count % 10 <= 9) return "balsai";
  return "balsų";
}

export default function BalsavimasPage() {
  const [participants, setParticipants] = useState<PartyBallotParticipant[]>([]);
  const [results, setResults] = useState<Results>([]);
  const [votedCategoryIds, setVotedCategoryIds] = useState<PartyBallotCategoryId[]>([]);
  const [queries, setQueries] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<PartyBallotCategoryId | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const response = await fetch("/api/balsavimas", { cache: "no-store" });
        const data = await response.json() as BallotResponse;
        if (!response.ok || !data.participants || !data.results || !data.votedCategoryIds) {
          throw new Error(data.error || "Balsavimo duomenų įkelti nepavyko.");
        }
        if (active) {
          setParticipants(data.participants);
          setResults(data.results);
          setVotedCategoryIds(data.votedCategoryIds);
          setError("");
        }
      } catch (loadError) {
        if (active) setError(loadError instanceof Error ? loadError.message : "Patikrink ryšį ir atnaujink puslapį.");
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    const timer = window.setInterval(() => void load(), 8_000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  const matches = useMemo(() => Object.fromEntries(PARTY_BALLOT_CATEGORIES.map((category) => {
    const terms = normalize(queries[category.id]?.trim() ?? "").split(/\s+/).filter(Boolean);
    return [category.id, terms.length ? participants.filter((person) => {
      const name = normalize(person.name);
      return terms.every((term) => name.includes(term));
    }) : []];
  })) as Record<PartyBallotCategoryId, PartyBallotParticipant[]>, [participants, queries]);

  async function vote(categoryId: PartyBallotCategoryId, targetPersonId: string) {
    if (saving || votedCategoryIds.includes(categoryId)) return;
    setSaving(categoryId);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/balsavimas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ categoryId, targetPersonId }),
      });
      const data = await response.json() as BallotResponse;
      if (!response.ok || !data.results || !data.votedCategoryIds) {
        throw new Error(data.error || "Balso išsaugoti nepavyko.");
      }
      setResults(data.results);
      setVotedCategoryIds(data.votedCategoryIds);
      setNotice("Balsas įskaitytas. Ačiū, kad dalyvauji!");
    } catch (voteError) {
      setError(voteError instanceof Error ? voteError.message : "Balso išsaugoti nepavyko.");
    } finally {
      setSaving(null);
    }
  }

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <header className={styles.hero}>
          <span className={styles.kicker}>TAUTOS · APLINK PASAULĮ PER 360 MINUČIŲ</span>
          <h1>Vakaro <span>nominacijos</span></h1>
          <p>Surask dalyvį pagal vardą ar pavardę ir atiduok balsą. Kiekvienoje nominacijoje iš šio įrenginio galima balsuoti vieną kartą.</p>
          <div className={styles.heroFacts}>
            <span><strong>3</strong> nominacijos</span>
            <span><strong>{loading ? "…" : participants.length}</strong> dalyvių</span>
            <span>Anoniminiai balsai</span>
          </div>
        </header>

        {error ? <p className={styles.error} role="alert">{error}</p> : null}
        {notice ? <p className={styles.notice} role="status">{notice}</p> : null}

        <div className={styles.categories} aria-label="Balsavimo nominacijos">
          {PARTY_BALLOT_CATEGORIES.map((category, index) => {
            const alreadyVoted = votedCategoryIds.includes(category.id);
            const query = queries[category.id] ?? "";
            return (
              <section className={styles.category} key={category.id} aria-labelledby={`category-${category.id}`}>
                <span className={styles.categoryNumber}>NOMINACIJA {String(index + 1).padStart(2, "0")}</span>
                <h2 id={`category-${category.id}`}>{category.label}</h2>
                {alreadyVoted ? (
                  <p className={styles.done}>Balsas šioje nominacijoje jau įskaitytas</p>
                ) : (
                  <div className={styles.searchArea}>
                    <label htmlFor={`search-${category.id}`}>Ieškok pagal vardą arba pavardę</label>
                    <input
                      id={`search-${category.id}`}
                      type="search"
                      value={query}
                      onChange={(event) => setQueries((current) => ({ ...current, [category.id]: event.target.value }))}
                      placeholder="Įrašyk dalyvio vardą arba pavardę"
                      autoComplete="off"
                      disabled={loading || Boolean(saving)}
                    />
                    {loading ? <p className={styles.hint}>Kraunamas dalyvių sąrašas...</p> : null}
                    {!loading && !query.trim() ? <p className={styles.hint}>Pradėk rašyti, kad rastum žmogų iš registruotų dalyvių.</p> : null}
                    {!loading && query.trim() && matches[category.id].length === 0 ? <p className={styles.hint}>Pagal paiešką dalyvių nerasta.</p> : null}
                    {matches[category.id].length > 0 ? (
                      <div className={styles.matches} aria-label="Rasti dalyviai">
                        {matches[category.id].map((person) => (
                          <div className={styles.person} key={person.id}>
                            <strong>{person.name}</strong>
                            <button type="button" onClick={() => void vote(category.id, person.id)} disabled={Boolean(saving)}>
                              {saving === category.id ? "Saugoma..." : "Balsuoju"}
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                )}
              </section>
            );
          })}
        </div>

        <section className={styles.results} aria-labelledby="results-title">
          <span className={styles.kicker}>GYVAI ATNAUJINAMI REZULTATAI</span>
          <h2 id="results-title">Vakaro TOP 3</h2>
          <p>Rezultatai atsinaujina automatiškai kas kelias sekundes. Rodomi tik balsų skaičiai, ne balsavusiųjų vardai.</p>
          <div className={styles.resultGrid}>
            {PARTY_BALLOT_CATEGORIES.map((category) => {
              const result = results.find((item) => item.categoryId === category.id);
              return (
                <div className={styles.resultCard} key={category.id}>
                  <h3>{category.label}</h3>
                  {result?.leaders.length ? result.leaders.map((leader, index) => (
                    <div className={styles.leader} key={leader.personId}>
                      <span className={styles.rank}>{index + 1}</span>
                      <strong>{leader.name}</strong>
                      <span className={styles.count}>{leader.count} {voteWord(leader.count)}</span>
                    </div>
                  )) : <p className={styles.empty}>Dar nėra balsų. Pirmasis balsas gali būti tavo!</p>}
                </div>
              );
            })}
          </div>
        </section>
        <footer className={styles.footer}>Balsavimas anoniminis. Vienam įrenginiui leidžiamas vienas balsas kiekvienoje nominacijoje; būtini naršyklės slapukai.</footer>
      </div>
    </main>
  );
}
