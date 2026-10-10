"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import styles from "./filialas.module.css";

type Interest = { id: string; fullName: string; createdAt: string };
type InterestResponse = { registrations?: Interest[]; count?: number; error?: string };

const days = [
  {
    day: "Ketvirtadienis",
    number: "01",
    route: "Lietuva → Estija",
    description: "Išvykstame iš Klaipėdos išnuomotu autobusu. Atvykę į Estiją nakvojame viešbutyje.",
  },
  {
    day: "Penktadienis",
    number: "02",
    route: "Estija → Suomija → Estija",
    description: "Ryte keltu persikeliame į Suomiją ir vykstame į filialą. Vėliau numatome laiką muziejams arba lankytinoms vietoms. Vakare grįžtame į Estiją ir nakvojame viešbutyje.",
  },
  {
    day: "Šeštadienis",
    number: "03",
    route: "Estija → Klaipėda",
    description: "Po nakvynės autobusu grįžtame į Klaipėdą.",
  },
];

export default function FilialasPage() {
  const [registrations, setRegistrations] = useState<Interest[]>([]);
  const [fullName, setFullName] = useState("");
  const [consent, setConsent] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const response = await fetch("/api/filialas", { cache: "no-store" });
        const data = (await response.json()) as InterestResponse;
        if (!response.ok || !Array.isArray(data.registrations)) throw new Error(data.error || "Sąrašo įkelti nepavyko.");
        if (active) {
          setRegistrations(data.registrations);
          setLoadError("");
        }
      } catch {
        if (active) setLoadError("Nepavyko atnaujinti sąrašo. Patikrink ryšį ir atnaujink puslapį.");
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();
    const timer = window.setInterval(() => void load(), 15_000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  async function register(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setNotice("");
    try {
      const response = await fetch("/api/filialas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName, publicNameConsent: consent }),
      });
      const data = (await response.json()) as InterestResponse;
      if (!response.ok || !Array.isArray(data.registrations)) throw new Error(data.error || "Registracija nepavyko.");
      setRegistrations(data.registrations);
      setFullName("");
      setConsent(false);
      setNotice("Ačiū! Tavo vardas įrašytas į norinčiųjų sąrašą.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Registracija nepavyko. Bandyk dar kartą.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <nav className={styles.topbar} aria-label="Puslapio navigacija">
          <Link className={styles.backLink} href="/">← Visi renginiai</Link>
          <span className={styles.siteName}>KLAIPĖDOS JW RENGINIAI</span>
        </nav>

        <section className={styles.hero} aria-labelledby="filialas-title">
          <div className={styles.heroCopy}>
            <span className={styles.eyebrow}>Planuojama bendra kelionė · 2027 m. balandis</span>
            <h1 id="filialas-title">Kartu į filialą <em>Suomijoje</em></h1>
            <p>Ar vyktum kartu autobusu iš Klaipėdos? Šiuo metu renkame norinčiųjų vardus, kad galėtume įvertinti grupės dydį ir suplanuoti kelionę.</p>
            <a className={styles.heroAction} href="#registracija">Užsirašyti į norinčiųjų sąrašą <span aria-hidden="true">↗</span></a>
            <div className={styles.heroFacts}>
              <div><small>TRUKMĖ</small><strong>Ketvirtadienis – šeštadienis</strong></div>
              <div><small>NUMATOMA KAINA</small><strong>Apie 150–200 € / asmeniui</strong></div>
            </div>
          </div>
          <div className={styles.routeArt} aria-hidden="true">
            <span className={styles.mapDotStart}>Klaipėda</span>
            <span className={styles.routeLine} />
            <span className={styles.mapDotMiddle}>Estija</span>
            <span className={styles.routeLineSecond} />
            <span className={styles.mapDotEnd}>Suomija</span>
            <div className={styles.routeCaption}>Vienas autobusas. Viena kelionė. Daug bendrų įspūdžių.</div>
          </div>
        </section>

        <section className={styles.introStrip} aria-label="Svarbi kelionės informacija">
          <div><span>01</span><strong>Susidomėjimo registracija</strong><p>Įrašytas vardas padės suprasti, kiek žmonių norėtų vykti.</p></div>
          <div><span>02</span><strong>Data tikslinama</strong><p>Kelionė planuojama balandį; konkreti savaitė dar nenustatyta.</p></div>
          <div><span>03</span><strong>Kaina preliminari</strong><p>Tiksli suma paaiškės žinant grupės dydį ir kelionės išlaidas.</p></div>
        </section>

        <section className={styles.itinerary} aria-labelledby="route-title">
          <div className={styles.sectionHeading}>
            <span className={styles.sectionKicker}>KELIONĖS EIGA</span>
            <h2 id="route-title">Trys dienos drauge</h2>
            <p>Numatomas maršrutas. Laikai, nakvynės vietos ir lankytinos vietos bus patikslinti vėliau.</p>
          </div>
          <div className={styles.dayGrid}>
            {days.map((item) => (
              <article className={styles.dayCard} key={item.number}>
                <div className={styles.dayTop}><span>{item.number}</span><small>{item.day}</small></div>
                <h3>{item.route}</h3>
                <p>{item.description}</p>
              </article>
            ))}
          </div>
        </section>

        <section className={styles.registrationArea} id="registracija" aria-labelledby="register-title">
          <div className={styles.formCard}>
            <span className={styles.sectionKicker}>VIETA NORINČIŲJŲ SĄRAŠE</span>
            <h2 id="register-title">Norėtum vykti?</h2>
            <p>Įrašyk savo vardą ir pavardę. Tai yra susidomėjimo registracija, o ne apmokėjimas ar patvirtinta vieta autobuse.</p>
            <form onSubmit={register}>
              <label className={styles.nameLabel} htmlFor="traveler-name">Vardas ir pavardė</label>
              <input
                id="traveler-name"
                className={styles.nameInput}
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                placeholder="Pvz., Vardas Pavardė"
                autoComplete="name"
                maxLength={100}
                required
              />
              <label className={styles.consent}>
                <input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} required />
                <span>Sutinku, kad mano vardas ir pavardė būtų matomi šiame viešame norinčiųjų sąraše.</span>
              </label>
              <button className={styles.submitButton} type="submit" disabled={saving || loading || Boolean(loadError)}>
                {saving ? "Įrašoma..." : "Užsiregistruoti kaip norinčiam vykti"}
                <span aria-hidden="true">→</span>
              </button>
              {notice ? <p className={styles.notice} role="status">{notice}</p> : null}
              {loadError ? <p className={styles.error} role="alert">{loadError}</p> : null}
            </form>
          </div>

          <div className={styles.busCard} aria-labelledby="bus-title">
            <div className={styles.busHeading}>
              <div>
                <span className={styles.sectionKicker}>BŪSIMI KELEIVIAI</span>
                <h2 id="bus-title">Kelionės autobusas</h2>
              </div>
              <div className={styles.countBadge}><strong>{registrations.length}</strong><span>norinčiųjų</span></div>
            </div>
            <p className={styles.busHint}>Vardai rodomi autobuso iliustracijoje. Sėdėjimo vietos neskiriamos.</p>
            <div className={styles.bus}>
              <div className={styles.windshield}><span>KLAIPĖDA</span><span>→</span><span>SUOMIJA</span></div>
              <div className={styles.driverArea}><span className={styles.wheel} aria-hidden="true" /><span>Kelionė prasideda čia</span></div>
              <div className={styles.passengerList} aria-live="polite">
                {loading ? <p className={styles.emptyBus}>Kraunamas keleivių sąrašas...</p> : null}
                {!loading && registrations.length === 0 ? <p className={styles.emptyBus}>Autobusas laukia pirmųjų norinčiųjų.</p> : null}
                {registrations.map((person, index) => (
                  <div className={styles.passenger} key={person.id}>
                    <span className={styles.passengerNumber}>{String(index + 1).padStart(2, "0")}</span>
                    <strong>{person.fullName}</strong>
                  </div>
                ))}
              </div>
              <div className={styles.busEnd}>SĄRAŠAS ATNAUJINAMAS AUTOMATIŠKAI</div>
            </div>
          </div>
        </section>

        <footer className={styles.footer}>Kelionės informacija preliminari. Galutinį planą ir tikslią kainą paskelbsime įvertinę norinčiųjų skaičių.</footer>
      </div>
    </main>
  );
}
