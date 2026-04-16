"use client";

import type { FormEvent, ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";

declare global {
  interface Window {
    BarcodeDetector?: {
      new (options: { formats: string[] }): BarcodeDetectorLike;
    };
  }
}

type PersonType = "adult" | "child";
type PaymentMethod = "bank" | "cash" | null;
type NoticeType = "success" | "warning";

type Person = {
  id: string;
  firstName: string;
  lastName: string;
  type: PersonType;
  active: boolean;
  arrived: boolean;
  arrivedAt: string | null;
};

type Reservation = {
  id: number;
  city: string;
  contactPhone: string;
  contactEmail: string;
  qrCode: string;
  paid: boolean;
  paymentMethod: PaymentMethod;
  preferredPaymentMethod: PaymentMethod;
  createdAt: string;
  discountPercent: number;
  people: Person[];
};

type WaitingItem = {
  id: number;
  city: string;
  contactPhone: string;
  contactEmail: string;
  people: Person[];
  createdAt: string;
};

type NotificationItem = {
  id: number;
  message: string;
  createdAt: string;
};

type TransferItem = {
  id: number;
  reservationId: number;
  originalName: string;
  replacementName: string;
  replacementPhone: string;
  createdAt: string;
};

type VotingCategory = {
  id: string;
  label: string;
};

type VoteRecord = {
  id: number;
  categoryId: string;
  voterPersonId: string;
  targetPersonId: string;
  createdAt: string;
};

type SongSuggestion = {
  id: number;
  title: string;
  url: string;
  source: string;
};

type EventIdea = {
  id: number;
  text: string;
};

type GameScore = {
  id: number;
  name: string;
  score: number;
  createdAt: string;
};

type ResponsiblePerson = {
  id: number;
  role: string;
  names: string;
};

type PersonForm = {
  formId: string;
  firstName: string;
  lastName: string;
  type: PersonType;
};

type Notice = {
  type: NoticeType;
  text: string;
};

type PublicPanel = "guests" | "program" | "important" | "songs" | "responsible" | "qr" | "admin";

type PendingCancel = {
  reservationId: number;
  personId: string;
  name: string;
} | null;

type BarcodeDetectorLike = {
  detect: (source: ImageBitmapSource) => Promise<Array<{ rawValue?: string }>>;
};

const ADMIN_PIN = "2026";
const REVOLUT_PAYMENT_URL = "https://revolut.me/ovidij1c5";
const REVOLUT_APP_URL = "https://app.revolut.com/";
const BANK_ACCOUNT = {
  recipient: "Ovidijus Domkus",
  iban: "LT42 3250 0669 2279 1534",
  bic: "REVOLT21",
  bankName: "Revolut Bank UAB",
  bankAddress: "Konstitucijos ave. 21B, 08130, Vilnius, Lithuania",
  correspondentBic: "CHASDEFX",
  currency: "EUR",
};
const TELEGRAM_GROUP_URL = "https://t.me/+2Lo4XbXkjcM3NTBk";
const EVENT_NAME = "2026 m. Klaipėdos vakarėlis „CIRKAS”";
const EVENT_DATE = "2026 m. gegužės 30 d.";
const EVENT_START_ISO = "2026-05-30T17:30:00+03:00";
const EVENT_PLACE = "Priekulės kultūros centras";
const GOOGLE_MAPS_URL = "https://www.google.com/maps/search/?api=1&query=Priekul%C4%97s+kult%C5%ABros+centras";
const WAZE_URL = "https://waze.com/ul?q=Priekul%C4%97s%20kult%C5%ABros%20centras";
const ADULT_PRICE = 10;
const CHILD_AGE_LIMIT = 12;
const VOLUNTEER_DISCOUNT_CODE = "noriuprisideti50";
const VOLUNTEER_DISCOUNT_PERCENT = 50;
const MAX_PLACES = 120;

const PROGRAM_ITEMS = [
  { time: "15:00", title: "Renkasi savanoriai puošti", note: "Atvyksta savanoriai, ruošiama salė ir dekoracijos." },
  { time: "17:30", title: "Įėjimas svečiams", note: "Prasideda svečių pasitikimas ir registracija prie įėjimo." },
  { time: "18:30", title: "Renginio pradžia", note: "Oficiali vakaro pradžia, vedėjų pasveikinimas ir pirmos veiklos." },
  { time: "19:00", title: "Žaidimai ir šokiai", note: "Žaidimai, muzika, staigmenos ir cirko tematikos linksmybės." },
  { time: "22:00", title: "Laisva vakaro dalis", note: "Diskoteka, bendravimas ir vakaro užbaigimas." },
];

const IMPORTANT_REMINDERS = [
  "Galima saikingai vartoti alkoholį.",
  "Renginio laikas dar gali būti papildytas tikslesnėmis detalėmis.",
  "Po renginio kviesime prisidėti prie bendro sutvarkymo.",
  "Vienkartiniai indai bus paruošti vietoje.",
  "Prašome atsinešti gaiviųjų gėrimų ir savo pagamintų patiekalų.",
  "Bus bendras švediškas stalas.",
];

const WHEEL_PRIZES = [
  "Pakviesk 2 žmones šokiui",
  "Pasakyk komplimentą ryškiausiam kostiumui",
  "Pasidaryk cirko stiliaus nuotrauką",
  "Užsidėk ryškiausią akcentą",
  "Susipažink su žmogumi iš kito miesto",
  "Pakelk nuotaiką 3 žmonėms",
  "Padaryk grupinę asmenukę",
  "Pagirk skaniausią patiekalą",
  "Sugalvok juokingą cirko pravardę draugui",
  "Pakviesk kažką kartu prie stalo",
  "Pasiūlyk savo mėgstamą dainą",
  "Paeik ratą po salę su šypsena",
  "Pašok pagal pirmą išgirstą dainą",
  "Atrask įdomiausią cirko akcentą",
  "Pasakyk 2 žmonėms po komplimentą",
  "Pasidaryk nuotrauką su nauju žmogumi",
  "Sugalvok mini tostą vakarui",
  "Pakviesk žmogų į pokalbį",
  "Padėk kam nors sukurti nuotrauką",
  "Tapk vakaro energijos ambasadoriumi",
  "Paklausk kito svečio, iš kur atvyko",
  "Pakviesk 1 žmogų prie švediško stalo",
  "Pabandyk cirko pozą nuotraukai",
  "Sugalvok slaptą vakaro misiją draugui",
  "Paeik prie DJ ir pasisveikink",
  "Padaryk vieną labai linksmą nuotrauką",
  "Atrask žmogų su įdomiausiu aksesuaru",
  "Pakviesk kažką kartu šokti",
  "Pasidžiauk vakaru garsiai",
  "Palinkėk kažkam gero vakaro tęsinio",
  "Atrask skaniausią desertą",
  "Užkalbink žmogų, kurio dar nepažįsti",
  "Pakviesk 2 žmones nusifotografuoti",
  "Išsirink mėgstamiausią vakaro detalę",
  "Padaryk nuotrauką su cirko dekoracija",
  "Pasijuok kartu su nauju žmogumi",
  "Paklausk, kokia kieno mėgstamiausia daina",
  "Tapk vakaro šypsenos ambasadoriumi",
  "Pasakyk ačiū organizatoriams",
  "Pakviesk draugą į mini šokį",
  "Sugalvok cirko stiliaus komplimentą",
  "Pabandyk būti vakaro vedėju 10 sekundžių",
  "Pagirk kieno nors stilių",
  "Pažadink vakaro energiją plojimu",
  "Užvesk trumpą linksmą pokalbį",
  "Rask žmogų su ryškiausiu akcentu",
  "Padovanok kam nors gerą nuotaiką",
  "Sugalvok juokingą cirko frazę",
  "Pasveikink naują pažįstamą",
  "Tapk slaptos staigmenos dalimi",
];

const VOTING_CATEGORIES: VotingCategory[] = [
  { id: "best_circus_style", label: "Geriausiai apsirengęs cirko stiliumi" },
  { id: "tastiest_dish", label: "Skaniausias patiekalas" },
  { id: "best_energy", label: "Geriausia vakaro energija" },
  { id: "best_dance", label: "Geriausias šokėjas" },
  { id: "best_surprise", label: "Netikėčiausias vakaro akcentas" },
];

const initialSongSuggestions: SongSuggestion[] = [
  { id: 1, title: "Pavyzdys: šokių hitas", url: "https://open.spotify.com/", source: "Spotify" },
  { id: 2, title: "Pavyzdys: linksma daina", url: "https://www.youtube.com/", source: "YouTube" },
];

const initialEventIdeas: EventIdea[] = [
  { id: 1, text: "Pavyzdys: cirko tematikos žaidimas su prizais." },
];

const initialResponsiblePeople: ResponsiblePerson[] = [
  { id: 1, role: "Organizatorius", names: "" },
  { id: 2, role: "Budėtojai", names: "" },
  { id: 3, role: "Kontrolieriai", names: "" },
  { id: 4, role: "Renginio vedėjai", names: "" },
  { id: 5, role: "Atsakingas už muziką", names: "" },
  { id: 6, role: "Kamera žmogus ir žurnalistas", names: "" },
  { id: 7, role: "Šokių mokytojai", names: "" },
  { id: 8, role: "Žaidimų vedėjas", names: "" },
  { id: 9, role: "Savanoriai", names: "" },
];

const initialGameScores: GameScore[] = [
  { id: 1, name: "Jonas", score: 18, createdAt: "2026-04-14 18:10" },
  { id: 2, name: "AustÄ—ja", score: 14, createdAt: "2026-04-14 18:22" },
  { id: 3, name: "Lukas", score: 9, createdAt: "2026-04-14 18:35" },
];

const initialReservations: Reservation[] = [
  {
    id: 1,
    city: "Klaipėda",
    contactPhone: "+37060000001",
    contactEmail: "jonas@example.com",
    qrCode: "CIRKAS-0001",
    paid: true,
    paymentMethod: "bank",
    preferredPaymentMethod: "bank",
    createdAt: "2026-04-14 10:20",
    discountPercent: 0,
    people: [
      { id: "1-1", firstName: "Jonas", lastName: "Petraitis", type: "adult", active: true, arrived: false, arrivedAt: null },
      { id: "1-2", firstName: "Austėja", lastName: "Petraitė", type: "adult", active: true, arrived: false, arrivedAt: null },
      { id: "1-3", firstName: "Lukas", lastName: "Petraitis", type: "child", active: true, arrived: false, arrivedAt: null },
    ],
  },
];

function createEmptyPerson(): PersonForm {
  return {
    formId: `person-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    firstName: "",
    lastName: "",
    type: "adult",
  };
}

function activePeople(reservation: Reservation) {
  return reservation.people.filter((person) => person.active !== false);
}

function counts(reservation: Reservation) {
  const active = activePeople(reservation);
  return {
    total: active.length,
    adults: active.filter((person) => person.type === "adult").length,
    children: active.filter((person) => person.type === "child").length,
    arrived: active.filter((person) => person.arrived).length,
  };
}

function amount(reservation: Reservation) {
  const base = counts(reservation).adults * ADULT_PRICE;
  const discountPercent = reservation.discountPercent || 0;
  return Math.max(0, base - (base * discountPercent) / 100);
}

function cashAmount(reservation: Reservation) {
  return amount(reservation) + counts(reservation).total;
}

function qrFromId(id: number) {
  return `CIRKAS-${String(id).slice(-4).padStart(4, "0")}`;
}

function qrPayload(reservation: Reservation) {
  return JSON.stringify({
    qrCode: reservation.qrCode,
    paid: reservation.paid,
    paymentMethod: reservation.paymentMethod,
    contact: reservation.contactEmail,
    total: counts(reservation).total,
    people: activePeople(reservation).map((person) => `${person.firstName} ${person.lastName}`.trim()),
  });
}

function getCountdownParts(targetIso: string) {
  const diff = new Date(targetIso).getTime() - Date.now();
  if (diff <= 0) {
    return { expired: true, days: 0, hours: 0, minutes: 0 };
  }

  const totalMinutes = Math.floor(diff / 60000);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;
  return { expired: false, days, hours, minutes };
}

function lookupReservation(reservations: Reservation[], value: string) {
  const query = value.trim().toLowerCase();
  if (!query) return null;

  if (query.startsWith("{")) {
    try {
      const parsed = JSON.parse(query);
      if (parsed?.qrCode) {
        return reservations.find((reservation) => reservation.qrCode.toLowerCase() === String(parsed.qrCode).toLowerCase()) ?? null;
      }
    } catch {
      return null;
    }
  }

  return (
    reservations.find((reservation) => {
      const contactMatch =
        reservation.contactEmail.toLowerCase().includes(query) ||
        reservation.contactPhone.toLowerCase().includes(query) ||
        reservation.qrCode.toLowerCase().includes(query);
      const peopleMatch = reservation.people.some((person) => {
        const fullName = `${person.firstName} ${person.lastName}`.trim().toLowerCase();
        return person.firstName.toLowerCase().includes(query) || person.lastName.toLowerCase().includes(query) || fullName.includes(query);
      });
      return contactMatch || peopleMatch;
    }) ?? null
  );
}

function formatDateTime(date = new Date()) {
  return new Intl.DateTimeFormat("lt-LT", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function reservationTimestamp(reservation: Reservation) {
  const value = Date.parse(reservation.createdAt);
  return Number.isNaN(value) ? reservation.id : value;
}

function downloadFile(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function maskName(firstName: string, lastName: string) {
  const initial = lastName.trim()[0]?.toUpperCase() ?? "";
  return initial ? `${firstName} ${initial}.` : firstName;
}

function Modal({
  open,
  title,
  description,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
}) {
  if (!open) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h2>{title}</h2>
            {description ? <p>{description}</p> : null}
          </div>
          <button className="ghost-button" type="button" onClick={onClose}>
            Uždaryti
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function StatCard({ label, value, tone = "default" }: { label: string; value: string; tone?: "default" | "accent" | "success" | "warning" }) {
  return (
    <div className={`stat-card stat-${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function SectionCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="card">
      <div className="card-head">
        <div>
          <h3>{title}</h3>
          {description ? <p>{description}</p> : null}
        </div>
      </div>
      {children}
    </section>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}

function CircusLights() {
  const colors = ["red", "amber", "orange", "green", "pink"];

  return (
    <div className="circus-lights" aria-hidden="true">
      {Array.from({ length: 18 }).map((_, index) => (
        <span className={`light-dot ${colors[index % colors.length]}`} key={index} />
      ))}
    </div>
  );
}

function MapPinIcon() {
  return (
    <svg aria-hidden="true" className="button-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M12 21s6-5.686 6-11a6 6 0 1 0-12 0c0 5.314 6 11 6 11Z" />
      <circle cx="12" cy="10" r="2.5" />
    </svg>
  );
}

function WazeIcon() {
  return (
    <svg aria-hidden="true" className="button-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M18.5 13.5a6.5 6.5 0 1 0-12.6 2.3L4.5 19h3l1.2 1.7 1.8-1.7h3.5a6.5 6.5 0 0 0 4.5-5.5Z" />
      <path d="M9 10.5h.01M15 10.5h.01" />
      <path d="M9.5 14c1.1 1 3.9 1 5 0" />
    </svg>
  );
}

function QrIcon() {
  return (
    <svg aria-hidden="true" className="button-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4z" />
      <path d="M14 14h2v2h-2zM18 14h2v6h-6v-2h4zM16 16v2" />
    </svg>
  );
}

function CameraIcon() {
  return (
    <svg aria-hidden="true" className="button-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M4 8h3l1.5-2h7L17 8h3v10H4z" />
      <circle cx="12" cy="13" r="3.5" />
    </svg>
  );
}

function PaymentBadge({ method }: { method: PaymentMethod }) {
  if (method === "bank") {
    return <span className="payment-method-badge bank">B</span>;
  }

  if (method === "cash") {
    return <span className="payment-method-badge cash">G</span>;
  }

  return <span className="payment-method-badge pending">?</span>;
}

function TelegramIcon() {
  return (
    <svg aria-hidden="true" className="button-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M21 4 3.8 10.6c-.8.3-.8 1.5 0 1.8l4.1 1.4 1.5 4.7c.2.8 1.2 1 1.8.4L13.8 16l4.3 3.2c.7.5 1.7.1 1.9-.8L23 5.8C23.2 4.7 22 3.9 21 4Z" />
      <path d="m7.9 13.8 10-7.3" />
    </svg>
  );
}

function ClownJumpGame({
  scores,
  onSaveScore,
}: {
  scores: GameScore[];
  onSaveScore: (name: string, score: number) => void;
}) {
  const animationFrameRef = useRef<number | null>(null);
  const jumpTimeoutRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number | null>(null);
  const spawnTimerRef = useRef(0);
  const nextObstacleIdRef = useRef(1);
  const [playerName, setPlayerName] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [isGameOver, setIsGameOver] = useState(false);
  const [isJumping, setIsJumping] = useState(false);
  const [score, setScore] = useState(0);
  const [savedForScore, setSavedForScore] = useState<number | null>(null);
  const [distance, setDistance] = useState(0);
  const [obstacles, setObstacles] = useState<Array<{ id: number; x: number; label: string; passed: boolean; lane: "low" | "high"; size: "small" | "medium" | "large"; variant: "cone" | "box" | "ball" | "banner" | "barrels"; points: number }>>([]);

  const topScores = useMemo(() => [...scores].sort((a, b) => b.score - a.score).slice(0, 10), [scores]);
  const level = useMemo(() => Math.min(5, 1 + Math.floor(score / 8)), [score]);
  const speed = 0.15 + (level - 1) * 0.025;
  const bestScore = topScores[0]?.score ?? 0;

  function stopLoop() {
    if (animationFrameRef.current !== null) {
      window.cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
  }

  function resetRound() {
    stopLoop();
    lastTimeRef.current = null;
    spawnTimerRef.current = 0;
    nextObstacleIdRef.current = 1;
    setScore(0);
    setDistance(0);
    setObstacles([]);
    setIsJumping(false);
    setIsGameOver(false);
    setSavedForScore(null);
  }

  function startGame() {
    resetRound();
    setIsRunning(true);
  }

  function jump() {
    if (!isRunning || isJumping) return;
    setIsJumping(true);
    if (jumpTimeoutRef.current !== null) {
      window.clearTimeout(jumpTimeoutRef.current);
    }
    jumpTimeoutRef.current = window.setTimeout(() => setIsJumping(false), 620);
  }

  function saveScore() {
    const trimmed = playerName.trim();
    if (!trimmed || score <= 0 || savedForScore === score) return;
    onSaveScore(trimmed, score);
    setSavedForScore(score);
  }

  useEffect(() => {
    if (!isRunning) {
      stopLoop();
      return;
    }

    const obstacleTemplates = [
      { label: "Kūgis", lane: "low" as const, size: "small" as const, variant: "cone" as const, points: 1 },
      { label: "Kamuolys", lane: "low" as const, size: "medium" as const, variant: "ball" as const, points: 1 },
      { label: "Dėžė", lane: "low" as const, size: "large" as const, variant: "box" as const, points: 2 },
      { label: "Juosta", lane: "high" as const, size: "medium" as const, variant: "banner" as const, points: 2 },
      { label: "Statinės", lane: "low" as const, size: "large" as const, variant: "barrels" as const, points: 3 },
    ];

    function tick(timestamp: number) {
      if (lastTimeRef.current === null) {
        lastTimeRef.current = timestamp;
      }

      const delta = Math.min(32, timestamp - lastTimeRef.current);
      lastTimeRef.current = timestamp;
      spawnTimerRef.current += delta;
      setDistance((previous) => previous + delta * speed * 0.12);

      setObstacles((previous) => {
        let next = previous
          .map((obstacle) => ({ ...obstacle, x: obstacle.x - delta * speed }))
          .filter((obstacle) => obstacle.x > -18);

        const spawnDelay = Math.max(580, 1320 - level * 130 + Math.random() * 220);
        if (spawnTimerRef.current >= spawnDelay) {
          const available = obstacleTemplates.slice(0, Math.min(obstacleTemplates.length, level + 1));
          const template = available[Math.floor(Math.random() * available.length)];
          const additions = [
            {
              id: nextObstacleIdRef.current++,
              x: 100,
              label: template.label,
              passed: false,
              lane: template.lane,
              size: template.size,
              variant: template.variant,
              points: template.points,
            },
          ];

          if (level >= 3 && Math.random() > 0.72) {
            additions.push({
              id: nextObstacleIdRef.current++,
              x: 116,
              label: "Kliūtis+",
              passed: false,
              lane: Math.random() > 0.5 ? "high" : "low",
              size: Math.random() > 0.5 ? "small" : "medium",
              variant: Math.random() > 0.5 ? "cone" : "ball",
              points: 2,
            });
          }

          next = [...next, ...additions];
          spawnTimerRef.current = 0;
        }

        let collision = false;
        let gained = 0;

        next = next.map((obstacle) => {
          if (!obstacle.passed && obstacle.x <= 20) {
            const needsJump = obstacle.lane === "low";
            const needsStay = obstacle.lane === "high";
            const survived = (needsJump && isJumping) || (needsStay && !isJumping);

            if (survived) {
              gained += obstacle.points;
              return { ...obstacle, passed: true };
            }

            if (obstacle.x <= 12) {
              collision = true;
            }
          }

          return obstacle;
        });

        if (gained) {
          setScore((previousScore) => previousScore + gained);
        }

        if (collision) {
          setIsRunning(false);
          setIsGameOver(true);
        }

        return next;
      });

      animationFrameRef.current = window.requestAnimationFrame(tick);
    }

    animationFrameRef.current = window.requestAnimationFrame(tick);

    return () => stopLoop();
  }, [isJumping, isRunning]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.code !== "Space") return;
      event.preventDefault();

      if (isRunning) {
        jump();
      } else {
        startGame();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isRunning, isJumping]);

  useEffect(() => {
    return () => {
      stopLoop();
      if (jumpTimeoutRef.current !== null) {
        window.clearTimeout(jumpTimeoutRef.current);
      }
    };
  }, []);

  return (
    <SectionCard title="Klouno Å¡uolis" description="Mini Å¾aidimukas apaÄ¨ioje: kompiuteryje Å¡ok su Space, telefone spausk mygtukÄ… ir rink taÅ¡kus.">
      <div className="game-shell">
        <div className="game-stage-card">
          <div className="game-stage-head">
            <div>
              <strong>TaÅ¡kai: {score}</strong>
              <p>{isGameOver ? "Atsitrenkei Ä¯ kliÅ«tÄ¯. Gali bandyti dar kartÄ…" : isRunning ? "Klounas bÄ—ga. Venk Å¾emÅ³ kliÅ«ÄiÅ³ Å¡okdamas, o pro aukÅ¡tas pralÄ—k apaÄioje." : "Paspausk PradÄ—ti arba Space."}</p>
            </div>
            <div className="game-chip">Top: {bestScore}</div>
          </div>

          <div className="game-stage" role="img" aria-label="Klouno Å¡uolio mini Å¾aidimas">
            <div className="game-level-badge">Lygis {level}</div>
            <div className="game-distance-badge">{Math.floor(distance)} m</div>
            <div className={isJumping ? "clown-runner jumping" : "clown-runner"}>
              <span className="clown-face">🤡</span>
            </div>
            {obstacles.map((obstacle) => (
              <div
                className={`game-obstacle ${obstacle.lane} ${obstacle.size} ${obstacle.variant}`}
                key={obstacle.id}
                style={{ left: `${obstacle.x}%` }}
              >
                <span>{obstacle.label}</span>
              </div>
            ))}
          </div>

          <div className="game-controls">
            <button className="primary-button" type="button" onClick={isRunning ? jump : startGame}>
              {isRunning ? "Å okti" : "PradÄ—ti Å¾aidimÄ…"}
            </button>
            <button className="ghost-button" type="button" onClick={startGame}>
              Å½aisti iÅ¡ naujo
            </button>
          </div>
        </div>

        <div className="game-side">
          <div className="payment-note">
            <strong>Kaip Å¾aisti</strong>
            <p>Kompiuteryje naudok `Space`, o telefone spausk mygtukÄ… „Å okti“. Å½emos kliÅ«tys reikalauja Å¡uolio, o aukÅ¡tos juostos reikalauja likti apaÄioje. Kuo toliau, tuo greiÄiau ir chaotiÅ¡kiau.</p>
          </div>

          <div className="payment-note">
            <strong>Sunkumo progresas</strong>
            <p>Didesniame lygyje daugÄ—ja kliÅ«ÄiÅ³ tipÅ³, jos artÄ—ja greiÄiau, o kartais pasirodo net dvi iÅ¡ karto. UÅ¾ sunkesnes kliÅ«tis gauni daugiau taÅ¡kÅ³.</p>
          </div>

          <div className="payment-note">
            <strong>IÅ¡saugoti rezultatÄ…</strong>
            <div className="stack">
              <input value={playerName} onChange={(event) => setPlayerName(event.target.value)} placeholder="Tavo vardas rezultatui" />
              <button className="secondary-button" disabled={!playerName.trim() || score <= 0 || savedForScore === score} type="button" onClick={saveScore}>
                {savedForScore === score ? "Rezultatas iÅ¡saugotas" : "IÅ¡saugoti taÅ¡kus"}
              </button>
            </div>
          </div>

          <div className="leaderboard-card">
            <div className="vote-result-head">
              <strong>KlounÅ³ rekordai</strong>
              <span>{topScores.length} Ä¯raÅ¡.</span>
            </div>
            <div className="stack">
              {topScores.length === 0 ? (
                <div className="empty-state">Kol kas dar nÄ—ra nei vieno rezultato.</div>
              ) : (
                topScores.map((entry, index) => (
                  <div className="leaderboard-row" key={entry.id}>
                    <span>#{index + 1}</span>
                    <strong>{entry.name}</strong>
                    <span>{entry.score} tÅ¡k.</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </SectionCard>
  );
}

export default function Page() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const scannerStreamRef = useRef<MediaStream | null>(null);
  const scannerFrameRef = useRef<number | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [reservations, setReservations] = useState<Reservation[]>(initialReservations);
  const [waitingList, setWaitingList] = useState<WaitingItem[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [transfers, setTransfers] = useState<TransferItem[]>([]);
  const [votes, setVotes] = useState<VoteRecord[]>([]);
  const [songSuggestions, setSongSuggestions] = useState<SongSuggestion[]>(initialSongSuggestions);
  const [eventIdeas, setEventIdeas] = useState<EventIdea[]>(initialEventIdeas);
  const [responsiblePeople, setResponsiblePeople] = useState<ResponsiblePerson[]>(initialResponsiblePeople);
  const [gameScores, setGameScores] = useState<GameScore[]>(initialGameScores);

  const [registerOpen, setRegisterOpen] = useState(false);
  const [myTicketOpen, setMyTicketOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [voteOpen, setVoteOpen] = useState(false);
  const [privacyOpen, setPrivacyOpen] = useState(false);

  const [adminUnlocked, setAdminUnlocked] = useState(false);
  const [adminPin, setAdminPin] = useState("");
  const [submitted, setSubmitted] = useState<Reservation | null>(null);
  const [lookup, setLookup] = useState("");
  const [cancelLookup, setCancelLookup] = useState("");
  const [transferLookup, setTransferLookup] = useState("");
  const [myLookup, setMyLookup] = useState("");
  const [scannerValue, setScannerValue] = useState("");
  const [doorNotice, setDoorNotice] = useState<Notice | null>(null);
  const [songForm, setSongForm] = useState({ title: "", url: "" });
  const [ideaForm, setIdeaForm] = useState("");
  const [activePanel, setActivePanel] = useState<PublicPanel>("guests");
  const [pendingCancel, setPendingCancel] = useState<PendingCancel>(null);
  const [registerStep, setRegisterStep] = useState<"details" | "payment">("details");
  const [privacyTouched, setPrivacyTouched] = useState(false);
  const [registerPaymentChoice, setRegisterPaymentChoice] = useState<PaymentMethod>(null);
  const [selectedTransferPersonId, setSelectedTransferPersonId] = useState("");
  const [transferForm, setTransferForm] = useState({ replacementName: "", replacementPhone: "" });
  const [countdown, setCountdown] = useState(() => getCountdownParts(EVENT_START_ISO));
  const [scannerActive, setScannerActive] = useState(false);
  const [scannerSupported, setScannerSupported] = useState(true);
  const [scannerMessage, setScannerMessage] = useState("");
  const [wheelRotation, setWheelRotation] = useState(0);
  const [wheelResult, setWheelResult] = useState("");
  const [wheelSpinning, setWheelSpinning] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [celebratingRegistration, setCelebratingRegistration] = useState(false);
  const [highlightGuestKey, setHighlightGuestKey] = useState("");
  const [voteVoterLookup, setVoteVoterLookup] = useState("");
  const [selectedVoterId, setSelectedVoterId] = useState("");
  const [selectedVoteCategory, setSelectedVoteCategory] = useState("");
  const [voteTargetLookup, setVoteTargetLookup] = useState("");
  const [voteStep, setVoteStep] = useState<1 | 2 | 3>(1);
  const [form, setForm] = useState({
    city: "",
    contactPhone: "",
    contactEmail: "",
    discountCode: "",
    consentAccepted: false,
    people: [createEmptyPerson()],
  });

  useEffect(() => {
    let ignore = false;

    async function loadState() {
      try {
        const response = await fetch("/api/state", { cache: "no-store" });
        if (!response.ok) {
          throw new Error("Failed to load remote state");
        }

        const data = (await response.json()) as {
          payload?: {
            reservations?: Reservation[];
            waitingList?: WaitingItem[];
            notifications?: NotificationItem[];
            transfers?: TransferItem[];
            votes?: VoteRecord[];
            songSuggestions?: SongSuggestion[];
            eventIdeas?: EventIdea[];
            responsiblePeople?: ResponsiblePerson[];
            gameScores?: GameScore[];
          } | null;
        };

        if (ignore || !data.payload) {
          setHydrated(true);
          return;
        }

        const parsed = data.payload;
        if (parsed.reservations?.length) {
          setReservations(
            parsed.reservations.map((reservation) => ({
              ...reservation,
              preferredPaymentMethod: reservation.preferredPaymentMethod ?? reservation.paymentMethod ?? null,
            })),
          );
        }
        if (parsed.waitingList) setWaitingList(parsed.waitingList);
        if (parsed.notifications) setNotifications(parsed.notifications);
        if (parsed.transfers) setTransfers(parsed.transfers);
        if (parsed.votes) setVotes(parsed.votes);
        if (parsed.songSuggestions?.length) setSongSuggestions(parsed.songSuggestions);
        if (parsed.eventIdeas?.length) setEventIdeas(parsed.eventIdeas);
        if (parsed.responsiblePeople?.length) setResponsiblePeople(parsed.responsiblePeople);
        if (parsed.gameScores) setGameScores(parsed.gameScores);
      } catch (error) {
        console.error("Failed to load remote state", error);
      } finally {
        if (!ignore) setHydrated(true);
      }
    }

    void loadState();

    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const controller = new AbortController();

    void fetch("/api/state", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        payload: {
          reservations,
          waitingList,
          notifications,
          transfers,
          votes,
          songSuggestions,
          eventIdeas,
          responsiblePeople,
          gameScores,
        },
      }),
      signal: controller.signal,
    }).catch((error) => {
      if (error.name !== "AbortError") {
        console.error("Failed to save remote state", error);
      }
    });

    return () => controller.abort();
  }, [eventIdeas, gameScores, hydrated, notifications, reservations, responsiblePeople, songSuggestions, transfers, votes, waitingList]);

  useEffect(() => {
    if (!doorNotice) return;
    const timer = window.setTimeout(() => setDoorNotice(null), 2500);
    return () => window.clearTimeout(timer);
  }, [doorNotice]);

  useEffect(() => {
    const interval = window.setInterval(() => setCountdown(getCountdownParts(EVENT_START_ISO)), 60000);
    setCountdown(getCountdownParts(EVENT_START_ISO));
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    return () => {
      stopScanner();
    };
  }, []);

  useEffect(() => {
    if (!doorNotice) return;

    try {
      const audioContext = new window.AudioContext();
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();

      oscillator.type = doorNotice.type === "success" ? "sine" : "square";
      oscillator.frequency.value = doorNotice.type === "success" ? 880 : 220;
      gain.gain.value = 0.03;

      oscillator.connect(gain);
      gain.connect(audioContext.destination);
      oscillator.start();
      oscillator.stop(audioContext.currentTime + 0.12);

      oscillator.onended = () => {
        void audioContext.close();
      };
    } catch {
      // Audio feedback is best-effort only.
    }
  }, [doorNotice]);

  const activeReservations = useMemo(() => reservations.filter((reservation) => activePeople(reservation).length > 0), [reservations]);
  const visibleGuestReservations = useMemo(() => activeReservations.filter((reservation) => reservation.paid), [activeReservations]);
  const paidReservations = useMemo(() => activeReservations.filter((reservation) => reservation.paid), [activeReservations]);
  const occupied = useMemo(() => activeReservations.reduce((sum, reservation) => sum + counts(reservation).total, 0), [activeReservations]);
  const remaining = Math.max(0, MAX_PLACES - occupied);
  const totalPaidSeats = useMemo(() => paidReservations.reduce((sum, reservation) => sum + counts(reservation).total, 0), [paidReservations]);
  const totalArrived = useMemo(() => activeReservations.reduce((sum, reservation) => sum + counts(reservation).arrived, 0), [activeReservations]);
  const totalAdults = useMemo(() => activeReservations.reduce((sum, reservation) => sum + counts(reservation).adults, 0), [activeReservations]);
  const totalChildren = useMemo(() => activeReservations.reduce((sum, reservation) => sum + counts(reservation).children, 0), [activeReservations]);
  const totalBankChosen = useMemo(
    () => activeReservations.reduce((sum, reservation) => sum + (reservation.preferredPaymentMethod === "bank" ? counts(reservation).total : 0), 0),
    [activeReservations],
  );
  const totalCashChosen = useMemo(
    () => activeReservations.reduce((sum, reservation) => sum + (reservation.preferredPaymentMethod === "cash" ? counts(reservation).total : 0), 0),
    [activeReservations],
  );
  const formDiscountActive = useMemo(() => form.discountCode.trim().toLowerCase() === VOLUNTEER_DISCOUNT_CODE, [form.discountCode]);
  const formBaseTotal = useMemo(() => form.people.filter((person) => person.type === "adult").length * ADULT_PRICE, [form.people]);
  const formTotal = useMemo(
    () => (formDiscountActive ? Math.max(0, formBaseTotal - (formBaseTotal * VOLUNTEER_DISCOUNT_PERCENT) / 100) : formBaseTotal),
    [formBaseTotal, formDiscountActive],
  );
  const formCashTotal = useMemo(() => formTotal + form.people.length, [form.people.length, formTotal]);
  const myReservation = useMemo(() => lookupReservation(activeReservations, myLookup), [activeReservations, myLookup]);
  const cancelReservation = useMemo(() => lookupReservation(activeReservations, cancelLookup), [activeReservations, cancelLookup]);
  const transferReservation = useMemo(() => lookupReservation(activeReservations, transferLookup), [activeReservations, transferLookup]);
  const foundReservation = useMemo(() => lookupReservation(activeReservations, lookup || scannerValue), [activeReservations, lookup, scannerValue]);
  const pendingReservations = useMemo(
    () =>
      activeReservations
        .filter((reservation) => !reservation.paid)
        .sort((a, b) => reservationTimestamp(b) - reservationTimestamp(a)),
    [activeReservations],
  );
  const approvedReservations = useMemo(
    () =>
      activeReservations
        .filter((reservation) => reservation.paid)
        .sort((a, b) => reservationTimestamp(b) - reservationTimestamp(a)),
    [activeReservations],
  );
  const voteEligiblePeople = useMemo(
    () =>
      visibleGuestReservations.flatMap((reservation) =>
        activePeople(reservation).map((person) => ({
          id: person.id,
          name: `${person.firstName} ${person.lastName}`.trim(),
          city: reservation.city,
        })),
      ),
    [visibleGuestReservations],
  );
  const voterMatches = useMemo(() => {
    const q = voteVoterLookup.trim().toLowerCase();
    if (!q) return [];
    return voteEligiblePeople.filter((person) => person.name.toLowerCase().includes(q)).slice(0, 12);
  }, [voteEligiblePeople, voteVoterLookup]);
  const targetMatches = useMemo(() => {
    const q = voteTargetLookup.trim().toLowerCase();
    if (!q) return [];
    return voteEligiblePeople.filter((person) => person.name.toLowerCase().includes(q)).slice(0, 12);
  }, [voteEligiblePeople, voteTargetLookup]);
  const selectedVoter = useMemo(() => voteEligiblePeople.find((person) => person.id === selectedVoterId) ?? null, [voteEligiblePeople, selectedVoterId]);
  const selectedCategoryVote = useMemo(
    () => votes.find((vote) => vote.voterPersonId === selectedVoterId && vote.categoryId === selectedVoteCategory) ?? null,
    [selectedVoterId, selectedVoteCategory, votes],
  );
  const votingResults = useMemo(() => {
    return VOTING_CATEGORIES.map((category) => {
      const categoryVotes = votes.filter((vote) => vote.categoryId === category.id);
      const countsMap = new Map<string, number>();
      categoryVotes.forEach((vote) => {
        countsMap.set(vote.targetPersonId, (countsMap.get(vote.targetPersonId) ?? 0) + 1);
      });
      const sorted = [...countsMap.entries()]
        .map(([personId, count]) => ({
          personId,
          count,
          name: voteEligiblePeople.find((person) => person.id === personId)?.name ?? "Nežinomas svečias",
        }))
        .sort((a, b) => b.count - a.count);
      return {
        category,
        totalVotes: categoryVotes.length,
        leaders: sorted.slice(0, 3),
      };
    });
  }, [voteEligiblePeople, votes]);

  function setField<K extends keyof typeof form>(field: K, value: (typeof form)[K]) {
    setForm((previous) => ({ ...previous, [field]: value }));
  }

  function setPerson<K extends keyof PersonForm>(index: number, field: K, value: PersonForm[K]) {
    setForm((previous) => {
      const people = [...previous.people];
      people[index] = { ...people[index], [field]: value };
      return { ...previous, people };
    });
  }

  function addPerson() {
    setForm((previous) => ({ ...previous, people: [...previous.people, createEmptyPerson()] }));
  }

  function removePerson(index: number) {
    setForm((previous) => ({ ...previous, people: previous.people.filter((_, personIndex) => personIndex !== index) }));
  }

  function addSongSuggestion() {
    const title = songForm.title.trim();
    const url = songForm.url.trim();
    if (!url) return;

    const lowerUrl = url.toLowerCase();
    let source = "Kita";
    if (lowerUrl.includes("spotify")) source = "Spotify";
    if (lowerUrl.includes("youtube") || lowerUrl.includes("youtu.be")) source = "YouTube";

    setSongSuggestions((previous) => [{ id: Date.now(), title, url, source }, ...previous]);
    setSongForm({ title: "", url: "" });
  }

  function addEventIdea() {
    const text = ideaForm.trim();
    if (!text) return;
    setEventIdeas((previous) => [{ id: Date.now(), text }, ...previous]);
    setIdeaForm("");
  }

  function updateResponsiblePerson(id: number, field: keyof ResponsiblePerson, value: string) {
    setResponsiblePeople((previous) => previous.map((item) => (item.id === id ? { ...item, [field]: value } : item)));
  }

  function submitReservation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.consentAccepted) {
      setPrivacyTouched(true);
      return;
    }
    setRegisterStep("payment");
  }

  function finalizeReservation() {
    if (!form.consentAccepted) return;
    const stamp = Date.now();
    const people = form.people
      .filter((person) => person.firstName.trim())
      .map((person, index) => ({
        id: `${stamp}-${index + 1}`,
        firstName: person.firstName.trim(),
        lastName: person.lastName.trim(),
        type: person.type,
        active: true,
        arrived: false,
        arrivedAt: null,
      }));

    if (!people.length) return;

    if (occupied + people.length > MAX_PLACES) {
      setWaitingList((previous) => [
        {
          id: stamp,
          city: form.city.trim(),
          contactPhone: form.contactPhone.trim(),
          contactEmail: form.contactEmail.trim(),
          people,
          createdAt: formatDateTime(),
        },
        ...previous,
      ]);
      setRegisterOpen(false);
      setRegisterStep("details");
      setPrivacyTouched(false);
      setRegisterPaymentChoice(null);
      setForm({ city: "", contactPhone: "", contactEmail: "", discountCode: "", consentAccepted: false, people: [createEmptyPerson()] });
      setSubmitted(null);
      return;
    }

    const reservation: Reservation = {
      id: stamp,
      city: form.city.trim(),
      contactPhone: form.contactPhone.trim(),
      contactEmail: form.contactEmail.trim(),
      qrCode: qrFromId(stamp),
      paid: false,
      paymentMethod: null,
      preferredPaymentMethod: registerPaymentChoice,
      createdAt: formatDateTime(),
      discountPercent: formDiscountActive ? VOLUNTEER_DISCOUNT_PERCENT : 0,
      people,
    };

    setReservations((previous) => [reservation, ...previous]);
    setNotifications((previous) => [
      { id: Date.now(), message: `Gauta nauja rezervacija: ${reservation.contactEmail}.`, createdAt: formatDateTime() },
      ...previous,
    ]);
    setSubmitted(reservation);
    setCelebratingRegistration(true);
    window.setTimeout(() => setCelebratingRegistration(false), 2200);
    setForm({ city: "", contactPhone: "", contactEmail: "", discountCode: "", consentAccepted: false, people: [createEmptyPerson()] });
    setRegisterOpen(false);
    setRegisterStep("details");
    setPrivacyTouched(false);
    setRegisterPaymentChoice(null);
  }

  function cancelPerson(reservationId: number, personId: string) {
    const reservation = reservations.find((item) => item.id === reservationId);
    const person = reservation?.people.find((item) => item.id === personId);

    setReservations((previous) =>
      previous.map((item) =>
        item.id === reservationId
          ? { ...item, people: item.people.map((reservationPerson) => (reservationPerson.id === personId ? { ...reservationPerson, active: false } : reservationPerson)) }
          : item,
      ),
    );

    if (reservation && person) {
      setNotifications((previous) => [
        { id: Date.now(), message: `${person.firstName} ${person.lastName} atšaukė dalyvavimą.`, createdAt: formatDateTime() },
        ...previous,
      ]);
    }
  }

  function requestCancel(reservationId: number, personId: string, name: string) {
    setPendingCancel({ reservationId, personId, name });
  }

  function confirmCancel() {
    if (!pendingCancel) return;
    cancelPerson(pendingCancel.reservationId, pendingCancel.personId);
    setPendingCancel(null);
  }

  function submitTransfer() {
    if (!transferReservation || !selectedTransferPersonId) return;

    const replacementName = transferForm.replacementName.trim();
    const replacementPhone = transferForm.replacementPhone.trim();
    if (!replacementName || !replacementPhone) return;

    const originalPerson = transferReservation.people.find((person) => person.id === selectedTransferPersonId);
    if (!originalPerson) return;

    const now = formatDateTime();
    const originalName = `${originalPerson.firstName} ${originalPerson.lastName}`.trim();

    setReservations((previous) =>
      previous.map((reservation) =>
        reservation.id === transferReservation.id
          ? {
              ...reservation,
              people: reservation.people.map((person) =>
                person.id === selectedTransferPersonId
                  ? {
                      ...person,
                      firstName: replacementName,
                      lastName: "",
                      arrived: false,
                      arrivedAt: null,
                    }
                  : person,
              ),
            }
          : reservation,
      ),
    );

    setTransfers((previous) => [
      {
        id: Date.now(),
        reservationId: transferReservation.id,
        originalName,
        replacementName,
        replacementPhone,
        createdAt: now,
      },
      ...previous,
    ]);

    setNotifications((previous) => [
      {
        id: Date.now(),
        message: `Gautas susikeitimas: ${originalName} pakeistas į ${replacementName}.`,
        createdAt: now,
      },
      ...previous,
    ]);

    setTransferLookup("");
    setSelectedTransferPersonId("");
    setTransferForm({ replacementName: "", replacementPhone: "" });
    setTransferOpen(false);
  }

  function markArrived(reservationId: number, personId: string) {
    const reservation = reservations.find((item) => item.id === reservationId);
    const person = reservation?.people.find((item) => item.id === personId);
    if (!reservation || !person) return;

    const now = new Intl.DateTimeFormat("lt-LT", { hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(new Date());

    setDoorNotice({
      type: person.arrived ? "warning" : "success",
      text: person.arrived
        ? `${person.firstName} ${person.lastName} jau buvo pažymėtas kaip atvykęs.`
        : `${person.firstName} ${person.lastName} pažymėtas kaip atvykęs.`,
    });

    setReservations((previous) =>
      previous.map((item) =>
        item.id === reservationId
          ? {
              ...item,
              people: item.people.map((reservationPerson) =>
                reservationPerson.id === personId
                  ? { ...reservationPerson, arrived: !reservationPerson.arrived, arrivedAt: !reservationPerson.arrived ? now : null }
                  : reservationPerson,
              ),
            }
          : item,
      ),
    );
  }

  function markAllArrived(reservationId: number) {
    const now = new Intl.DateTimeFormat("lt-LT", { hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(new Date());
    setReservations((previous) =>
      previous.map((item) =>
        item.id === reservationId
          ? { ...item, people: item.people.map((person) => (person.active ? { ...person, arrived: true, arrivedAt: now } : person)) }
          : item,
      ),
    );
    setDoorNotice({ type: "success", text: "Visa grupė pažymėta kaip atvykusi." });
  }

  function setPaymentMethod(reservationId: number, paymentMethod: Exclude<PaymentMethod, null>) {
    const reservation = reservations.find((item) => item.id === reservationId);
    const firstPerson = reservation ? activePeople(reservation)[0] : null;
    if (reservation && firstPerson) {
      setHighlightGuestKey(`${reservation.city}-${maskName(firstPerson.firstName, firstPerson.lastName)}`);
      window.setTimeout(() => setHighlightGuestKey(""), 2600);
    }

    setReservations((previous) => previous.map((item) => (item.id === reservationId ? { ...item, paid: true, paymentMethod } : item)));
    setNotifications((previous) => [
      { id: Date.now(), message: `Pažymėtas apmokėjimas rezervacijai #${reservationId}.`, createdAt: formatDateTime() },
      ...previous,
    ]);
  }

  function exportReservations() {
    const rows = [
      ["ID", "QR", "Miestas", "Telefonas", "El. paštas", "Apmokėta", "Mokėjimo būdas", "Asmenų kiekis", "Atvyko", "Suma", "Sukurta"].join(";"),
      ...activeReservations.map((reservation) =>
        [
          reservation.id,
          reservation.qrCode,
          reservation.city,
          reservation.contactPhone,
          reservation.contactEmail,
          reservation.paid ? "taip" : "ne",
          reservation.paymentMethod ?? "",
          counts(reservation).total,
          counts(reservation).arrived,
          amount(reservation),
          reservation.createdAt,
        ].join(";"),
      ),
    ];
    downloadFile("cirkas-rezervacijos.csv", rows.join("\n"), "text/csv;charset=utf-8");
  }

  function resetDemoData() {
    setReservations(initialReservations);
    setWaitingList([]);
    setNotifications([]);
    setTransfers([]);
    setVotes([]);
    setSongSuggestions(initialSongSuggestions);
    setEventIdeas(initialEventIdeas);
    setResponsiblePeople(initialResponsiblePeople);
    setGameScores(initialGameScores);
    setSubmitted(null);
    setLookup("");
    setMyLookup("");
    setCancelLookup("");
    setTransferLookup("");
    setScannerValue("");
  }

  function unlockAdmin() {
    if (adminPin === ADMIN_PIN) {
      setAdminUnlocked(true);
      setDoorNotice({ type: "success", text: "Admin zona atrakinta." });
    } else {
      setDoorNotice({ type: "warning", text: "Neteisingas PIN kodas." });
    }
  }

  function spinWheel() {
    if (wheelSpinning) return;

    const segmentSize = 360 / WHEEL_PRIZES.length;
    const selectedIndex = Math.floor(Math.random() * WHEEL_PRIZES.length);
    const extraTurns = 360 * (4 + Math.floor(Math.random() * 3));
    const targetRotation = wheelRotation + extraTurns + (360 - selectedIndex * segmentSize - segmentSize / 2);

    setWheelSpinning(true);
    setWheelRotation(targetRotation);

    window.setTimeout(() => {
      setWheelResult(WHEEL_PRIZES[selectedIndex]);
      setWheelSpinning(false);
      setShowConfetti(true);
      window.setTimeout(() => setShowConfetti(false), 2200);
    }, 4200);
  }

  function submitVote(targetPersonId: string) {
    if (!selectedVoterId || !selectedVoteCategory) return;
    if (votes.some((vote) => vote.voterPersonId === selectedVoterId && vote.categoryId === selectedVoteCategory)) return;

    const now = formatDateTime();
    setVotes((previous) => [
      {
        id: Date.now(),
        categoryId: selectedVoteCategory,
        voterPersonId: selectedVoterId,
        targetPersonId,
        createdAt: now,
      },
      ...previous,
    ]);
    setNotifications((previous) => [
      {
        id: Date.now(),
        message: `Gautas balsas kategorijoje „${VOTING_CATEGORIES.find((item) => item.id === selectedVoteCategory)?.label ?? ""}“.`,
        createdAt: now,
      },
      ...previous,
    ]);
    setVoteTargetLookup("");
    setVoteStep(2);
  }

  function saveGameScore(name: string, score: number) {
    const now = formatDateTime();
    setGameScores((previous) =>
      [...previous, { id: Date.now(), name, score, createdAt: now }]
        .sort((a, b) => b.score - a.score || Date.parse(b.createdAt) - Date.parse(a.createdAt))
        .slice(0, 30),
    );
    setNotifications((previous) => [
      { id: Date.now(), message: `${name} iÅ¡saugojo Å¾aidimo rezultatÄ…: ${score} tÅ¡k.`, createdAt: now },
      ...previous,
    ]);
  }

  function stopScanner() {
    if (scannerFrameRef.current) {
      window.cancelAnimationFrame(scannerFrameRef.current);
      scannerFrameRef.current = null;
    }

    if (scannerStreamRef.current) {
      scannerStreamRef.current.getTracks().forEach((track) => track.stop());
      scannerStreamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setScannerActive(false);
  }

  async function startScanner() {
    if (!("BarcodeDetector" in window) || !navigator.mediaDevices?.getUserMedia) {
      setScannerSupported(false);
      setScannerMessage("Šiame įrenginyje kameros QR skenavimas naršyklėje nepalaikomas.");
      return;
    }

    try {
      setScannerMessage("Kamera paleidžiama...");
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false,
      });

      scannerStreamRef.current = stream;
      setScannerActive(true);

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      const DetectorCtor = window.BarcodeDetector;
      if (!DetectorCtor) {
        setScannerSupported(false);
        setScannerMessage("Šiame įrenginyje kameros QR skenavimas naršyklėje nepalaikomas.");
        stopScanner();
        return;
      }
      const detector = new DetectorCtor({ formats: ["qr_code"] });

      const scan = async () => {
        if (!videoRef.current || !scannerStreamRef.current) return;

        try {
          const results = await detector.detect(videoRef.current);
          const rawValue = results[0]?.rawValue;

          if (rawValue) {
            setScannerValue(rawValue);
            setLookup("");
            setScannerMessage("QR kodas nuskaitytas.");
            stopScanner();
            return;
          }
        } catch {
          setScannerMessage("Nepavyko nuskaityti QR kodo. Bandyk dar kartą.");
        }

        scannerFrameRef.current = window.requestAnimationFrame(scan);
      };

      setScannerMessage("Nukreipk kamerą į QR kodą.");
      scannerFrameRef.current = window.requestAnimationFrame(scan);
    } catch {
      setScannerMessage("Nepavyko pasiekti kameros. Patikrink naršyklės leidimus.");
      stopScanner();
    }
  }

  const guestEntries = visibleGuestReservations.flatMap((reservation) =>
    activePeople(reservation).map((person) => ({
      city: reservation.city,
      name: maskName(person.firstName, person.lastName),
    })),
  );

  return (
      <main className="page-shell">
        <div className="page-glow page-glow-left" />
        <div className="page-glow page-glow-right" />
        {showConfetti || celebratingRegistration ? (
          <div className="confetti-layer" aria-hidden="true">
            {Array.from({ length: 50 }).map((_, index) => (
              <span
                className={`confetti-piece c${index % 6}`}
                key={index}
                style={{ left: `${(index * 13) % 100}%`, animationDelay: `${(index % 10) * 0.08}s` }}
              />
            ))}
          </div>
        ) : null}

        <section className="hero">
        <div className="hero-copy">
          <CircusLights />
          <div className="eyebrow">Klaipėdos vakarėlio registracija</div>
          <h1>{EVENT_NAME}</h1>
          <p>
            Pilnas vieno puslapio sprendimas su registracija, vietų kontrole, QR bilietais, atvykimo
            žymėjimu, atšaukimais, laukiančiųjų eile ir admin valdymu.
          </p>

          <div className="chip-grid">
            <div className="chip">
              <span>Data</span>
              <strong>{EVENT_DATE}</strong>
            </div>
            <div className="chip">
              <span>Vieta</span>
              <strong>{EVENT_PLACE}</strong>
            </div>
            <div className="chip">
              <span>Kaina</span>
              <strong>13+ m. – 10 €, vaikai – nemokamai</strong>
            </div>
          </div>

          <div className="countdown-card">
            <span>Atgalinis laikas iki renginio pradžios</span>
            {countdown.expired ? (
              <strong>Renginys jau prasidėjo</strong>
            ) : (
              <strong>
                {countdown.days} d. {countdown.hours} val. {countdown.minutes} min.
              </strong>
            )}
          </div>

          <div className="theme-reminder">
            <strong>Aprangos tema: CIRKAS</strong>
            <p>Rengtis galima kuo įdomiau, žaismingiau arba turėti bent vieną cirko tematikos akcentą.</p>
          </div>

          <div className="stats-grid">
            <StatCard label="Atvyko" value={`${totalArrived}/${occupied || 0}`} tone="success" />
            <StatCard label="Apmokėta vietų" value={`${totalPaidSeats}/${occupied || 0}`} tone="accent" />
            <StatCard label="Laisvų vietų" value={String(remaining)} tone="warning" />
          </div>

          <div className="hero-actions">
            <button className="primary-button" type="button" onClick={() => { setRegisterStep("details"); setRegisterOpen(true); }}>
              Noriu dalyvauti
            </button>
            <button className="secondary-button" type="button" onClick={() => setMyTicketOpen(true)}>
              Mano bilietas
            </button>
            <button className="ghost-button light" type="button" onClick={() => setTransferOpen(true)}>
              Susikeisti
            </button>
            <button className="ghost-button light" type="button" onClick={() => setCancelOpen(true)}>
              Atšaukti dalyvavimą
            </button>
          </div>

          <div className="telegram-cta">
            <a className="telegram-button" href={TELEGRAM_GROUP_URL} target="_blank" rel="noreferrer">
              <TelegramIcon />
              Prisijungti į vakarėlio Telegram grupę
            </a>
          </div>

          <div className="link-row">
            <a className="map-link" href={GOOGLE_MAPS_URL} target="_blank" rel="noreferrer">
              <MapPinIcon />
              Google Maps
            </a>
            <a className="map-link" href={WAZE_URL} target="_blank" rel="noreferrer">
              <WazeIcon />
              Waze
            </a>
            <button className="ghost-inline" type="button" onClick={() => setActivePanel("admin")}>
              Admin zona
            </button>
          </div>
        </div>

        <div className="hero-panel">
          <div className="spotlight-card">
            <h2>Kaip naudotis platforma</h2>
            <ul className="plain-list">
              <li>Užpildyk registraciją ir pridėk visus žmones, kuriuos registruoji.</li>
              <li>Patvirtink privatumo politiką ir pereik į apmokėjimo žingsnį.</li>
              <li>Pasirink, ar mokėsi bankiniu pavedimu per Revolut, ar grynaisiais.</li>
              <li>Atlik apmokėjimą ir palauk, kol organizatorius pažymės, kad mokėjimas gautas.</li>
              <li>Kai apmokėjimas bus patvirtintas, tavo vardas atsiras svečių lentoje.</li>
              <li>Per „Mano bilietas“ galėsi rasti savo QR kodą įėjimui.</li>
              <li>Jei pasikeistų planai, galėsi atšaukti dalyvavimą arba perduoti vietą kitam žmogui.</li>
            </ul>
            <div className="spotlight-subsection">
              <strong>Ką čia gali matyti ir daryti</strong>
              <ul className="plain-list compact">
                <li>Matyti renginio programą, svarbią informaciją ir atsakingus asmenis.</li>
                <li>Pasiūlyti dainas ir renginio idėjas.</li>
                <li>Prisijungti prie vakarėlio Telegram grupės.</li>
                <li>Patikrinti, ar tavo registracija jau patvirtinta svečių lentoje.</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {submitted ? (
        <SectionCard title="Rezervacija sukurta" description="Rezervacija užregistruota. Į svečių lentą ji pateks tik po to, kai admin zonoje apmokėjimas bus pažymėtas kaip gautas.">
          <div className="confirmation-grid">
            <div className="panel">
              <span className="muted-label">QR kodas</span>
              <strong>{submitted.qrCode}</strong>
              <p>Mokėtina suma: {amount(submitted)} €</p>
              {submitted.discountPercent ? <p>Taikyta savanorio nuolaida: -{submitted.discountPercent}%</p> : null}
            </div>
            <div className="panel">
              <span className="muted-label">Kontaktai</span>
              <p>{submitted.contactPhone}</p>
              <p>{submitted.contactEmail}</p>
            </div>
            <div className="panel qr-panel">
              <QRCodeSVG value={qrPayload(submitted)} size={170} includeMargin />
            </div>
          </div>
        </SectionCard>
      ) : null}

      <section className="panel-switcher">
        <button className={activePanel === "guests" ? "panel-tab active" : "panel-tab"} type="button" onClick={() => setActivePanel("guests")}>
          Svečių lenta
        </button>
        <button className={activePanel === "program" ? "panel-tab active" : "panel-tab"} type="button" onClick={() => setActivePanel("program")}>
          Programa
        </button>
        <button className={activePanel === "important" ? "panel-tab active" : "panel-tab"} type="button" onClick={() => setActivePanel("important")}>
          Svarbu
        </button>
        <button className={activePanel === "songs" ? "panel-tab active" : "panel-tab"} type="button" onClick={() => setActivePanel("songs")}>
          Dainų pasiūlymai ir idėjos
        </button>
        <button className={activePanel === "responsible" ? "panel-tab active" : "panel-tab"} type="button" onClick={() => setActivePanel("responsible")}>
          Atsakingi asmenys
        </button>
        <button className="panel-tab" type="button" onClick={() => { setVoteStep(1); setVoteOpen(true); }}>
          Balsavimo dėžutė
        </button>
        <button className={activePanel === "qr" ? "panel-tab active" : "panel-tab"} type="button" onClick={() => setActivePanel("qr")}>
          QR tikrinimas
        </button>
        <button className={activePanel === "admin" ? "panel-tab active" : "panel-tab"} type="button" onClick={() => setActivePanel("admin")}>
          Admin zona
        </button>
      </section>

      {activePanel === "program" ? (
        <SectionCard title="Programa" description="Atnaujinta vieša vakaro eiga.">
          <div className="timeline">
            {PROGRAM_ITEMS.map((item) => (
              <div className="timeline-item" key={item.time}>
                <div className="timeline-time">{item.time}</div>
                <div>
                  <strong>{item.title}</strong>
                  <p>{item.note}</p>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      ) : null}

      {activePanel === "important" ? (
        <SectionCard title="Svarbu" description="Trumpi organizatoriaus priminimai svečiams.">
          <div className="pill-list">
            {IMPORTANT_REMINDERS.map((item) => (
              <div className="pill" key={item}>
                {item}
              </div>
            ))}
          </div>
        </SectionCard>
      ) : null}

      {activePanel === "guests" ? (
        <SectionCard title="Svečių lenta" description="Rodomi tik apmokėti ir organizatoriaus patvirtinti dalyviai.">
          <div className="guest-grid">
            {guestEntries.length ? (
              guestEntries.map((entry, index) => (
                <div
                  className={highlightGuestKey === `${entry.city}-${entry.name}` ? "guest-cell highlighted" : "guest-cell"}
                  key={`${entry.name}-${entry.city}-${index}`}
                >
                  <span className="guest-city">{entry.city}</span>
                  {entry.name}
                </div>
              ))
            ) : (
              <div className="empty-state">Kol kas aktyvių svečių nėra.</div>
            )}
          </div>
        </SectionCard>
      ) : null}

      {activePanel === "songs" ? (
        <SectionCard title="Dainų pasiūlymai ir idėjos" description="Svečių pasiūlymai muzikai ir renginio veikloms.">
          <div className="stack">
            <div className="form-grid">
              <Field label="Dainos pavadinimas arba komentaras">
                <input
                  value={songForm.title}
                  onChange={(event) => setSongForm((previous) => ({ ...previous, title: event.target.value }))}
                  placeholder="Pvz. Vakaro hitas"
                />
              </Field>
              <Field label="Nuoroda">
                <input
                  value={songForm.url}
                  onChange={(event) => setSongForm((previous) => ({ ...previous, url: event.target.value }))}
                  placeholder="https://youtube.com/..."
                />
              </Field>
            </div>
            <button className="secondary-button" type="button" onClick={addSongSuggestion}>
              Pasiūlyti dainą
            </button>

            <div className="stack">
              {songSuggestions.map((item) => (
                <div className="list-item" key={item.id}>
                  <div>
                    <strong>{item.title || "Be pavadinimo"}</strong>
                    <p>Šaltinis: {item.source}</p>
                  </div>
                  <a href={item.url} target="_blank" rel="noreferrer">
                    Atidaryti
                  </a>
                </div>
              ))}
            </div>

            <div className="highlight-box">
              <Field label="Idėja renginiui">
                <input
                  value={ideaForm}
                  onChange={(event) => setIdeaForm(event.target.value)}
                  placeholder="Pvz. konkursas, žaidimas, staigmena ar kita veikla"
                />
              </Field>
              <button className="secondary-button" type="button" onClick={addEventIdea}>
                Pasiūlyti idėją
              </button>
            </div>

            <div className="stack">
              {eventIdeas.map((item) => (
                <div className="list-item" key={item.id}>
                  <div>
                    <strong>Idėja renginiui</strong>
                    <p>{item.text}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </SectionCard>
      ) : null}

      {activePanel === "responsible" ? (
        <SectionCard title="Atsakingi asmenys" description="Vieša informacija apie pareigybes ir atsakingus žmones.">
          <div className="responsible-grid">
            {responsiblePeople
              .filter((item) => item.role.trim() || item.names.trim())
              .map((item) => (
                <div className="panel" key={item.id}>
                  <strong>{item.role || "Papildoma pareigybė"}</strong>
                  <p>{item.names || "Bus papildyta"}</p>
                </div>
              ))}
          </div>
        </SectionCard>
      ) : null}

      {activePanel === "qr" ? (
        <SectionCard title="QR tikrinimas" description="Durininko zona rezervacijų paieškai, apmokėjimui ir atvykimo žymėjimui.">
          {!adminUnlocked ? (
            <div className="stack">
              <Field label="Durininko / admin PIN">
                <input value={adminPin} onChange={(event) => setAdminPin(event.target.value)} placeholder="Įvesk PIN" type="password" />
              </Field>
              <div className="stack-inline">
                <button className="primary-button" type="button" onClick={unlockAdmin}>
                  Atrakinti QR tikrinimą
                </button>
                <span className="tiny-note">Demonstracinis PIN: 2026.</span>
              </div>
              {doorNotice ? <div className={`notice ${doorNotice.type}`}>{doorNotice.text}</div> : null}
            </div>
          ) : (
            <div className="stack">
              {doorNotice ? <div className={`notice qr-feedback ${doorNotice.type}`}>{doorNotice.text}</div> : null}
              <div className="form-grid two">
                <Field label="Paieška">
                  <input value={lookup} onChange={(event) => setLookup(event.target.value)} placeholder="El. paštas, tel., vardas ar QR kodas" />
                </Field>
                <Field label="Įklijuotas QR turinys">
                  <input value={scannerValue} onChange={(event) => setScannerValue(event.target.value)} placeholder='{"qrCode":"CIRKAS-0001", ...}' />
                </Field>
              </div>

              <div className="scanner-card">
                <div className="scanner-card-head">
                  <div>
                    <strong>Tikras QR skenavimas kamera</strong>
                    <p>Nuskenavus kodą, rezervacija bus parodyta automatiškai.</p>
                  </div>
                  <div className="stack-inline">
                    {!scannerActive ? (
                      <button className="secondary-button" type="button" onClick={startScanner}>
                        <CameraIcon />
                        Įjungti kamerą
                      </button>
                    ) : (
                      <button className="ghost-button" type="button" onClick={stopScanner}>
                        Sustabdyti kamerą
                      </button>
                    )}
                  </div>
                </div>
                {scannerMessage ? <div className={scannerSupported ? "scanner-message" : "scanner-message warning"}>{scannerMessage}</div> : null}
                {scannerActive ? (
                  <div className="scanner-video-shell">
                    <video className="scanner-video" ref={videoRef} autoPlay muted playsInline />
                  </div>
                ) : null}
              </div>

              {!foundReservation ? <div className="empty-state">Įvesk paiešką arba QR turinį.</div> : null}
              {foundReservation ? (
                <div className="stack">
                  <div className={`scan-status ${foundReservation.paid ? "success" : "warning"}`}>
                    {foundReservation.paid ? "Leisti įeiti / rezervacija apmokėta" : "Dėmesio: rezervacija dar neapmokėta"}
                  </div>
                  <div className="reservation-panel">
                    <div>
                      <strong>{foundReservation.contactEmail}</strong>
                      <p>QR: {foundReservation.qrCode}</p>
                      <p>Telefonas: {foundReservation.contactPhone}</p>
                      <p>
                        Apmokėjimas: {foundReservation.paid ? "Apmokėta" : "Neapmokėta"}
                        {foundReservation.paymentMethod ? ` (${foundReservation.paymentMethod === "bank" ? "banku" : "grynais"})` : ""}
                      </p>
                    </div>
                    <div className="stack-inline">
                      <button className="secondary-button" type="button" onClick={() => markAllArrived(foundReservation.id)}>
                        Pažymėti visą grupę
                      </button>
                      {!foundReservation.paid ? (
                        <>
                          <button className="ghost-button" type="button" onClick={() => setPaymentMethod(foundReservation.id, "bank")}>
                            Apmokėta banku
                          </button>
                          <button className="ghost-button" type="button" onClick={() => setPaymentMethod(foundReservation.id, "cash")}>
                            Apmokėta grynais
                          </button>
                        </>
                      ) : null}
                    </div>
                  </div>
                  <div className="stack">
                    {activePeople(foundReservation).map((person) => (
                      <div className="list-item" key={person.id}>
                        <div>
                          <strong>
                            {person.firstName} {person.lastName}
                          </strong>
                          <p>
                            {person.type === "adult" ? "Nuo 13 m." : `Iki ${CHILD_AGE_LIMIT} m.`}
                            {person.arrivedAt ? ` • Atvyko ${person.arrivedAt}` : ""}
                          </p>
                        </div>
                        <button className={person.arrived ? "secondary-button" : "ghost-button"} type="button" onClick={() => markArrived(foundReservation.id, person.id)}>
                          {person.arrived ? "Atvyko" : "Pažymėti atvykus"}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </SectionCard>
      ) : null}

      {activePanel === "admin" ? (
        <SectionCard title="Admin zona" description="Valdymas, apmokėjimai, įėjimas, eksportas ir viešų blokų koregavimas.">
          {!adminUnlocked ? (
            <div className="stack">
              <Field label="Admin PIN">
                <input value={adminPin} onChange={(event) => setAdminPin(event.target.value)} placeholder="Įvesk PIN" type="password" />
              </Field>
              <button className="primary-button" type="button" onClick={unlockAdmin}>
                Atrakinti
              </button>
              <p className="tiny-note">Demonstracinis PIN šiame projekte: 2026.</p>
            </div>
          ) : (
            <div className="stack">
              {doorNotice ? <div className={`notice ${doorNotice.type}`}>{doorNotice.text}</div> : null}

              <div className="stats-grid admin">
                <StatCard label="Aktyvių rezervacijų" value={String(activeReservations.length)} />
                <StatCard label="Laukiančiųjų eilė" value={String(waitingList.length)} tone="warning" />
                <StatCard label="Atvyko" value={String(totalArrived)} tone="success" />
                <StatCard label="Apmokėta vietų" value={String(totalPaidSeats)} tone="accent" />
              </div>

              <div className="stats-grid admin">
                <StatCard label="Suaugusių" value={String(totalAdults)} />
                <StatCard label="Vaikų" value={String(totalChildren)} />
                <StatCard label="Rinkosi banką" value={String(totalBankChosen)} tone="accent" />
                <StatCard label="Rinkosi grynuosius" value={String(totalCashChosen)} tone="success" />
              </div>

              <SectionCard title="Rezervacijos" description="Čia gali pažymėti, kaip buvo atsiskaityta už rezervaciją.">
                <div className="stack">
                  <div className="admin-group">
                    <div className="admin-group-head">
                      <strong>Reikia patikrinti</strong>
                      <span>{pendingReservations.length} rezerv.</span>
                    </div>
                    {pendingReservations.length === 0 ? <div className="empty-state">Šiuo metu nėra laukiančių patvirtinimo rezervacijų.</div> : null}
                    {pendingReservations.map((reservation) => (
                      <div className="admin-reservation-card pending" key={reservation.id}>
                        <div className="admin-reservation-head">
                          <div>
                            <strong>{reservation.qrCode}</strong>
                            <p>{reservation.contactEmail}</p>
                            <p>{reservation.contactPhone}</p>
                            <p className="admin-created-at">Registruota: {reservation.createdAt}</p>
                          </div>
                          <div className="admin-reservation-meta">
                            <span>{counts(reservation).total} asm.</span>
                            <span>Banku: {amount(reservation)} €</span>
                            <span>Grynais: {cashAmount(reservation)} €</span>
                          </div>
                        </div>

                        <div className="admin-person-list">
                          {activePeople(reservation).map((person) => (
                            <div className="admin-person-row" key={person.id}>
                              <div className="admin-person-name">
                                <strong>
                                  {person.firstName} {person.lastName}
                                </strong>
                                <PaymentBadge method={reservation.paymentMethod ?? reservation.preferredPaymentMethod} />
                              </div>
                              <p>{person.type === "adult" ? "Nuo 13 m." : `Iki ${CHILD_AGE_LIMIT} m.`}</p>
                            </div>
                          ))}
                        </div>

                        <div className="admin-payment-row">
                          <div className="payment-status-block">
                            <strong>Laukia patikrinimo</strong>
                            <p>
                              {reservation.preferredPaymentMethod === "bank"
                                ? "Registruojantis pasirinktas bankinis pavedimas."
                                : reservation.preferredPaymentMethod === "cash"
                                  ? "Registruojantis pasirinkti grynieji."
                                  : "Patikrink, ar gavai bankinį pavedimą arba grynuosius, ir pažymėk būdą."}
                            </p>
                          </div>
                          <div className="stack-inline">
                            <button className="ghost-button" type="button" onClick={() => setPaymentMethod(reservation.id, "bank")}>
                              Bankiniu pavedimu
                            </button>
                            <button className="ghost-button" type="button" onClick={() => setPaymentMethod(reservation.id, "cash")}>
                              Grynais
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="admin-group">
                    <div className="admin-group-head">
                      <strong>Jau pažymėta</strong>
                      <span>{approvedReservations.length} rezerv.</span>
                    </div>
                    {approvedReservations.length === 0 ? <div className="empty-state">Kol kas dar nėra pažymėtų rezervacijų.</div> : null}
                    {approvedReservations.map((reservation) => (
                      <div className="admin-reservation-card approved" key={reservation.id}>
                        <div className="admin-reservation-head">
                          <div>
                            <strong>{reservation.qrCode}</strong>
                            <p>{reservation.contactEmail}</p>
                            <p>{reservation.contactPhone}</p>
                            <p className="admin-created-at">Registruota: {reservation.createdAt}</p>
                          </div>
                          <div className="admin-reservation-meta">
                            <span>{counts(reservation).total} asm.</span>
                            <span>Banku: {amount(reservation)} €</span>
                            <span>Grynais: {cashAmount(reservation)} €</span>
                          </div>
                        </div>

                        <div className="admin-person-list">
                          {activePeople(reservation).map((person) => (
                            <div className="admin-person-row" key={person.id}>
                              <div className="admin-person-name">
                                <strong>
                                  {person.firstName} {person.lastName}
                                </strong>
                                <PaymentBadge method={reservation.paymentMethod ?? reservation.preferredPaymentMethod} />
                              </div>
                              <p>{person.type === "adult" ? "Nuo 13 m." : `Iki ${CHILD_AGE_LIMIT} m.`}</p>
                            </div>
                          ))}
                        </div>

                        <div className="admin-payment-row">
                          <div className="payment-status-block">
                            <strong>Apmokėta</strong>
                            <p>
                              {reservation.paymentMethod === "bank"
                                ? "Pažymėta bankiniu pavedimu."
                                : "Pažymėta grynais."}
                            </p>
                          </div>
                          <div className="stack-inline">
                            <button className="ghost-button" type="button" onClick={() => setPaymentMethod(reservation.id, "bank")}>
                              Pažymėti B
                            </button>
                            <button className="ghost-button" type="button" onClick={() => setPaymentMethod(reservation.id, "cash")}>
                              Pažymėti G
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </SectionCard>

              <SectionCard title="Atsakingi asmenys" description="Redaguojami viešai rodomi vaidmenys ir vardai.">
                <div className="stack">
                  {responsiblePeople.map((item) => (
                    <div className="form-grid two" key={item.id}>
                      <input value={item.role} onChange={(event) => updateResponsiblePerson(item.id, "role", event.target.value)} placeholder="Pareigybė" />
                      <input value={item.names} onChange={(event) => updateResponsiblePerson(item.id, "names", event.target.value)} placeholder="Vardai ir pavardės" />
                    </div>
                  ))}
                </div>
              </SectionCard>

              <SectionCard title="Pranešimai" description="Paskutiniai sistemos veiksmai.">
                <div className="stack">
                  {notifications.length === 0 ? <div className="empty-state">Pranešimų dar nėra.</div> : null}
                  {notifications.slice(0, 10).map((item) => (
                    <div className="list-item" key={item.id}>
                      <div>
                        <strong>{item.message}</strong>
                        <p>{item.createdAt}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </SectionCard>

              <SectionCard title="Susikeitimai" description="Čia matomi žmonių vietos perdavimai kitiems asmenims.">
                <div className="stack">
                  {transfers.length === 0 ? <div className="empty-state">Susikeitimų dar nėra.</div> : null}
                  {transfers.map((item) => (
                    <div className="list-item" key={item.id}>
                      <div>
                        <strong>
                          {item.originalName} → {item.replacementName}
                        </strong>
                        <p>Tel.: {item.replacementPhone}</p>
                        <p>{item.createdAt}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </SectionCard>

              <SectionCard title="Balsavimo rezultatai" description="Daugiausiai balsų surinkę žmonės penkiose kategorijose.">
                <div className="stack">
                  {votingResults.map((result) => (
                    <div className="vote-result-card" key={result.category.id}>
                      <div className="vote-result-head">
                        <strong>{result.category.label}</strong>
                        <span>{result.totalVotes} bals.</span>
                      </div>
                      {result.leaders.length === 0 ? (
                        <div className="empty-state">Šioje kategorijoje dar nebalsuota.</div>
                      ) : (
                        <div className="stack">
                          {result.leaders.map((leader, index) => (
                            <div className="vote-result-row" key={`${result.category.id}-${leader.personId}`}>
                              <span>#{index + 1}</span>
                              <strong>{leader.name}</strong>
                              <span>{leader.count} bals.</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </SectionCard>

              <div className="stack-inline">
                <button className="secondary-button" type="button" onClick={exportReservations}>
                  Eksportuoti CSV
                </button>
                <button className="danger-button" type="button" onClick={resetDemoData}>
                  Atstatyti demo duomenis
                </button>
              </div>
            </div>
          )}
        </SectionCard>
      ) : null}

      <SectionCard title="Sėkmės ratas" description="Pasuk ratą ir sužinok savo smagią vakaro misiją.">
        <div className="wheel-section compact">
          <div className="wheel-wrapper small">
            <div className="wheel-pointer" />
            <div className="wheel-disc" style={{ transform: `rotate(${wheelRotation}deg)` }}>
              {WHEEL_PRIZES.map((item, index) => (
                <div
                  className={`wheel-segment segment-${index % 6}`}
                  key={item}
                  style={{ transform: `rotate(${index * (360 / WHEEL_PRIZES.length)}deg)` }}
                >
                  <span>{index + 1}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="wheel-side">
            <p>Lengvas žaidimukas nuotaikai prieš vakarėlį. Užduotis nebūtina, bet labai skatinama.</p>
            <button className="primary-button" type="button" onClick={spinWheel} disabled={wheelSpinning}>
              {wheelSpinning ? "Sukasi..." : "Sukti ratą"}
            </button>
            <div className="wheel-result">
              <strong>Tavo misija</strong>
              <p>{wheelResult || "Pasuk ratą ir pamatyk, ką šį vakarą atneš sėkmė."}</p>
            </div>
          </div>
        </div>
      </SectionCard>

      <ClownJumpGame scores={gameScores} onSaveScore={saveGameScore} />

      <Modal
        open={registerOpen}
        title="Registracijos forma"
        description="Įvesk bendrus kontaktus ir visus registruojamus asmenis."
        onClose={() => {
          setRegisterOpen(false);
          setRegisterStep("details");
          setPrivacyTouched(false);
          setRegisterPaymentChoice(null);
        }}
      >
        <form className="stack" onSubmit={submitReservation}>
          {registerStep === "details" ? (
            <>
              <div className="form-grid three">
                <Field label="Miestas">
                  <input required value={form.city} onChange={(event) => setField("city", event.target.value)} />
                </Field>
                <Field label="Telefono numeris">
                  <input required value={form.contactPhone} onChange={(event) => setField("contactPhone", event.target.value)} />
                </Field>
                <Field label="El. paštas">
                  <input required type="email" value={form.contactEmail} onChange={(event) => setField("contactEmail", event.target.value)} />
                </Field>
              </div>

              <div className="highlight-box">
                <Field label="Nuolaidos kodas">
                  <input
                    value={form.discountCode}
                    onChange={(event) => setField("discountCode", event.target.value)}
                    placeholder="Jei turi, įvesk čia"
                  />
                </Field>
                <p>Jei kodas teisingas, bus pritaikyta 50% nuolaida suaugusių bilietams.</p>
                {formDiscountActive ? <strong className="success-text">Savanorio nuolaida pritaikyta.</strong> : null}
              </div>

              <div className="stack">
                <div className="inline-header">
                  <h4>Registruojami asmenys</h4>
                  <button className="ghost-button" type="button" onClick={addPerson}>
                    Pridėti žmogų
                  </button>
                </div>
                {form.people.map((person, index) => (
                  <div className="person-row" key={person.formId}>
                    <input
                      required={index === 0}
                      value={person.firstName}
                      onChange={(event) => setPerson(index, "firstName", event.target.value)}
                      placeholder="Vardas"
                    />
                    <input
                      value={person.lastName}
                      onChange={(event) => setPerson(index, "lastName", event.target.value)}
                      placeholder="Pavardė"
                    />
                    <select value={person.type} onChange={(event) => setPerson(index, "type", event.target.value as PersonType)}>
                      <option value="adult">Nuo 13 m.</option>
                      <option value="child">Vaikas iki 12 m.</option>
                    </select>
                    <button className="ghost-button" disabled={form.people.length === 1} type="button" onClick={() => removePerson(index)}>
                      Pašalinti
                    </button>
                  </div>
                ))}
              </div>

              <div className="summary-box">
                <span>Mokėtina suma</span>
                <strong>{formTotal} €</strong>
                {formDiscountActive ? <p>Nuolaida skaičiuojama nuo {formBaseTotal} € bazinės sumos.</p> : null}
              </div>

              <label className={privacyTouched && !form.consentAccepted ? "checkbox-row error" : "checkbox-row"}>
                <input
                  checked={form.consentAccepted}
                  onChange={(event) => {
                    setField("consentAccepted", event.target.checked);
                    if (event.target.checked) setPrivacyTouched(false);
                  }}
                  type="checkbox"
                />
                <span>
                  Sutinku su{" "}
                  <button className="inline-link-button" type="button" onClick={() => setPrivacyOpen(true)}>
                    privatumo politika
                  </button>{" "}
                  ir asmens duomenų tvarkymu registracijos tikslu. Duomenys bus ištrinti per 2–5 dienas po renginio.
                </span>
              </label>
              {privacyTouched && !form.consentAccepted ? (
                <div className="validation-error">Pirma spustelėkite, kad sutinkate su privatumo politika.</div>
              ) : null}

                <div className="modal-actions">
                  <button className="ghost-button" type="button" onClick={() => setRegisterOpen(false)}>
                    Uždaryti
                  </button>
                  <button className="primary-button" type="submit">
                    Toliau į apmokėjimą
                  </button>
                </div>
            </>
          ) : (
            <>
              <div className="payment-step">
                <div className="payment-hero">
                  <div className="summary-box">
                    <span>Mokėtina suma</span>
                    <strong>{formTotal} €</strong>
                    <p>Apmokėjimas vykdomas į asmeninę Ovidijaus D. Revolut sąskaitą.</p>
                  </div>
                  <div className="payment-note">
                    <strong>Svarbu prieš apmokant</strong>
                    <p>
                      Po apmokėjimo organizatorius admin zonoje rankiniu būdu pažymės rezervaciją kaip apmokėtą.
                    </p>
                    <p>
                      Kol apmokėjimas nebus pažymėtas kaip gautas, žmogus neatsiras svečių lentoje.
                    </p>
                  </div>
                </div>

                <div className="payment-card">
                  <div className="payment-card-head">
                    <div>
                      <span className="muted-label dark">Greitas apmokėjimas</span>
                      <h4>Apmokėti per Revolut</h4>
                    </div>
                    <span className="payment-badge">{BANK_ACCOUNT.currency}</span>
                  </div>
                  <p>
                    Patogiausias būdas: atsidaryk mokėjimo nuorodą ir atlik pavedimą į asmeninę Revolut sąskaitą.
                  </p>
                  <div className="stack-inline">
                    <button
                      className={registerPaymentChoice === "bank" ? "payment-choice bank active" : "payment-choice bank"}
                      type="button"
                      onClick={() => setRegisterPaymentChoice("bank")}
                    >
                      Pasirenku bankinį pavedimą
                    </button>
                  </div>
                  <div className="stack-inline">
                    <a className="payment-button" href={REVOLUT_PAYMENT_URL} target="_blank" rel="noreferrer">
                      Atidaryti Revolut.me
                    </a>
                    <a className="map-link" href={REVOLUT_APP_URL} target="_blank" rel="noreferrer">
                      Atidaryti Revolut programėlę
                    </a>
                  </div>
                </div>

                <div className="payment-card">
                  <div className="payment-card-head">
                    <div>
                      <span className="muted-label dark">Alternatyva</span>
                      <h4>Atsiskaitymas grynais</h4>
                    </div>
                    <span className="payment-badge">+1 €/asm.</span>
                  </div>
                  <p>
                    Jei patogiau, gali atsiskaityti grynais. Tokiu atveju prisideda papildomas
                    1 € mokestis už kiekvieną registruojamą žmogų.
                  </p>
                  <div className="stack-inline">
                    <button
                      className={registerPaymentChoice === "cash" ? "payment-choice cash active" : "payment-choice cash"}
                      type="button"
                      onClick={() => setRegisterPaymentChoice("cash")}
                    >
                      Pasirenku mokėti grynais
                    </button>
                  </div>
                  <div className="summary-box compact">
                    <span>Grynųjų suma</span>
                    <strong>{formCashTotal} €</strong>
                    <p>Ši suma bus pažymėta admin zonoje pasirinkus apmokėjimą grynais.</p>
                  </div>
                </div>

                <div className="payment-card">
                  <div className="payment-card-head">
                    <div>
                      <span className="muted-label dark">Bankiniai duomenys</span>
                      <h4>Bankinio pavedimo duomenys</h4>
                    </div>
                    <span className="payment-badge">{BANK_ACCOUNT.currency}</span>
                  </div>
                  <div className="bank-grid">
                    <div className="bank-row">
                      <span>Gavėjas</span>
                      <strong>{BANK_ACCOUNT.recipient}</strong>
                    </div>
                    <div className="bank-row">
                      <span>IBAN</span>
                      <strong>{BANK_ACCOUNT.iban}</strong>
                    </div>
                    <div className="bank-row">
                      <span>BIC / SWIFT</span>
                      <strong>{BANK_ACCOUNT.bic}</strong>
                    </div>
                    <div className="bank-row">
                      <span>Bankas</span>
                      <strong>{BANK_ACCOUNT.bankName}</strong>
                    </div>
                    <div className="bank-row">
                      <span>Adresas</span>
                      <strong>{BANK_ACCOUNT.bankAddress}</strong>
                    </div>
                    <div className="bank-row">
                      <span>Korespondentinis BIC</span>
                      <strong>{BANK_ACCOUNT.correspondentBic}</strong>
                    </div>
                  </div>
                </div>

                <div className="payment-note">
                  <strong>Mokėjimo paskirtis</strong>
                  <p>
                    Mokėjimo paskirtyje įrašyk savo vardą, pavardę ir telefono numerį, kad organizatorius galėtų lengvai sutikrinti pavedimą.
                  </p>
                  <p>
                    Kai organizatorius admin zonoje pažymės „Bankiniu pavedimu“ arba „Grynais“, tik tada
                    dalyvis atsiras svečių lentoje.
                  </p>
                </div>
              </div>

              <div className="modal-actions">
                <button className="ghost-button" type="button" onClick={() => setRegisterStep("details")}>
                  Grįžti
                </button>
                <button className="primary-button" type="button" disabled={!registerPaymentChoice} onClick={finalizeReservation}>
                  Tęsti su pasirinktu apmokėjimu
                </button>
              </div>
              {!registerPaymentChoice ? <div className="validation-error">Pasirinkite, ar mokėsite bankiniu pavedimu, ar grynais.</div> : null}
            </>
          )}
        </form>
      </Modal>

      <Modal
        open={privacyOpen}
        title="Privatumo politika"
        description="Informacija apie asmens duomenų tvarkymą pagal BDAR / GDPR 13 straipsnio principus."
        onClose={() => setPrivacyOpen(false)}
      >
        <div className="privacy-policy stack">
          <div className="privacy-section">
            <strong>1. Duomenų valdytojas</strong>
            <p>Asmens duomenis renginio registracijos tikslu tvarko Ovidijus D.</p>
          </div>
          <div className="privacy-section">
            <strong>2. Kokie duomenys renkami</strong>
            <p>Registracijos metu gali būti renkami šie duomenys: vardas, pavardė, miestas, telefono numeris, el. pašto adresas, registruojamų asmenų sąrašas, mokėjimo būsena ir su atvykimu susiję žymėjimai.</p>
          </div>
          <div className="privacy-section">
            <strong>3. Duomenų tvarkymo tikslas</strong>
            <p>Duomenys naudojami renginio registracijai administruoti, dalyvių sąrašui sudaryti, mokėjimams sutikrinti, QR patikrai prie įėjimo, komunikacijai dėl renginio ir vietų valdymui.</p>
          </div>
          <div className="privacy-section">
            <strong>4. Teisinis pagrindas</strong>
            <p>Duomenys tvarkomi Jūsų sutikimo pagrindu ir tiek, kiek to reikia registracijai bei renginio organizavimui įgyvendinti.</p>
          </div>
          <div className="privacy-section">
            <strong>5. Kam duomenys gali būti naudojami</strong>
            <p>Duomenys naudojami tik renginio organizavimo poreikiams. Jie nėra skirti viešam platinimui ar naudojimui su registracija nesusijusiais tikslais.</p>
          </div>
          <div className="privacy-section">
            <strong>6. Saugojimo terminas</strong>
            <p>Registracijos duomenys saugomi tik tiek, kiek būtina renginiui įvykdyti, ir ištrinami per 2–5 dienas po renginio pabaigos.</p>
          </div>
          <div className="privacy-section">
            <strong>7. Jūsų teisės</strong>
            <p>Jūs turite teisę susipažinti su savo duomenimis, prašyti juos ištaisyti, ištrinti, apriboti jų tvarkymą, taip pat atšaukti savo sutikimą, kai tai taikoma.</p>
          </div>
          <div className="privacy-section">
            <strong>8. Papildoma informacija</strong>
            <p>Jei manote, kad Jūsų duomenys tvarkomi netinkamai, turite teisę kreiptis į Valstybinę duomenų apsaugos inspekciją. Šis tekstas parengtas pagal BDAR informavimo pareigos principus; jei renginys bus organizuojamas nuolat ar komerciškai, verta jį papildomai peržiūrėti su teisininku.</p>
          </div>
        </div>
      </Modal>

      <Modal
        open={myTicketOpen}
        title="Mano bilietas"
        description="Įvesk savo telefoną, el. paštą, vardą arba QR kodą."
        onClose={() => setMyTicketOpen(false)}
      >
        <div className="stack">
          <input value={myLookup} onChange={(event) => setMyLookup(event.target.value)} placeholder="+370..., el. paštas arba vardas" />
          {!myLookup ? <div className="empty-state">Įvesk paieškos duomenis.</div> : null}
          {myLookup && !myReservation ? <div className="empty-state warning">Rezervacija nerasta.</div> : null}
          {myReservation ? (
            <div className="ticket-card">
              <strong>{myReservation.contactEmail}</strong>
              <p>QR: {myReservation.qrCode}</p>
              <div className="qr-panel">
                <QRCodeSVG value={qrPayload(myReservation)} size={190} includeMargin />
              </div>
              <p>Parodyk šį QR prie įėjimo.</p>
            </div>
          ) : null}
        </div>
      </Modal>

      <Modal
        open={cancelOpen}
        title="Atšaukti dalyvavimą"
        description="Įvesk vardą, pavardę, telefoną arba el. paštą."
        onClose={() => setCancelOpen(false)}
      >
        <div className="stack">
          <input value={cancelLookup} onChange={(event) => setCancelLookup(event.target.value)} placeholder="Jonas, Petraitis, +370..." />
          {!cancelLookup.trim() ? <div className="empty-state">Įvesk paieškos duomenis.</div> : null}
          {cancelLookup.trim() && !cancelReservation ? <div className="empty-state warning">Nerasta.</div> : null}
          {cancelReservation ? (
            <div className="stack">
              {activePeople(cancelReservation).map((person) => (
                <div className="list-item" key={person.id}>
                  <div>
                    <strong>
                      {person.firstName} {person.lastName}
                    </strong>
                    <p>{person.type === "adult" ? "Nuo 13 m." : `Iki ${CHILD_AGE_LIMIT} m.`}</p>
                  </div>
                  <button
                    className="danger-button"
                    type="button"
                    onClick={() => requestCancel(cancelReservation.id, person.id, `${person.firstName} ${person.lastName}`.trim())}
                  >
                    Atšaukti
                  </button>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </Modal>

      <Modal
        open={transferOpen}
        title="Susikeisti vietą"
        description="Jei nebegali dalyvauti, gali perduoti savo vietą kitam žmogui."
        onClose={() => setTransferOpen(false)}
      >
        <div className="stack">
          <Field label="Paieška pagal tavo duomenis">
            <input
              value={transferLookup}
              onChange={(event) => setTransferLookup(event.target.value)}
              placeholder="Vardas, tel. numeris arba el. paštas"
            />
          </Field>

          {!transferLookup.trim() ? <div className="empty-state">Įvesk savo vardą, telefono numerį arba el. paštą.</div> : null}
          {transferLookup.trim() && !transferReservation ? <div className="empty-state warning">Rezervacija nerasta.</div> : null}

          {transferReservation ? (
            <div className="stack">
              <div className="highlight-box">
                <p>Pirmiausia pasirink, kurį asmenį nori pakeisti kitu žmogumi.</p>
              </div>

              <div className="stack">
                {activePeople(transferReservation).map((person) => (
                  <label className="select-row" key={person.id}>
                    <input
                      checked={selectedTransferPersonId === person.id}
                      name="transfer-person"
                      type="radio"
                      onChange={() => setSelectedTransferPersonId(person.id)}
                    />
                    <span>
                      <strong>
                        {person.firstName} {person.lastName}
                      </strong>
                      <small>{person.type === "adult" ? "Nuo 13 m." : `Iki ${CHILD_AGE_LIMIT} m.`}</small>
                    </span>
                  </label>
                ))}
              </div>

              <div className="form-grid two">
                <Field label="Kito asmens vardas">
                  <input
                    value={transferForm.replacementName}
                    onChange={(event) => setTransferForm((previous) => ({ ...previous, replacementName: event.target.value }))}
                    placeholder="Pvz. Tomas"
                  />
                </Field>
                <Field label="Kito asmens mob. numeris">
                  <input
                    value={transferForm.replacementPhone}
                    onChange={(event) => setTransferForm((previous) => ({ ...previous, replacementPhone: event.target.value }))}
                    placeholder="+3706..."
                  />
                </Field>
              </div>

              <div className="highlight-box">
                <p>Apie susikeitimą informacija bus parodyta admin zonoje, o svečių lentoje vietoj ankstesnio žmogaus bus rodomas naujas vardas.</p>
              </div>

              <div className="modal-actions">
                <button className="ghost-button" type="button" onClick={() => setTransferOpen(false)}>
                  Uždaryti
                </button>
                <button
                  className="primary-button"
                  type="button"
                  disabled={!selectedTransferPersonId || !transferForm.replacementName.trim() || !transferForm.replacementPhone.trim()}
                  onClick={submitTransfer}
                >
                  Pateikti susikeitimą
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </Modal>

      <Modal
        open={voteOpen}
        title="Balsavimo dėžutė"
        description="Balsuoti gali tik patvirtinti svečiai. Vienas žmogus gali vieną kartą balsuoti kiekvienoje kategorijoje."
        onClose={() => setVoteOpen(false)}
      >
        <div className="vote-steps">
          <div className="vote-step-indicator">
            <span className={voteStep === 1 ? "step-pill active" : "step-pill"}>1. Tavo vardas</span>
            <span className={voteStep === 2 ? "step-pill active" : "step-pill"}>2. Kategorija</span>
            <span className={voteStep === 3 ? "step-pill active" : "step-pill"}>3. Duoti balsą</span>
          </div>

          {voteStep === 1 ? (
            <div className="vote-box">
              <Field label="Surask savo vardą ir pavardę">
                <input
                  value={voteVoterLookup}
                  onChange={(event) => setVoteVoterLookup(event.target.value)}
                  placeholder="Įvesk savo vardą ir pavardę"
                />
              </Field>
              <div className="stack">
                {voteVoterLookup.trim() ? (
                  voterMatches.length ? (
                    voterMatches.map((person) => (
                      <button
                        className={selectedVoterId === person.id ? "vote-person active" : "vote-person"}
                        key={person.id}
                        type="button"
                        onClick={() => setSelectedVoterId(person.id)}
                      >
                        <strong>{person.name}</strong>
                        <span>{person.city}</span>
                      </button>
                    ))
                  ) : (
                    <div className="empty-state">Tokio svečio tarp patvirtintų dalyvių nerasta.</div>
                  )
                ) : <div className="empty-state">Pirma surask save ir pasirink savo vardą.</div>}
              </div>
              <div className="modal-actions">
                <button className="ghost-button" type="button" onClick={() => setVoteOpen(false)}>
                  Uždaryti
                </button>
                <button className="primary-button" disabled={!selectedVoterId} type="button" onClick={() => setVoteStep(2)}>
                  Toliau
                </button>
              </div>
            </div>
          ) : null}

          {voteStep === 2 ? (
            <div className="vote-box">
              <div className="inline-header">
                <h4>Pasirink kategoriją</h4>
                {selectedVoter ? <span className="tiny-note">Balsuoja: {selectedVoter.name}</span> : null}
              </div>
              <div className="vote-categories">
                {VOTING_CATEGORIES.map((category) => {
                  const alreadyVoted = votes.some((vote) => vote.voterPersonId === selectedVoterId && vote.categoryId === category.id);
                  return (
                    <button
                      className={selectedVoteCategory === category.id ? "vote-category active" : "vote-category"}
                      disabled={!selectedVoterId}
                      key={category.id}
                      type="button"
                      onClick={() => setSelectedVoteCategory(category.id)}
                    >
                      <strong>{category.label}</strong>
                      <span>{alreadyVoted ? "Jau balsuota" : "Gali balsuoti"}</span>
                    </button>
                  );
                })}
              </div>
              <div className="modal-actions">
                <button className="ghost-button" type="button" onClick={() => setVoteStep(1)}>
                  Atgal
                </button>
                <button className="primary-button" disabled={!selectedVoteCategory} type="button" onClick={() => setVoteStep(3)}>
                  Toliau
                </button>
              </div>
            </div>
          ) : null}

          {voteStep === 3 ? (
            <div className="vote-box">
              <Field label="Surask žmogų, kuriam nori atiduoti balsą">
                <input
                  value={voteTargetLookup}
                  onChange={(event) => setVoteTargetLookup(event.target.value)}
                  placeholder="Įvesk žmogaus vardą ar pavardę"
                />
              </Field>
              {selectedCategoryVote ? (
                <div className="validation-success">Šioje kategorijoje jau balsavai, todėl antrą kartą balsuoti negalima.</div>
              ) : null}
              <div className="stack">
                {voteTargetLookup.trim() ? (
                  targetMatches.length ? (
                    targetMatches.map((person) => (
                      <div className="vote-target" key={`${person.id}-${selectedVoteCategory}`}>
                        <div>
                          <strong>{person.name}</strong>
                          <p>{person.city}</p>
                        </div>
                        <button
                          className="secondary-button"
                          disabled={!selectedVoterId || !selectedVoteCategory || Boolean(selectedCategoryVote)}
                          type="button"
                          onClick={() => submitVote(person.id)}
                        >
                          Duoti savo balsą
                        </button>
                      </div>
                    ))
                  ) : (
                    <div className="empty-state">Tokio žmogaus tarp patvirtintų dalyvių nerasta.</div>
                  )
                ) : <div className="empty-state">Surask žmogų, kuriam nori atiduoti balsą.</div>}
              </div>
              <div className="modal-actions">
                <button className="ghost-button" type="button" onClick={() => setVoteStep(2)}>
                  Atgal
                </button>
                <button className="ghost-button" type="button" onClick={() => setVoteOpen(false)}>
                  Uždaryti
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </Modal>

      <Modal
        open={Boolean(pendingCancel)}
        title="Ar tikrai atšaukti dalyvavimą?"
        description={pendingCancel ? `${pendingCancel.name} bus pašalintas iš aktyvios rezervacijos.` : undefined}
        onClose={() => setPendingCancel(null)}
      >
        <div className="stack">
          <div className="highlight-box cancel-note">
            <p>
              Pinigai grąžinami esant sveikatos sutrikimams ar kitoms rimtoms nenumatytoms aplinkybėms.
            </p>
            <p>
              Kitu atveju pirmiausia prašome patiems surasti, ką pakviestumėte vietoj savęs į vakarėlį.
              Tuomet tas žmogus įėjimo mokestį sumokės jums tiesiogiai.
            </p>
          </div>
          <div className="modal-actions">
            <button className="ghost-button" type="button" onClick={() => setPendingCancel(null)}>
              Grįžti
            </button>
            <button className="danger-button" type="button" onClick={confirmCancel}>
              Taip, atšaukti
            </button>
          </div>
        </div>
      </Modal>

    </main>
  );
}
