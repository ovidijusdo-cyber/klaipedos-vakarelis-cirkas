"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import styles from "./filialas.module.css";

type Interest = { id: string; fullName: string; createdAt: string };
type InterestResponse = { registrations?: Interest[]; count?: number; error?: string };

const days = [
  {
    day: "Balandžio 15 d. · ketvirtadienis",
    number: "01",
    route: "Lietuva → Estija",
    description: "Autobusu išvykstame iš Klaipėdos į Estiją, kur apsistojame nakvynei.",
  },
  {
    day: "Balandžio 16 d. · penktadienis",
    number: "02",
    route: "Estija → Suomija → Estija",
    description: "Keltu persikeliame į Suomiją, aplankome filialą, muziejus ir pasivaikštome po miestą. Vakare keltu grįžtame į Estiją ir pernakvojame.",
  },
  {
    day: "Balandžio 17 d. · šeštadienis",
    number: "03",
    route: "Estija → Klaipėda",
    description: "Autobusu keliaujame atgal į Klaipėdą.",
  },
];

export default function FilialasPage() {
  const [registrations, setRegistrations] = useState<Interest[]>([]);
  const [fullName, setFullName] = useState("");
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
        body: JSON.stringify({ fullName }),
      });
      const data = (await response.json()) as InterestResponse;
      if (!response.ok || !Array.isArray(data.registrations)) throw new Error(data.error || "Registracija nepavyko.");
      setRegistrations(data.registrations);
      setFullName("");
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
            <span className={styles.eyebrow}>🇫🇮 Bendra kelionė autobusu · 2027 m. balandžio 15–17 d.</span>
            <h1 id="filialas-title">Kelionė į <em>Suomijos filialą</em></h1>
            <p>Brangūs broliai ir sesės! Nemažai jūsų esate užsiminę, kad norėtumėte aplankyti Jehovos liudytojų filialą Suomijoje (Betelį). Todėl pabandykime suorganizuoti bendrą trijų dienų kelionę autobusu iš Klaipėdos!</p>
            <a className={styles.heroAction} href="#registracija">Užsirašyti į norinčiųjų sąrašą <span aria-hidden="true">↗</span></a>
            <div className={styles.heroFacts}>
              <div><small>DATA</small><strong>2027 m. balandžio 15–17 d.</strong></div>
              <div><small>TRUKMĖ</small><strong>Ketvirtadienis – šeštadienis</strong></div>
              <div><small>PRELIMINARI KAINA</small><strong>150–200 € / asmeniui</strong></div>
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

        <section className={styles.registrationArea} id="registracija" aria-labelledby="register-title">
          <div className={styles.formCard}>
            <span className={styles.sectionKicker}>VIETA NORINČIŲJŲ SĄRAŠE</span>
            <h2 id="register-title">Norėtum vykti?</h2>
            <p>Jei ši kelionė tave domina, įrašyk vardą ir pavardę. Tai tik preliminari registracija norinčiųjų skaičiui įvertinti, o ne apmokėjimas ar patvirtinta vieta autobuse.</p>
            <form onSubmit={register}>
              <label className={styles.nameLabel} htmlFor="traveler-name">Vardas Pavardė</label>
              <input
                id="traveler-name"
                className={styles.nameInput}
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                placeholder="Įrašyk vardą ir pavardę"
                autoComplete="name"
                maxLength={100}
                required
              />
              <p className={styles.nameVisibilityNote}>Įrašytas vardas ir pavardė bus matomi šiame norinčiųjų sąraše.</p>
              <p className={styles.priorityNotice}>Pirmenybė teikiama Klaipėdos Šiaurės bendruomenei</p>
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

        <section className={styles.introStrip} aria-label="Svarbi kelionės informacija">
          <div><span>01</span><strong>Tik preliminari registracija</strong><p>Kol kas renkame norinčiųjų vardus. Žinodami grupės dydį galėsime tiksliau suplanuoti kelionę.</p></div>
          <div><span>02</span><strong>Balandžio 15–17 d.</strong><p>Trijų dienų kelionė nuo ketvirtadienio iki šeštadienio. Tikslūs išvykimo laikai bus pranešti vėliau.</p></div>
          <div><span>03</span><strong>Apie 150–200 € asmeniui</strong><p>Preliminari suma apima autobusą, kurą, nakvynes ir kitas kelionės išlaidas. Galutinė kaina priklausys nuo norinčiųjų skaičiaus.</p></div>
        </section>

        <section className={styles.itinerary} aria-labelledby="route-title">
          <div className={styles.sectionHeading}>
            <span className={styles.sectionKicker}>KELIONĖS EIGA</span>
            <h2 id="route-title">Trys dienos drauge</h2>
            <p>Numatomas maršrutas. Tikslūs laikai, nakvynės vietos ir lankytini objektai bus patikslinti vėliau.</p>
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

        <section className={styles.closingNote} aria-label="Kvietimas keliauti drauge">
          <strong>Būtų labai smagu kartu aplankyti filialą ir praleisti tris gražias dienas bendrystėje!</strong>
          <p>Kai žinosime, kiek mūsų būtų, pateiksime galutinį kelionės planą ir tikslią kainą.</p>
        </section>

        <footer className={styles.footer}>Kelionės informacija preliminari. Galutinį planą ir tikslią kainą paskelbsime įvertinę norinčiųjų skaičių.</footer>
      </div>
    </main>
  );
}
