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

type RideReservation = {
  passengerReservationId: number;
  passengerPersonId: string;
  passengerName: string;
  createdAt: string;
};

type Reservation = {
  id: number;
  city: string;
  contactPhone: string;
  contactEmail: string;
  qrCode: string;
  paid: boolean;
  paymentMethod: PaymentMethod;
  paidAt?: string | null;
  preferredPaymentMethod: PaymentMethod;
  createdAt: string;
  discountPercent: number;
  rideOfferSeats: number | null;
  rideReservations: RideReservation[];
  needsRide: boolean;
  adminNote: string;
  people: Person[];
};

type WaitingItem = {
  id: number;
  city: string;
  contactPhone: string;
  contactEmail: string;
  rideOfferSeats: number | null;
  needsRide: boolean;
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
  previewTitle?: string;
  url: string;
  source: string;
  likes: number;
  dislikes: number;
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

type PublicPanel = "guests" | "program" | "important" | "songs" | "responsible" | "drivers" | "qr" | "admin";

type PendingCancel = {
  reservationId: number;
  personId: string;
  name: string;
} | null;

type PendingDelete = {
  reservationId: number;
  label: string;
} | null;

type PendingRideCancel = {
  driverId: number;
  driverLabel: string;
  passengerPersonId: string;
  passengerName: string;
} | null;

type BarcodeDetectorLike = {
  detect: (source: ImageBitmapSource) => Promise<Array<{ rawValue?: string }>>;
};

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
const EVENT_DATE = "2026 m. gegužės 30 d., 17:00–23:00";
const EVENT_START_ISO = "2026-05-30T17:00:00+03:00";
const EVENT_PLACE = "Priekulės kultūros centras";
const GOOGLE_MAPS_URL = "https://www.google.com/maps/search/?api=1&query=Priekul%C4%97s+kult%C5%ABros+centras";
const WAZE_URL = "https://waze.com/ul?q=Priekul%C4%97s%20kult%C5%ABros%20centras";
const ADULT_PRICE = 8;
const CHILD_AGE_LIMIT = 13;
const VOLUNTEER_DISCOUNT_CODE = "noriuprisideti50";
const VOLUNTEER_DISCOUNT_PERCENT = 50;
const MAX_PLACES = 120;
const INVITATION_CODE = "530";
const SONG_VOTES_STORAGE_KEY = "klaipedos-vakaras-song-votes";

const PROGRAM_ITEMS = [
  { day: "Penktadienis, 29 d.", time: "19:00", title: "Savanoriai padeda puošti salę", note: "Ruošiama salė, dekoracijos ir vakaro erdvė." },
  { day: "Šeštadienis", time: "16:00", title: "Atvyksta komanda", note: "Atvyksta kontrolieriai, pasirodantieji, organizatorius ir kiti savanoriai." },
  { day: "Šeštadienis", time: "17:10", title: "Įžanginiai žodžiai ir malda", note: "Trumpa vakaro pradžia prieš pagrindinę programą." },
  { day: "Šeštadienis", time: "17:15", title: "Vedėjų laikas", note: "Vakaro vedėjai perima programą ir pradeda veiklas." },
  { day: "Ruošiama", time: "TBA", title: "Kita informacija ruošiama", note: "Papildoma programa bus patikslinta vėliau." },
];

const IMPORTANT_REMINDERS = [
  {
    text: "Saikingai vartoti alkoholį vakarėlyje galima. Prašome visų, kurie nuspręs vartoti alkoholį, elgtis atsakingai ir saikingai. Naudinga prisiminti mintis iš jw.org straipsnio „Kaip krikščioniui dera žiūrėti į alkoholio vartojimą“, kuriame pabrėžiama savitvarda, nuosaikumas ir pagarba kitiems. Taip pat „BIBLIJOS POŽIŪRIS - Svaigalai“.",
    links: [
      {
        label: "Kaip krikščioniui dera žiūrėti į alkoholio vartojimą",
        url: "https://www.jw.org/lt/biblioteka/zurnalai/sargybos-bokstas-studijoms-2023-gruodis/Kaip-krik%C5%A1%C4%8Dioniui-dera-%C5%BEi%C5%ABr%C4%97ti-%C4%AF-alkoholio-vartojim%C4%85",
      },
      {
        label: "Biblijos požiūris - Svaigalai",
        url: "https://www.jw.org/lt/biblioteka/zurnalai/g201308/ar-vartoti-alkoholi-smerktina",
      },
    ],
  },
  { text: "Renginio laikas prasidės 17:00. Prašome Jūsų nevėluoti, kadangi norėsime pradėti laiku." },
  "Po renginio galintys prisidėti prie salės sutvarkymo, mielai esate kviečiami.",
  "Vienkartiniai indai bus paruošti vietoje.",
  "Prašome atsinešti gaiviųjų gėrimų ir savo pagamintų patiekalų, bus bendras švediškas stalas. Kviečiame kiekvieną svečią šiek tiek pasiruošti ir atsinešti savo gamybos patiekalą ar užkandį, kad stalas būtų kūrybingas ir įvairus, venkime vien tik traškučių, guminukų ar kitų saldumynų. Laukiami vaisiai, naminiai pyragai, tortai, įdomūs užkandžiai ar kažkas, kuo nustebintumėt kitus. Norime turėti gerą energiją šokiams, o tai bus tik su geru maistu.",
  "Vakarėlio metu vyks konkursai, žaidimai, tad raginame būti aktyviems.",
  "Vakarėlio metu organizatoriai bei paskirti budėtojai padės užtikrinti, kad nuotaika išliktų gera, o aplinka saugi ir jauki visiems.",
  "Apranga cirko tema. Tai gan laisva tema, nes viskas tinka. Kviečiame rinktis klounų, gyvūnų, akrobatų ar cirko vedėjų įvaizdžius arba bent vieną ryškų cirko akcentą. Viskas paliekama Jūsų fantazijai.",
  "Prašome susipažinti su viskuo, kas yra šiame internetiniame puslapyje.",
  "Paruošime žaidimų ir veiklų, kviečiame aktyviai dalyvauti.",
  "Kiekvienas svečias atsakingas už savo tvarką.",
  "Prašome patiems pasirūpinti atvykimu iki vakarėlio vietos. Jeigu bandėte susieškoti ir nepavyko surasti vietos pas ką nors atvykti į vakarėlį, parašykite broliui Ovidijui: +370 6635 2281.",
  "Ateikite su gera nuotaika ir pasiruošę linksmybėms.",
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

const initialSongSuggestions: SongSuggestion[] = [];

const initialEventIdeas: EventIdea[] = [];

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

const initialGameScores: GameScore[] = [];

const LEADERBOARD_SIZE = 5;
const MAX_STORED_GAME_SCORES = 100;
const DEMO_RESERVATION_EMAILS = new Set(["jonas@example.com"]);
const DEMO_RESERVATION_CODES = new Set(["CIRKAS-0001"]);
const DEMO_GAME_SCORES = new Set(["Jonas:18", "AustÄ—ja:14", "Austėja:14", "Lukas:9"]);
const DEMO_SONG_TITLES = new Set(["Pavyzdys: šokių hitas", "Pavyzdys: linksma daina"]);
const DEMO_EVENT_IDEAS = new Set(["Pavyzdys: cirko tematikos žaidimas su prizais."]);

function normalizeReservations(items: Reservation[]) {
  return items
    .filter((reservation) => {
      const email = reservation.contactEmail?.toLowerCase();
      return !DEMO_RESERVATION_EMAILS.has(email) && !DEMO_RESERVATION_CODES.has(reservation.qrCode);
    })
    .map((reservation) => ({
      ...reservation,
      preferredPaymentMethod: reservation.preferredPaymentMethod ?? reservation.paymentMethod ?? null,
      paidAt: reservation.paidAt ?? null,
      rideOfferSeats: reservation.rideOfferSeats ?? null,
      rideReservations: Array.isArray(reservation.rideReservations) ? reservation.rideReservations : [],
      needsRide: reservation.needsRide ?? false,
      adminNote: reservation.adminNote ?? "",
    }));
}

function normalizeWaitingList(items: WaitingItem[]) {
  return items.map((item) => ({
    ...item,
    rideOfferSeats: item.rideOfferSeats ?? null,
    needsRide: item.needsRide ?? false,
  }));
}

function normalizeGameScores(items: GameScore[]) {
  return items.filter((score) => !DEMO_GAME_SCORES.has(`${score.name}:${score.score}`));
}

function normalizeSongSuggestions(items: SongSuggestion[]) {
  return items
    .filter((suggestion) => !DEMO_SONG_TITLES.has(suggestion.title))
    .map((suggestion) => ({
      ...suggestion,
      previewTitle: typeof suggestion.previewTitle === "string" ? suggestion.previewTitle : "",
      likes: Number.isFinite(Number(suggestion.likes)) ? Number(suggestion.likes) : 0,
      dislikes: Number.isFinite(Number(suggestion.dislikes)) ? Number(suggestion.dislikes) : 0,
    }));
}

function normalizeEventIdeas(items: EventIdea[]) {
  return items.filter((idea) => !DEMO_EVENT_IDEAS.has(idea.text));
}

function parseSyncedArray(value: string | undefined) {
  if (!value) return [];

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function changedRecordIds(previousJson: string | undefined, nextValue: unknown) {
  if (!Array.isArray(nextValue)) return [];

  const previousById = new Map<number, string>();
  parseSyncedArray(previousJson).forEach((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return;
    const id = Number((item as { id?: unknown }).id);
    if (Number.isFinite(id)) previousById.set(id, JSON.stringify(item));
  });

  return nextValue
    .filter((item) => item && typeof item === "object" && !Array.isArray(item))
    .map((item) => ({ id: Number((item as { id?: unknown }).id), value: JSON.stringify(item) }))
    .filter((item) => Number.isFinite(item.id) && previousById.get(item.id) !== item.value)
    .map((item) => item.id);
}

const initialReservations: Reservation[] = [];

function createNumericId() {
  return Date.now() * 1000 + Math.floor(Math.random() * 1000);
}

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

function paymentPurpose(reservation?: Reservation | null) {
  const names = reservation ? activePeople(reservation).map((person) => `${person.firstName} ${person.lastName}`.trim()).filter(Boolean) : [];
  return names.length ? names.join(", ") : "įrašyk vardus asmenų, už kuriuos daromas pavedimas vakarėliui";
}

function songSourceMeta(source: string) {
  if (source === "YouTube") return { label: "YouTube", icon: "YT", className: "youtube" };
  if (source === "Spotify") return { label: "Spotify", icon: "SP", className: "spotify" };
  return { label: "Nuoroda", icon: "♪", className: "other" };
}

function responsibleIcon(role: string) {
  const normalizedRole = role.toLowerCase();
  if (normalizedRole.includes("organizator")) return "★";
  if (normalizedRole.includes("budėtoj") || normalizedRole.includes("kontrolier")) return "🛡";
  if (normalizedRole.includes("vedėj")) return "🎤";
  if (normalizedRole.includes("muzik")) return "♪";
  if (normalizedRole.includes("kamera") || normalizedRole.includes("žurnalist")) return "▣";
  if (normalizedRole.includes("šoki")) return "◆";
  if (normalizedRole.includes("žaid")) return "✦";
  if (normalizedRole.includes("savanor")) return "✚";
  if (normalizedRole.includes("mim")) return "◐";
  return "●";
}

function registrationStatus(reservation: Reservation) {
  const reservationCounts = counts(reservation);

  if (reservationCounts.total > 0 && reservationCounts.arrived === reservationCounts.total) {
    return {
      tone: "success",
      title: "Atvykimas pažymėtas",
      text: "Tavo grupė jau pažymėta kaip atvykusi į renginį.",
    };
  }

  if (reservation.paid) {
    return {
      tone: "success",
      title: "Registracija patvirtinta",
      text: "Apmokėjimas pažymėtas, todėl vardai matomi svečių lentoje.",
    };
  }

  return {
    tone: "warning",
    title: "Laukia apmokėjimo patvirtinimo",
    text: "Rezervacija sukurta, bet svečių lentoje atsiras tik tada, kai organizatorius pažymės gautą apmokėjimą.",
  };
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

function paidTimestamp(reservation: Reservation) {
  const value = Date.parse(reservation.paidAt ?? reservation.createdAt);
  return Number.isNaN(value) ? reservationTimestamp(reservation) : value;
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

function fullName(person: Person) {
  return `${person.firstName} ${person.lastName}`.trim();
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

function PaymentInformation({ reservation }: { reservation?: Reservation | null }) {
  const total = reservation ? amount(reservation) : null;

  return (
    <div className="payment-info-block">
      <div className="payment-card">
        <div className="payment-card-head">
          <div>
            <span className="muted-label dark">Apmokėjimo informacija</span>
            <h4>Bankinis apmokėjimas per Revolut</h4>
          </div>
          <span className="payment-badge">{BANK_ACCOUNT.currency}</span>
        </div>
        {total !== null ? (
          <div className="payment-amount-line">
            <span>Mokėtina suma</span>
            <strong>{total} €</strong>
          </div>
        ) : null}
        <p>
          Atidaryk mokėjimo nuorodą ir atlik pavedimą į asmeninę Revolut sąskaitą. Kai organizatorius admin zonoje
          pažymės mokėjimą kaip gautą, dalyvis atsiras svečių lentoje.
        </p>
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
            <span className="muted-label dark">Bankiniai duomenys</span>
            <h4>Bankinio pavedimo duomenys iš kito banko</h4>
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
          Mokėjimo paskirtyje įrašyk: <span className="payment-purpose-text">{paymentPurpose(reservation)}</span>.
          Taip organizatorius lengviau sutikrins, už ką atliktas pavedimas.
        </p>
      </div>
    </div>
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

function WhatsAppIcon() {
  return (
    <svg aria-hidden="true" className="button-icon" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12.04 3.5a8.38 8.38 0 0 0-7.1 12.83L4 20.5l4.28-1.12A8.38 8.38 0 1 0 12.04 3.5Zm0 1.55a6.83 6.83 0 0 1 5.79 10.45 6.8 6.8 0 0 1-8.95 2.45l-.3-.18-2.52.66.68-2.45-.2-.32a6.83 6.83 0 0 1 5.5-10.61Zm-3.08 3.7c-.16 0-.42.06-.64.3-.22.25-.85.83-.85 2.02s.87 2.35.99 2.51c.12.16 1.68 2.68 4.14 3.65 2.04.81 2.46.65 2.9.61.45-.04 1.44-.59 1.64-1.16.2-.57.2-1.06.14-1.16-.06-.1-.22-.16-.46-.28-.24-.12-1.43-.7-1.65-.78-.22-.08-.38-.12-.54.12-.16.24-.62.78-.76.94-.14.16-.28.18-.52.06-.24-.12-1.02-.38-1.94-1.2-.72-.64-1.2-1.43-1.34-1.67-.14-.24-.02-.37.1-.49.11-.1.24-.28.36-.42.12-.14.16-.24.24-.4.08-.16.04-.3-.02-.42-.06-.12-.54-1.31-.74-1.79-.2-.47-.4-.4-.54-.41h-.47Z" />
    </svg>
  );
}

function CarIcon({ className = "button-icon" }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M6.5 17.5h11" />
      <path d="M5 13l1.8-4.2A3 3 0 0 1 9.6 7h4.8a3 3 0 0 1 2.8 1.8L19 13" />
      <path d="M4.5 13h15a1.5 1.5 0 0 1 1.5 1.5V18h-2a2 2 0 0 1-4 0H9a2 2 0 0 1-4 0H3v-3.5A1.5 1.5 0 0 1 4.5 13Z" />
      <circle cx="7" cy="18" r="1.5" />
      <circle cx="17" cy="18" r="1.5" />
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
  const fullscreenRef = useRef<HTMLDivElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number | null>(null);
  const spawnTimerRef = useRef(0);
  const nextObstacleIdRef = useRef(1);
  const nextBonusIdRef = useRef(1);
  const playerYRef = useRef(0);
  const playerVelocityRef = useRef(0);
  const jumpCountRef = useRef(0);
  const slowdownBufferRef = useRef(0);
  const slowdownUntilRef = useRef(0);
  const giantUntilRef = useRef(0);
  const shrinkUntilRef = useRef(0);
  const specialBonusCooldownUntilRef = useRef(0);
  const nextSpecialBonusIndexRef = useRef(0);
  const duelCompletedLevelsRef = useRef<Set<number>>(new Set());
  const doubleJumpTimeoutRef = useRef<number | null>(null);
  const countdownTimeoutRef = useRef<number | null>(null);
  const airChallengeMomentsRef = useRef<Record<number, number[]>>({});
  const airChallengeCountsRef = useRef<Record<number, number>>({});
  const [playerName, setPlayerName] = useState("");
  const [hasStarted, setHasStarted] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [isGameOver, setIsGameOver] = useState(false);
  const [score, setScore] = useState(0);
  const [coins, setCoins] = useState(0);
  const [lives, setLives] = useState(0);
  const [savedForScore, setSavedForScore] = useState<number | null>(null);
  const [distance, setDistance] = useState(0);
  const [playerY, setPlayerY] = useState(0);
  const [slowdownBuffer, setSlowdownBuffer] = useState(0);
  const [giantMode, setGiantMode] = useState(false);
  const [shrinkMode, setShrinkMode] = useState(false);
  const [duelLevel, setDuelLevel] = useState<number | null>(null);
  const [resumeCountdown, setResumeCountdown] = useState<number | null>(null);
  const [hitFlash, setHitFlash] = useState(false);
  const [duelResult, setDuelResult] = useState<null | {
    player: "rock" | "paper" | "scissors";
    cpu: "rock" | "paper" | "scissors";
    outcome: "win" | "lose" | "draw";
  }>(null);
  const [duelRevealed, setDuelRevealed] = useState(false);
  const [doubleJumpFlash, setDoubleJumpFlash] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [scoreSaveOpen, setScoreSaveOpen] = useState(false);
  const [bonuses, setBonuses] = useState<
    Array<{
      id: number;
      x: number;
      label: string;
      type: "coin" | "balloon" | "mushroom" | "shadow";
      y: number;
      points: number;
    }>
  >([]);
  const [obstacles, setObstacles] = useState<
    Array<{
      id: number;
      x: number;
      label: string;
      passed: boolean;
      lane: "ground" | "air";
      size: "small" | "medium" | "large";
      variant: "cone" | "box" | "ball" | "banner" | "barrels" | "triangle" | "ring" | "kite" | "bird";
      points: number;
      clearY: number;
    }>
  >([]);

  const topScores = useMemo(
    () => [...scores].sort((a, b) => b.score - a.score).slice(0, LEADERBOARD_SIZE),
    [scores],
  );
  const bestScore = topScores[0]?.score ?? 0;
  const totalScore = score + coins;
  const qualifiesForTopFive = useMemo(() => {
    if (totalScore <= 0) return false;
    if (topScores.length < LEADERBOARD_SIZE) return true;
    const threshold = topScores[topScores.length - 1]?.score ?? 0;
    return totalScore > threshold;
  }, [topScores, totalScore]);
  const levelLength = 230;
  const levelSpeeds = [0.058, 0.072, 0.085, 0.097, 0.109, 0.119, 0.128, 0.136];
  const effectiveDistance = useMemo(() => Math.max(0, distance - slowdownBuffer), [distance, slowdownBuffer]);
  const level = useMemo(() => Math.min(8, 1 + Math.floor(effectiveDistance / levelLength)), [effectiveDistance]);
  const levelProgress = useMemo(() => (effectiveDistance % levelLength) / levelLength, [effectiveDistance]);
  const slowdownActive = slowdownBuffer > 1;
  const speed = useMemo(() => {
    const baseSpeed = levelSpeeds[Math.max(0, level - 1)] ?? levelSpeeds[levelSpeeds.length - 1];
    const adjusted = Math.min(0.145, baseSpeed + levelProgress * 0.01);
    return slowdownActive ? adjusted * 0.5 : adjusted;
  }, [level, levelProgress, slowdownActive]);
  const themeLevel = useMemo(() => Math.min(4, 1 + Math.floor((level - 1) / 2)), [level]);
  const duelChoices = [
    { id: "rock" as const, label: "Akmuo", emoji: "🪨" },
    { id: "paper" as const, label: "Popierius", emoji: "📄" },
    { id: "scissors" as const, label: "Žirklės", emoji: "✂️" },
  ];

  function stopLoop() {
    if (animationFrameRef.current !== null) {
      window.cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
  }

  async function toggleFullscreen() {
    if (!fullscreenRef.current) return;

    if (document.fullscreenElement === fullscreenRef.current) {
      await document.exitFullscreen();
      return;
    }

    await fullscreenRef.current.requestFullscreen();
  }

  function resetRound() {
    stopLoop();
    if (doubleJumpTimeoutRef.current !== null) {
      window.clearTimeout(doubleJumpTimeoutRef.current);
      doubleJumpTimeoutRef.current = null;
    }
    if (countdownTimeoutRef.current !== null) {
      window.clearTimeout(countdownTimeoutRef.current);
      countdownTimeoutRef.current = null;
    }
    lastTimeRef.current = null;
    spawnTimerRef.current = 0;
    nextObstacleIdRef.current = 1;
    nextBonusIdRef.current = 1;
    playerYRef.current = 0;
    playerVelocityRef.current = 0;
    jumpCountRef.current = 0;
    slowdownBufferRef.current = 0;
    slowdownUntilRef.current = 0;
    giantUntilRef.current = 0;
    shrinkUntilRef.current = 0;
    specialBonusCooldownUntilRef.current = 0;
    nextSpecialBonusIndexRef.current = 0;
    duelCompletedLevelsRef.current = new Set();
    airChallengeMomentsRef.current = {};
    airChallengeCountsRef.current = {};
    setHasStarted(false);
    setScore(0);
    setCoins(0);
    setLives(0);
    setDistance(0);
    setPlayerY(0);
    setSlowdownBuffer(0);
    setGiantMode(false);
    setShrinkMode(false);
    setDuelLevel(null);
    setResumeCountdown(null);
    setHitFlash(false);
    setDuelResult(null);
    setDuelRevealed(false);
    setDoubleJumpFlash(false);
      setObstacles([]);
      setBonuses([]);
      setIsGameOver(false);
      setSavedForScore(null);
      setScoreSaveOpen(false);
    }

  function startGame() {
    resetRound();
    setHasStarted(true);
    setIsRunning(true);
  }

  function resumeRound() {
    lastTimeRef.current = null;
    setIsRunning(true);
  }

  function jump() {
    if (!isRunning) return;
    if (playerYRef.current <= 4) {
      jumpCountRef.current = 1;
      playerVelocityRef.current = 1.16;
      return;
    }

    if (jumpCountRef.current < 2) {
      jumpCountRef.current = 2;
      playerVelocityRef.current = 1.08;
      setDoubleJumpFlash(true);
      if (doubleJumpTimeoutRef.current !== null) {
        window.clearTimeout(doubleJumpTimeoutRef.current);
      }
      doubleJumpTimeoutRef.current = window.setTimeout(() => {
        setDoubleJumpFlash(false);
        doubleJumpTimeoutRef.current = null;
      }, 260);
    }
  }

  function saveScore() {
    const trimmed = playerName.trim();
    if (!trimmed || totalScore <= 0 || savedForScore === totalScore || !qualifiesForTopFive) return;
    onSaveScore(trimmed, totalScore);
    setSavedForScore(totalScore);
    setScoreSaveOpen(false);
  }

  function playDuel(choice: "rock" | "paper" | "scissors") {
    if (duelLevel === null || duelResult) return;
    const cpu = duelChoices[Math.floor(Math.random() * duelChoices.length)].id;
    const winsAgainst = {
      rock: "scissors",
      paper: "rock",
      scissors: "paper",
    } as const;
    const outcome = choice === cpu ? "draw" : winsAgainst[choice] === cpu ? "win" : "lose";

    if (outcome === "win") {
      setScore((previousScore) => previousScore + 20);
      setLives((previousLives) => Math.min(3, previousLives + 1));
    }

    setDuelResult({ player: choice, cpu, outcome });
    setDuelRevealed(false);
    window.setTimeout(() => {
      setDuelRevealed(true);
    }, 260);
  }

  function continueAfterDuel() {
    if (duelLevel === null) return;
    if (duelResult?.outcome === "draw") {
      setDuelResult(null);
      setDuelRevealed(false);
      return;
    }
    duelCompletedLevelsRef.current.add(duelLevel);
    setDuelLevel(null);
    setDuelResult(null);
    setDuelRevealed(false);
    setResumeCountdown(3);
  }

  useEffect(() => {
    if (!airChallengeMomentsRef.current[level]) {
      const count = level < 2 ? 0 : 1 + Math.floor(Math.random() * 3);
      airChallengeMomentsRef.current[level] = Array.from({ length: count }, (_, index) => {
        const segment = 0.22 + index * (0.48 / Math.max(count, 1));
        return Math.min(0.88, segment + Math.random() * 0.18);
      }).sort((a, b) => a - b);
      airChallengeCountsRef.current[level] = 0;
    }
  }, [level]);

  useEffect(() => {
    if (!isRunning) {
      stopLoop();
      return;
    }

    const obstacleTemplates = [
      { label: "Kūgis", lane: "ground" as const, size: "small" as const, variant: "cone" as const, points: 1, clearY: 28 },
      { label: "Trikampis", lane: "ground" as const, size: "medium" as const, variant: "triangle" as const, points: 2, clearY: 40 },
      { label: "Kamuolys", lane: "ground" as const, size: "medium" as const, variant: "ball" as const, points: 2, clearY: 42 },
      { label: "Dėžė", lane: "ground" as const, size: "large" as const, variant: "box" as const, points: 3, clearY: 54 },
      { label: "Statinės", lane: "ground" as const, size: "large" as const, variant: "barrels" as const, points: 4, clearY: 52 },
      { label: "Juosta", lane: "air" as const, size: "medium" as const, variant: "banner" as const, points: 3, clearY: 18 },
      { label: "Žiedas", lane: "air" as const, size: "medium" as const, variant: "ring" as const, points: 4, clearY: 24 },
      { label: "Aitvaras", lane: "air" as const, size: "large" as const, variant: "kite" as const, points: 4, clearY: 22 },
      { label: "Paukštis", lane: "air" as const, size: "small" as const, variant: "bird" as const, points: 3, clearY: 14 },
    ];
    const airTemplates = obstacleTemplates.filter((template) => template.lane === "air");
    const groundTemplates = obstacleTemplates.filter((template) => template.lane === "ground");

    const playerBox = () => {
      const giant = giantUntilRef.current > 0;
      const shrink = shrinkUntilRef.current > 0;
      return {
        left: 13.6,
        right: giant ? 21.2 : shrink ? 17.2 : 19,
        bottom: 28 + playerYRef.current,
        top: 28 + playerYRef.current + (giant ? 72 : shrink ? 24 : 52),
      };
    };

    const obstacleBox = (obstacle: {
      x: number;
      lane: "ground" | "air";
      size: "small" | "medium" | "large";
    }) => {
      const widths = {
        small: 3.9,
        medium: 5.1,
        large: 6.7,
      };
      const heights = {
        small: 34,
        medium: 44,
        large: 50,
      };
      const bottom = obstacle.lane === "ground" ? 28 : 144;
      return {
        left: obstacle.x,
        right: obstacle.x + widths[obstacle.size],
        bottom,
        top: bottom + heights[obstacle.size],
      };
    };

    function tick(timestamp: number) {
      if (lastTimeRef.current === null) {
        lastTimeRef.current = timestamp;
      }

      const delta = Math.min(32, timestamp - lastTimeRef.current);
      lastTimeRef.current = timestamp;
      spawnTimerRef.current += delta;
      const nextSlowdownBuffer = Math.max(0, slowdownBufferRef.current - delta * 0.01);
      slowdownBufferRef.current = nextSlowdownBuffer;
      setSlowdownBuffer(nextSlowdownBuffer);

      if (slowdownUntilRef.current && timestamp >= slowdownUntilRef.current) {
        slowdownUntilRef.current = 0;
        slowdownBufferRef.current = 0;
        setSlowdownBuffer(0);
      }

      if (giantUntilRef.current && timestamp >= giantUntilRef.current) {
        giantUntilRef.current = 0;
        setGiantMode(false);
      }

      if (shrinkUntilRef.current && timestamp >= shrinkUntilRef.current) {
        shrinkUntilRef.current = 0;
        setShrinkMode(false);
      }

      setDistance((previous) => previous + delta * speed * 0.12);

      const gravity = 0.0052;
      const nextVelocity = playerVelocityRef.current - gravity * delta;
      const nextY = Math.max(0, playerYRef.current + nextVelocity * delta);
      if (nextY === 0) {
        playerVelocityRef.current = 0;
        jumpCountRef.current = 0;
      } else {
        playerVelocityRef.current = nextVelocity;
      }
      playerYRef.current = nextY;
      setPlayerY(nextY);

      setObstacles((previous) => {
        let next = previous
          .map((obstacle) => ({ ...obstacle, x: obstacle.x - delta * speed }))
          .filter((obstacle) => obstacle.x > -18);

        const spawnDelay = Math.max(700, 1540 - level * 68 + Math.random() * 280);
        if (spawnTimerRef.current >= spawnDelay) {
          const canSpawnAirChallenge = !next.some((obstacle) => obstacle.lane === "ground" && obstacle.x > 18 && obstacle.x < 112);
          const airMoments = airChallengeMomentsRef.current[level] ?? [];
          const airCount = airChallengeCountsRef.current[level] ?? 0;
          const shouldSpawnAirChallenge =
            level >= 2 &&
            canSpawnAirChallenge &&
            airCount < airMoments.length &&
            levelProgress >= airMoments[airCount];

          if (shouldSpawnAirChallenge) {
            const template = airTemplates[Math.floor(Math.random() * airTemplates.length)];
            next = [
              ...next,
              {
                id: nextObstacleIdRef.current++,
                x: 100,
                label: template.label,
                passed: false,
                lane: template.lane,
                size: template.size,
                variant: template.variant,
                points: template.points,
                clearY: template.clearY,
              },
            ];
            airChallengeCountsRef.current[level] = airCount + 1;
            spawnTimerRef.current = 0;
          } else {
            const available = groundTemplates.slice(0, Math.min(groundTemplates.length, 2 + Math.min(level, 4)));
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
                clearY: template.clearY,
              },
            ];

            if (level >= 4 && Math.random() > 0.74) {
              const comboTemplate = available[Math.floor(Math.random() * available.length)];
              additions.push({
                id: nextObstacleIdRef.current++,
                x: 112 + Math.random() * 10,
                label: comboTemplate.label,
                passed: false,
                lane: comboTemplate.lane,
                size: comboTemplate.size,
                variant: comboTemplate.variant,
                points: comboTemplate.points,
                clearY: comboTemplate.clearY,
              });
            }

            next = [...next, ...additions];
            spawnTimerRef.current = 0;
          }
        }

        let collision = false;
        let collidedObstacleId: number | null = null;
        let gained = 0;
        const player = playerBox();

        next = next.map((obstacle) => {
          const box = obstacleBox(obstacle);
          const horizontalOverlap = player.left < box.right && player.right > box.left;
          const verticalOverlap = player.bottom < box.top && player.top > box.bottom;

          if (!obstacle.passed && box.right < player.left) {
            gained += obstacle.points;
            return { ...obstacle, passed: true };
          }

          if (!obstacle.passed && horizontalOverlap && verticalOverlap) {
            collision = true;
            collidedObstacleId = obstacle.id;
          }

          return obstacle;
        });

        if (gained) {
          setScore((previousScore) => previousScore + gained);
        }

        if (collision && lives > 0 && collidedObstacleId !== null) {
          collision = false;
          setLives((previousLives) => Math.max(0, previousLives - 1));
          setHitFlash(true);
          window.setTimeout(() => setHitFlash(false), 180);
          next = next.filter((obstacle) => obstacle.id !== collidedObstacleId);
        }

        if (collision) {
          setIsRunning(false);
          setIsGameOver(true);
        }

        return next;
      });

      setBonuses((previous) => {
        let next = previous
          .map((bonus) => ({ ...bonus, x: bonus.x - delta * (speed * 0.85) }))
          .filter((bonus) => bonus.x > -14);

        const specialTypes: Array<"balloon" | "mushroom" | "shadow"> = ["balloon", "mushroom", "shadow"];
        const canSpawnSpecial = timestamp >= specialBonusCooldownUntilRef.current;
        const shouldSpawnSpecial = canSpawnSpecial && Math.random() > 0.9988 - level * 0.0007;
        const shouldSpawnCoin = !shouldSpawnSpecial && Math.random() > 0.989 - level * 0.004;

        if (shouldSpawnSpecial || shouldSpawnCoin) {
          const bonusType = shouldSpawnSpecial
            ? specialTypes[nextSpecialBonusIndexRef.current % specialTypes.length]
            : "coin";

          if (shouldSpawnSpecial) {
            nextSpecialBonusIndexRef.current += 1;
            specialBonusCooldownUntilRef.current = timestamp + 7000 + Math.random() * 3000;
          }

          next = [
            ...next,
            {
              id: nextBonusIdRef.current++,
              x: 100,
              label: bonusType === "coin" ? "★" : bonusType === "balloon" ? "🎈" : bonusType === "mushroom" ? "🍄" : "⬤",
              type: bonusType,
              y:
                bonusType === "coin"
                  ? 52 + Math.random() * 44
                  : bonusType === "balloon"
                    ? 86 + Math.random() * 34
                    : bonusType === "mushroom"
                      ? 34 + Math.random() * 10
                      : 42 + Math.random() * 14,
              points: bonusType === "coin" ? 2 : bonusType === "balloon" ? 4 : bonusType === "mushroom" ? 5 : 5,
            },
          ];
        }

        let gained = 0;
        let gainedCoins = 0;

        next = next.filter((bonus) => {
          const inRange = bonus.x <= 22 && bonus.x >= 8;
          const caught = inRange && Math.abs(playerYRef.current - bonus.y) <= 20;

          if (caught) {
            gained += bonus.points;
            gainedCoins += 1;
            if (bonus.type === "balloon") {
              slowdownUntilRef.current = timestamp + 4500;
              const addedSlowdown = 120;
              slowdownBufferRef.current = addedSlowdown;
              setSlowdownBuffer(addedSlowdown);
            }
            if (bonus.type === "mushroom") {
              giantUntilRef.current = timestamp + 10000;
              shrinkUntilRef.current = 0;
              setGiantMode(true);
              setShrinkMode(false);
            }
            if (bonus.type === "shadow") {
              shrinkUntilRef.current = timestamp + 5000;
              giantUntilRef.current = 0;
              setShrinkMode(true);
              setGiantMode(false);
            }
            return false;
          }

          return true;
        });

        if (gained) {
          setScore((previousScore) => previousScore + gained);
          setCoins((previousCoins) => previousCoins + gainedCoins);
        }

        return next;
      });

      animationFrameRef.current = window.requestAnimationFrame(tick);
    }

    animationFrameRef.current = window.requestAnimationFrame(tick);
    return () => stopLoop();
  }, [isRunning, level, speed]);

  useEffect(() => {
    if (!hasStarted || !isRunning || isGameOver || duelLevel !== null || level < 2) return;
    if (duelCompletedLevelsRef.current.has(level)) return;

    stopLoop();
    setIsRunning(false);
    setDuelLevel(level);
    setDuelResult(null);
  }, [duelLevel, hasStarted, isGameOver, isRunning, level]);

  useEffect(() => {
    if (resumeCountdown === null) return;

    if (resumeCountdown <= 0) {
      setResumeCountdown(null);
      resumeRound();
      return;
    }

    countdownTimeoutRef.current = window.setTimeout(() => {
      setResumeCountdown((previous) => (previous === null ? null : previous - 1));
      countdownTimeoutRef.current = null;
    }, 1000);

    return () => {
      if (countdownTimeoutRef.current !== null) {
        window.clearTimeout(countdownTimeoutRef.current);
        countdownTimeoutRef.current = null;
      }
    };
  }, [resumeCountdown]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const target = event.target;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        (target instanceof HTMLElement && target.isContentEditable)
      ) {
        return;
      }

      if (event.code !== "Space") return;

      if (duelLevel !== null || resumeCountdown !== null || isGameOver) {
        event.preventDefault();
        return;
      }

      event.preventDefault();

      if (isRunning) {
        jump();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [duelLevel, isGameOver, isRunning, resumeCountdown]);

  useEffect(() => {
    function handleFullscreenChange() {
      setIsFullscreen(document.fullscreenElement === fullscreenRef.current);
    }

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  useEffect(() => {
    if (!isGameOver) return;
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
  }, [isGameOver]);

  useEffect(() => {
    return () => {
      stopLoop();
      if (doubleJumpTimeoutRef.current !== null) {
        window.clearTimeout(doubleJumpTimeoutRef.current);
      }
      if (countdownTimeoutRef.current !== null) {
        window.clearTimeout(countdownTimeoutRef.current);
      }
    };
  }, []);

  return (
    <>
    <SectionCard title="Klouno šuolis" description="Mini žaidimukas apačioje: kompiuteryje šok su Space, telefone spausk mygtuką ir rink taškus.">
        <div className={`game-shell${isFullscreen ? " fullscreen" : ""}`} ref={fullscreenRef}>
        <div className="game-stage-card">
          <div className="game-stage-head">
            <div>
              <strong>Taškai: {totalScore}</strong>
                <p>{isGameOver ? "Atsitrenkei į kliūtį. Gali bandyti dar kartą." : duelLevel !== null ? `Pasiekei ${duelLevel} lygį. Sužaisk prieš kompiuterį pele arba pirštu ir bandyk pasiimti +20 taškų.` : isRunning ? "Šuolis trumpas ir tikras: žemas kliūtis peršok, o pro ore esančias figūras pralįsk likdamas ant žemės. Gali atlikti ir dvigubą šuolį, bet po jo reikės pilnai nusileisti." : "Paspausk Pradėti žaidimą."}</p>
            </div>
            <div className="game-chip">Top: {bestScore}</div>
          </div>

            <div className={`game-stage stage-theme-${themeLevel}${duelLevel !== null ? " duel-active" : ""}${hitFlash ? " hit-flash" : ""}`} role="img" aria-label="Klouno šuolio mini žaidimas">
              <button aria-label={isFullscreen ? "Išeiti iš pilno ekrano" : "Rodyti per visą ekraną"} className="game-fullscreen-toggle" type="button" onClick={toggleFullscreen}>
                {isFullscreen ? "⤢" : "⛶"}
              </button>
            <div className="game-level-badge">
              <span>Lygis {level}</span>
              <span className="game-heart-row" aria-label={`Gyvybės ${lives} iš 3`}>
                {Array.from({ length: 3 }).map((_, index) => (
                  <span className={index < lives ? "game-heart active" : "game-heart"} key={index}>
                    ❤
                  </span>
                ))}
              </span>
            </div>
            <div className="game-distance-badge">{Math.floor(distance)} m</div>
            <div className="game-coins-badge">Bonusai: {coins}</div>
            {slowdownActive ? <div className="game-power-badge slowdown">🎈 Lėčiau</div> : null}
            {giantMode ? <div className="game-power-badge giant">🍄 Mega</div> : null}
            {shrinkMode ? <div className="game-power-badge shadow">⬤ Mini</div> : null}
            <div className={`${playerY > 4 ? "clown-runner jumping" : "clown-runner"}${giantMode ? " giant" : ""}${shrinkMode ? " tiny" : ""}${doubleJumpFlash ? " double-jump" : ""}`} style={{ transform: `translateY(${-playerY}px)` }}>
              <span className="clown-face">🤡</span>
              <span aria-hidden="true" className="clown-legs">
                <span className="left-leg" />
                <span className="right-leg" />
              </span>
              {doubleJumpFlash ? <span aria-hidden="true" className="double-jump-burst">✦</span> : null}
            </div>
            {bonuses.map((bonus) => (
              <div className={`game-bonus ${bonus.type}`} key={bonus.id} style={{ left: `${bonus.x}%`, bottom: `${bonus.y + 28}px` }}>
                <span>{bonus.label}</span>
              </div>
            ))}
            {obstacles.map((obstacle) => (
              <div className={`game-obstacle ${obstacle.lane} ${obstacle.size} ${obstacle.variant}`} key={obstacle.id} style={{ left: `${obstacle.x}%` }}>
                <span>{obstacle.label}</span>
              </div>
            ))}
            {duelLevel !== null ? (
              <div className="duel-overlay">
                <div className="duel-card">
                  <strong>Lygio dvikova</strong>
                  <p>{duelResult ? duelRevealed ? "Rezultatas jau aiškus." : "Kompiuteris renkasi..." : `Pasiekei ${duelLevel} lygį. Rinkis akmenį, popierių arba žirkles.`}</p>
                  {!duelResult ? (
                    <div className="duel-choices">
                      {duelChoices.map((choice) => (
                        <button className="duel-choice" key={choice.id} type="button" onClick={() => playDuel(choice.id)}>
                          <span>{choice.emoji}</span>
                          <small>{choice.label}</small>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className={`duel-result ${duelResult.outcome}${duelRevealed ? " revealed" : ""}`}>
                      {duelResult.outcome === "win" && duelRevealed ? (
                        <div className="duel-confetti" aria-hidden="true">
                          {Array.from({ length: 16 }).map((_, index) => (
                            <span key={index} style={{ left: `${8 + index * 5.6}%`, animationDelay: `${(index % 5) * 0.06}s` }} />
                          ))}
                        </div>
                      ) : null}
                      <div>
                        Tu: {duelChoices.find((choice) => choice.id === duelResult.player)?.emoji} {duelChoices.find((choice) => choice.id === duelResult.player)?.label}
                      </div>
                      <div>
                        Kompiuteris: {duelRevealed ? `${duelChoices.find((choice) => choice.id === duelResult.cpu)?.emoji} ${duelChoices.find((choice) => choice.id === duelResult.cpu)?.label}` : "renkasi..." }
                      </div>
                      <strong>
                        {duelResult.outcome === "win" ? "Laimėjai +20 tšk." : duelResult.outcome === "draw" ? "Lygiosios - žaidžiam dar kartą" : "Šį kartą laimėjo kompiuteris"}
                      </strong>
                      <small>{duelResult.outcome === "win" ? "🎉 Gavai +20 taškų ir 1 papildomą gyvybę." : duelResult.outcome === "lose" ? "☹️ Bonuso šį kartą nėra, bet tęsi toliau." : "Paspausk tęsti ir mesime dar kartą."}</small>
                      <button className="primary-button" type="button" onClick={continueAfterDuel}>
                        {duelResult.outcome === "draw" ? "Mesti dar kartą" : "Tęsti žaidimą"}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ) : null}
            {resumeCountdown !== null ? (
              <div className="resume-countdown-overlay">
                <div className="resume-countdown-card">
                  <strong>Pasiruošk</strong>
                  <span>{resumeCountdown}</span>
                </div>
              </div>
            ) : null}
            {isGameOver ? (
              <div className="game-over-overlay">
                <div className="game-over-card">
                  <strong>Game Over</strong>
                  <p>Rezultatas: {totalScore} tšk. ({score} bazė + {coins} bonusų)</p>
                  <button className="primary-button" type="button" onClick={startGame}>
                    Bandyti dar kartą
                  </button>
                  {savedForScore === totalScore ? (
                    <small className="game-over-note success">Rezultatas įrašytas į rekordų lentą.</small>
                  ) : qualifiesForTopFive ? (
                    <>
                      <button className="secondary-button" type="button" onClick={() => setScoreSaveOpen(true)}>
                        Įrašyti vardą rekordui
                      </button>
                      <small className="game-over-note">Šis rezultatas patenka į Top 5, gali jį išsaugoti.</small>
                    </>
                  ) : (
                    <small className="game-over-note muted">Rezultatas šiuo metu nepatenka į Top 5.</small>
                  )}
                </div>
              </div>
            ) : null}
          </div>

          <div className="game-controls">
            <button className="primary-button" disabled={duelLevel !== null || resumeCountdown !== null} type="button" onClick={isRunning ? jump : startGame}>
              {resumeCountdown !== null ? "Skaičiuojam..." : duelLevel !== null ? "Dvikova vyksta" : isRunning ? "Šokti" : "Pradėti žaidimą"}
            </button>
            <button className="ghost-button" disabled={duelLevel !== null || resumeCountdown !== null} type="button" onClick={startGame}>
              Žaisti iš naujo
            </button>
          </div>
        </div>

        <div className="game-side">
          <div className="payment-note">
            <strong>Kaip žaisti</strong>
              <p>Kompiuteryje naudok `Space`, kai žaidimas jau vyksta, o telefone spausk mygtuką „Šokti“. Žemėje esančias figūras reikia peršokti, o ore kabančių kliūčių kaip tik neliesti šuoliu. Ore gali atlikti dar vieną papildomą šuolį.</p>
            </div>

            <div className="payment-note">
              <strong>Bonusai ir tempas</strong>
              <p>
                Lygiai dabar ilgesni: pirmas lėčiausias, antras kiek greitesnis, trečias dar
                greitesnis ir taip toliau. Tarp lygių vyksta dvikova „akmuo, popierius, žirklės“ su
                kompiuteriu.
              </p>
              <p>
                Laimėjęs dvikovą gauni papildomų taškų ir vieną gyvybę. Gyvybės rodomos prie lygio,
                o maksimaliai jų gali sukaupti tris.
              </p>
              <p>
                Bonusai taip pat prisideda prie bendro rezultato: geltoni bonusai kelia taškus,
                balionas kuriam laikui sulėtina tempą, grybukas padidina klouną, o juodas bonusas
                kelioms sekundėms labai sumažina klouną.
              </p>
            </div>

          <div className="payment-note">
            <strong>Išsaugoti rezultatą</strong>
            <div className="stack">
              <input value={playerName} onChange={(event) => setPlayerName(event.target.value)} placeholder="Tavo vardas rezultatui" />
              <button className="secondary-button" disabled={!playerName.trim() || totalScore <= 0 || savedForScore === totalScore} type="button" onClick={saveScore}>
                {savedForScore === totalScore ? "Rezultatas išsaugotas" : "Išsaugoti taškus"}
              </button>
            </div>
          </div>

          <div className="leaderboard-card">
            <div className="vote-result-head">
              <strong>Dalyvių rekordai</strong>
              <span>Top {LEADERBOARD_SIZE}</span>
            </div>
            <div className="stack">
              {topScores.length === 0 ? (
                <div className="empty-state">Kol kas dar nėra nei vieno rezultato.</div>
              ) : (
                topScores.map((entry, index) => (
                  <div className="leaderboard-row" key={entry.id}>
                    <span className={`leaderboard-place place-${index + 1}`}>
                      {index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : `#${index + 1}`}
                    </span>
                    <strong>{entry.name}</strong>
                    <span>{entry.score} tšk.</span>
                  </div>
                ))
              )}
            </div>
            <div className="leaderboard-prize-note">
              Per vakarėlį bus teikiami prizai žaidimo `1`, `2` ir `3` vietų laimėtojams.
            </div>
          </div>
          </div>
        </div>
      </SectionCard>
      <Modal
        open={scoreSaveOpen}
        title="Įrašyti vardą rekordui"
        description="Jei tavo rezultatas patenka į Top 5, gali jį išsaugoti rekordų lentai."
        onClose={() => setScoreSaveOpen(false)}
      >
        <div className="stack">
          <input
            value={playerName}
            onChange={(event) => setPlayerName(event.target.value)}
            placeholder="Įrašyk vardą rekordui"
          />
          <div className="modal-actions">
            <button className="ghost-button" type="button" onClick={() => setScoreSaveOpen(false)}>
              Uždaryti
            </button>
            <button
              className="secondary-button"
              disabled={!playerName.trim() || savedForScore === totalScore || !qualifiesForTopFive}
              type="button"
              onClick={saveScore}
            >
              {savedForScore === totalScore ? "Rezultatas išsaugotas" : "Išsaugoti savo taškus"}
            </button>
          </div>
          {!qualifiesForTopFive ? <small className="game-over-note muted">Rezultatas šiuo metu nepatenka į Top 5.</small> : null}
        </div>
      </Modal>
    </>
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
  const [deletedReservationIds, setDeletedReservationIds] = useState<number[]>([]);

  const [registerOpen, setRegisterOpen] = useState(false);
  const [myTicketOpen, setMyTicketOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [voteOpen, setVoteOpen] = useState(false);
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [paymentInfoOpen, setPaymentInfoOpen] = useState(false);

  const [adminUnlocked, setAdminUnlocked] = useState(false);
  const [adminPin, setAdminPin] = useState("");
  const [adminUnlocking, setAdminUnlocking] = useState(false);
  const [backupCreating, setBackupCreating] = useState(false);
  const [backupMessage, setBackupMessage] = useState("");
  const [submitted, setSubmitted] = useState<Reservation | null>(null);
  const [lookup, setLookup] = useState("");
  const [cancelLookup, setCancelLookup] = useState("");
  const [transferLookup, setTransferLookup] = useState("");
  const [myLookup, setMyLookup] = useState("");
  const [rideRequestOpen, setRideRequestOpen] = useState(false);
  const [rideRequestLookup, setRideRequestLookup] = useState("");
  const [rideBookingDriverId, setRideBookingDriverId] = useState<number | null>(null);
  const [rideBookingLookup, setRideBookingLookup] = useState("");
  const [selectedRidePassengerId, setSelectedRidePassengerId] = useState("");
  const [scannerValue, setScannerValue] = useState("");
  const [doorNotice, setDoorNotice] = useState<Notice | null>(null);
  const [songForm, setSongForm] = useState({ title: "", url: "" });
  const [songPreviewLoading, setSongPreviewLoading] = useState(false);
  const [deviceSongVotes, setDeviceSongVotes] = useState<Record<string, "like" | "dislike">>({});
  const [ideaForm, setIdeaForm] = useState("");
  const [activePanel, setActivePanel] = useState<PublicPanel>("guests");
  const [pendingCancel, setPendingCancel] = useState<PendingCancel>(null);
  const [pendingDelete, setPendingDelete] = useState<PendingDelete>(null);
  const [pendingRideCancel, setPendingRideCancel] = useState<PendingRideCancel>(null);
  const [registerStep, setRegisterStep] = useState<"details" | "payment">("details");
  const [pendingRegistration, setPendingRegistration] = useState<Reservation | null>(null);
  const [privacyTouched, setPrivacyTouched] = useState(false);
  const [invitationCodeTouched, setInvitationCodeTouched] = useState(false);
  const [rideSeatsTouched, setRideSeatsTouched] = useState(false);
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
  const syncedStateRef = useRef<Record<string, string>>({});
  const remoteStateLoadedRef = useRef(false);
  const [voteVoterLookup, setVoteVoterLookup] = useState("");
  const [selectedVoterId, setSelectedVoterId] = useState("");
  const [selectedVoteCategory, setSelectedVoteCategory] = useState("");
  const [voteTargetLookup, setVoteTargetLookup] = useState("");
  const [voteStep, setVoteStep] = useState<1 | 2 | 3>(1);
  const [form, setForm] = useState({
    city: "",
    contactPhone: "",
    contactEmail: "",
    invitationCode: "",
    discountCode: "",
    canOfferRide: false,
    rideSeats: "",
    needsRide: false,
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
            deletedReservationIds?: number[];
          } | null;
        };

        if (ignore) {
          setHydrated(true);
          return;
        }

        const parsed = data.payload ?? {};
        const rawReservations = Array.isArray(parsed.reservations) ? parsed.reservations : [];
        const rawWaitingList = Array.isArray(parsed.waitingList) ? parsed.waitingList : [];
        const rawSongSuggestions = Array.isArray(parsed.songSuggestions) ? parsed.songSuggestions : [];
        const rawEventIdeas = Array.isArray(parsed.eventIdeas) ? parsed.eventIdeas : [];
        const rawResponsiblePeople = Array.isArray(parsed.responsiblePeople) ? parsed.responsiblePeople : initialResponsiblePeople;
        const rawGameScores = Array.isArray(parsed.gameScores) ? parsed.gameScores : [];
        const nextDeletedReservationIds = Array.isArray(parsed.deletedReservationIds)
          ? parsed.deletedReservationIds.map(Number).filter(Number.isFinite)
          : [];

        const nextReservations = normalizeReservations(rawReservations);
        const nextWaitingList = normalizeWaitingList(rawWaitingList);
        const nextNotifications = parsed.notifications ?? [];
        const nextTransfers = parsed.transfers ?? [];
        const nextVotes = parsed.votes ?? [];
        const nextSongSuggestions = normalizeSongSuggestions(rawSongSuggestions);
        const nextEventIdeas = normalizeEventIdeas(rawEventIdeas);
        const nextResponsiblePeople = rawResponsiblePeople;
        const nextGameScores = normalizeGameScores(rawGameScores);

        setReservations(nextReservations);
        setWaitingList(nextWaitingList);
        setNotifications(nextNotifications);
        setTransfers(nextTransfers);
        setVotes(nextVotes);
        setSongSuggestions(nextSongSuggestions);
        setEventIdeas(nextEventIdeas);
        setResponsiblePeople(nextResponsiblePeople);
        setGameScores(nextGameScores);
        setDeletedReservationIds(nextDeletedReservationIds);

        syncedStateRef.current = {
          reservations: JSON.stringify(nextReservations),
          waitingList: JSON.stringify(nextWaitingList),
          notifications: JSON.stringify(nextNotifications),
          transfers: JSON.stringify(nextTransfers),
          votes: JSON.stringify(nextVotes),
          songSuggestions: JSON.stringify(nextSongSuggestions),
          eventIdeas: JSON.stringify(nextEventIdeas),
          responsiblePeople: JSON.stringify(nextResponsiblePeople),
          gameScores: JSON.stringify(nextGameScores),
          deletedReservationIds: JSON.stringify(nextDeletedReservationIds),
        };
        remoteStateLoadedRef.current = true;
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
    try {
      const savedVotes = window.localStorage.getItem(SONG_VOTES_STORAGE_KEY);
      if (!savedVotes) return;
      const parsedVotes = JSON.parse(savedVotes);
      if (parsedVotes && typeof parsedVotes === "object" && !Array.isArray(parsedVotes)) {
        setDeviceSongVotes(parsedVotes as Record<string, "like" | "dislike">);
      }
    } catch (error) {
      console.error("Failed to load device song votes", error);
    }
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    if (!remoteStateLoadedRef.current) return;
    const controller = new AbortController();
    const currentPayload = {
      reservations,
      waitingList,
      notifications,
      transfers,
      votes,
      songSuggestions,
      eventIdeas,
      responsiblePeople,
      gameScores,
      deletedReservationIds,
    };

    const changedPayload = Object.fromEntries(
      Object.entries(currentPayload).filter(([key, value]) => syncedStateRef.current[key] !== JSON.stringify(value)),
    );

    if (Object.keys(changedPayload).length === 0) {
      return () => controller.abort();
    }

    const saveTimer = window.setTimeout(() => {
      const sectionUpdatedAt = Object.fromEntries(Object.keys(changedPayload).map((key) => [key, Date.now()]));
      const changedIds = Object.fromEntries(
        Object.entries(changedPayload)
          .map(([key, value]) => [key, changedRecordIds(syncedStateRef.current[key], value)])
          .filter(([, ids]) => Array.isArray(ids) && ids.length > 0),
      );

      void fetch("/api/state", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          payload: changedPayload,
          sectionUpdatedAt,
          changedIds,
          adminPin: adminUnlocked ? adminPin : undefined,
        }),
        signal: controller.signal,
      })
        .then((response) => {
          if (!response.ok) {
            throw new Error("Failed to save remote state");
          }

          Object.entries(changedPayload).forEach(([key, value]) => {
            syncedStateRef.current[key] = JSON.stringify(value);
          });
        })
        .catch((error) => {
          if (error.name !== "AbortError") {
            console.error("Failed to save remote state", error);
          }
        });
    }, 800);

    return () => {
      window.clearTimeout(saveTimer);
      controller.abort();
    };
  }, [adminPin, adminUnlocked, deletedReservationIds, eventIdeas, gameScores, hydrated, notifications, reservations, responsiblePeople, songSuggestions, transfers, votes, waitingList]);

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
  const visibleGuestReservations = useMemo(
    () => activeReservations.filter((reservation) => reservation.paid).sort((a, b) => paidTimestamp(b) - paidTimestamp(a)),
    [activeReservations],
  );
  const paidReservations = useMemo(() => activeReservations.filter((reservation) => reservation.paid), [activeReservations]);
  const occupied = useMemo(() => activeReservations.reduce((sum, reservation) => sum + counts(reservation).total, 0), [activeReservations]);
  const remaining = Math.max(0, MAX_PLACES - occupied);
  const totalPaidSeats = useMemo(() => paidReservations.reduce((sum, reservation) => sum + counts(reservation).total, 0), [paidReservations]);
  const totalArrived = useMemo(() => activeReservations.reduce((sum, reservation) => sum + counts(reservation).arrived, 0), [activeReservations]);
  const totalAdults = useMemo(() => activeReservations.reduce((sum, reservation) => sum + counts(reservation).adults, 0), [activeReservations]);
  const totalChildren = useMemo(() => activeReservations.reduce((sum, reservation) => sum + counts(reservation).children, 0), [activeReservations]);
  const totalBankChosen = useMemo(
    () => activeReservations.reduce((sum, reservation) => sum + ((reservation.paymentMethod ?? reservation.preferredPaymentMethod) === "bank" ? counts(reservation).total : 0), 0),
    [activeReservations],
  );
  const totalCashChosen = useMemo(
    () => activeReservations.reduce((sum, reservation) => sum + ((reservation.paymentMethod ?? reservation.preferredPaymentMethod) === "cash" ? counts(reservation).total : 0), 0),
    [activeReservations],
  );
  const formDiscountActive = useMemo(() => form.discountCode.trim().toLowerCase() === VOLUNTEER_DISCOUNT_CODE, [form.discountCode]);
  const formBaseTotal = useMemo(() => form.people.filter((person) => person.type === "adult").length * ADULT_PRICE, [form.people]);
  const formTotal = useMemo(
    () => (formDiscountActive ? Math.max(0, formBaseTotal - (formBaseTotal * VOLUNTEER_DISCOUNT_PERCENT) / 100) : formBaseTotal),
    [formBaseTotal, formDiscountActive],
  );
  const myReservation = useMemo(() => lookupReservation(activeReservations, myLookup), [activeReservations, myLookup]);
  const rideRequestReservation = useMemo(() => lookupReservation(activeReservations, rideRequestLookup), [activeReservations, rideRequestLookup]);
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
        .sort((a, b) => paidTimestamp(b) - paidTimestamp(a)),
    [activeReservations],
  );
  const rideOffers = useMemo(
    () =>
      activeReservations
        .filter((reservation) => (reservation.rideOfferSeats ?? 0) > 0)
        .map((reservation) => {
          const active = activePeople(reservation);
          const firstPerson = active[0];
          const label = firstPerson
            ? maskName(firstPerson.firstName, firstPerson.lastName)
            : reservation.contactEmail;
          const booked = Array.isArray(reservation.rideReservations) ? reservation.rideReservations : [];
          const seats = reservation.rideOfferSeats ?? 0;
          const availableSeats = Math.max(0, seats - booked.length);

          return {
            id: reservation.id,
            label,
            city: reservation.city,
            seats,
            availableSeats,
            booked,
            phone: reservation.contactPhone,
            createdAt: reservation.createdAt,
          };
        })
        .sort((a, b) => b.availableSeats - a.availableSeats || Date.parse(b.createdAt) - Date.parse(a.createdAt)),
    [activeReservations],
  );
  const rideBookingDriver = useMemo(
    () => rideOffers.find((offer) => offer.id === rideBookingDriverId) ?? null,
    [rideBookingDriverId, rideOffers],
  );
  const bookedPassengerIds = useMemo(
    () => new Set(activeReservations.flatMap((reservation) => reservation.rideReservations?.map((booking) => booking.passengerPersonId) ?? [])),
    [activeReservations],
  );
  const rideBookingMatches = useMemo(() => {
    const query = rideBookingLookup.trim().toLowerCase();
    if (!query || !rideBookingDriver) return [];

    return activeReservations.flatMap((reservation) =>
      activePeople(reservation)
        .filter((person) => {
          if (reservation.id === rideBookingDriver.id) return false;
          const personName = fullName(person).toLowerCase();
          const contact = `${reservation.contactPhone} ${reservation.contactEmail}`.toLowerCase();
          return personName.includes(query) || person.firstName.toLowerCase().includes(query) || person.lastName.toLowerCase().includes(query) || contact.includes(query);
        })
        .map((person) => ({
          reservationId: reservation.id,
          personId: person.id,
          name: fullName(person),
          maskedName: maskName(person.firstName, person.lastName),
          city: reservation.city,
          alreadyBooked: bookedPassengerIds.has(person.id),
        })),
    );
  }, [activeReservations, bookedPassengerIds, rideBookingDriver, rideBookingLookup]);
  const rideRequests = useMemo(
    () =>
      activeReservations
        .filter((reservation) => reservation.needsRide)
        .map((reservation) => {
          const active = activePeople(reservation);
          const firstPerson = active[0];
          const label = firstPerson ? maskName(firstPerson.firstName, firstPerson.lastName) : reservation.contactEmail;

          return {
            id: reservation.id,
            label,
            city: reservation.city,
            phone: reservation.contactPhone,
            email: reservation.contactEmail,
            createdAt: reservation.createdAt,
          };
        })
        .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)),
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

  async function addSongSuggestion() {
    const title = songForm.title.trim();
    const url = songForm.url.trim();
    if (!url) return;

    const lowerUrl = url.toLowerCase();
    let source = "Kita";
    if (lowerUrl.includes("spotify")) source = "Spotify";
    if (lowerUrl.includes("youtube") || lowerUrl.includes("youtu.be")) source = "YouTube";

    let previewTitle = "";
    setSongPreviewLoading(true);
    try {
      const response = await fetch(`/api/link-preview?url=${encodeURIComponent(url)}`, { cache: "no-store" });
      if (response.ok) {
        const data = (await response.json()) as { title?: string; source?: string };
        previewTitle = data.title?.trim() ?? "";
        if (data.source === "Spotify" || data.source === "YouTube") {
          source = data.source;
        }
      }
    } catch (error) {
      console.error("Failed to load song preview", error);
    } finally {
      setSongPreviewLoading(false);
    }

    setSongSuggestions((previous) => [{ id: createNumericId(), title, previewTitle, url, source, likes: 0, dislikes: 0 }, ...previous]);
    setSongForm({ title: "", url: "" });
  }

  function voteSongSuggestion(id: number, vote: "like" | "dislike") {
    if (deviceSongVotes[String(id)]) {
      setDoorNotice({ type: "warning", text: "Iš šio įrenginio už šią dainą jau balsuota." });
      return;
    }

    setSongSuggestions((previous) =>
      previous.map((suggestion) =>
        suggestion.id === id
          ? {
              ...suggestion,
              likes: vote === "like" ? (suggestion.likes ?? 0) + 1 : suggestion.likes ?? 0,
              dislikes: vote === "dislike" ? (suggestion.dislikes ?? 0) + 1 : suggestion.dislikes ?? 0,
            }
          : suggestion,
      ),
    );
    setDeviceSongVotes((previous) => {
      const nextVotes = { ...previous, [String(id)]: vote };
      try {
        window.localStorage.setItem(SONG_VOTES_STORAGE_KEY, JSON.stringify(nextVotes));
      } catch (error) {
        console.error("Failed to save device song vote", error);
      }
      return nextVotes;
    });
  }

  function addEventIdea() {
    const text = ideaForm.trim();
    if (!text) return;
    setEventIdeas((previous) => [{ id: createNumericId(), text }, ...previous]);
    setIdeaForm("");
  }

  function updateResponsiblePerson(id: number, field: keyof ResponsiblePerson, value: string) {
    setResponsiblePeople((previous) => previous.map((item) => (item.id === id ? { ...item, [field]: value } : item)));
  }

  function resetRegistrationForm() {
    setForm({
      city: "",
      contactPhone: "",
      contactEmail: "",
      invitationCode: "",
      discountCode: "",
      canOfferRide: false,
      rideSeats: "",
      needsRide: false,
      consentAccepted: false,
      people: [createEmptyPerson()],
    });
    setRegisterStep("details");
    setPrivacyTouched(false);
    setInvitationCodeTouched(false);
    setRideSeatsTouched(false);
  }

  function buildReservationFromForm(id = createNumericId(), createdAt = formatDateTime(), existingReservation?: Reservation | null): Reservation | null {
    const people = form.people
      .filter((person) => person.firstName.trim())
      .map((person, index) => ({
        id: `${id}-${index + 1}`,
        firstName: person.firstName.trim(),
        lastName: person.lastName.trim(),
        type: person.type,
        active: true,
        arrived: false,
        arrivedAt: null,
      }));

    if (!people.length) return null;

    return {
      id,
      city: form.city.trim(),
      contactPhone: form.contactPhone.trim(),
      contactEmail: form.contactEmail.trim(),
      qrCode: qrFromId(id),
      paid: false,
      paymentMethod: null,
      paidAt: null,
      preferredPaymentMethod: "bank",
      createdAt,
      discountPercent: formDiscountActive ? VOLUNTEER_DISCOUNT_PERCENT : 0,
      rideOfferSeats: form.canOfferRide ? Number(form.rideSeats) : null,
      rideReservations: existingReservation?.rideReservations ?? [],
      needsRide: form.needsRide,
      adminNote: "",
      people,
    };
  }

  function savePendingRegistration() {
    const existingReservation = pendingRegistration ? reservations.find((reservation) => reservation.id === pendingRegistration.id) : null;
    const reservation = buildReservationFromForm(existingReservation?.id, existingReservation?.createdAt, existingReservation);
    if (!reservation) return null;

    const existingCount = existingReservation ? counts(existingReservation).total : 0;
    if (occupied - existingCount + counts(reservation).total > MAX_PLACES) {
      setWaitingList((previous) => [
        {
          id: reservation.id,
          city: reservation.city,
          contactPhone: reservation.contactPhone,
          contactEmail: reservation.contactEmail,
          rideOfferSeats: reservation.rideOfferSeats,
          needsRide: reservation.needsRide,
          people: reservation.people,
          createdAt: reservation.createdAt,
        },
        ...previous,
      ]);
      setSubmitted(null);
      setPendingRegistration(null);
      resetRegistrationForm();
      setRegisterOpen(false);
      return null;
    }

    setReservations((previous) => {
      if (previous.some((item) => item.id === reservation.id)) {
        return previous.map((item) => (item.id === reservation.id ? reservation : item));
      }

      return [reservation, ...previous];
    });

    if (!existingReservation) {
      setNotifications((previous) => [
        {
          id: createNumericId(),
          message: `Gauta nauja rezervacija: ${reservation.contactEmail}.${reservation.rideOfferSeats ? ` Siūlo ${reservation.rideOfferSeats} viet. automobilyje.` : ""}${reservation.needsRide ? " Reikia pavežimo." : ""}`,
          createdAt: formatDateTime(),
        },
        ...previous,
      ]);
    }

    setPendingRegistration(reservation);
    return reservation;
  }

  function submitReservation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (form.invitationCode.trim() !== INVITATION_CODE) {
      setInvitationCodeTouched(true);
      return;
    }
    if (form.canOfferRide && !form.rideSeats) {
      setRideSeatsTouched(true);
      return;
    }
    if (!form.consentAccepted) {
      setPrivacyTouched(true);
      return;
    }

    const reservation = savePendingRegistration();
    if (!reservation) return;

    setRegisterStep("payment");
  }

  function finalizeReservation() {
    if (!form.consentAccepted) return;
    const reservation = pendingRegistration ?? savePendingRegistration();
    if (!reservation) return;

    setSubmitted(reservation);
    setCelebratingRegistration(true);
    window.setTimeout(() => setCelebratingRegistration(false), 2200);
    resetRegistrationForm();
    setRegisterOpen(false);
    setPendingRegistration(null);
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
        { id: createNumericId(), message: `${person.firstName} ${person.lastName} atšaukė dalyvavimą.`, createdAt: formatDateTime() },
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

  function requestDeleteReservation(reservationId: number, label: string) {
    setPendingDelete({ reservationId, label });
  }

  function confirmDeleteReservation() {
    if (!pendingDelete) return;

    setReservations((previous) => previous.filter((item) => item.id !== pendingDelete.reservationId));
    setDeletedReservationIds((previous) => (previous.includes(pendingDelete.reservationId) ? previous : [...previous, pendingDelete.reservationId]));
    setNotifications((previous) => [
      {
        id: createNumericId(),
        message: `Ištrinta rezervacija: ${pendingDelete.label}.`,
        createdAt: formatDateTime(),
      },
      ...previous,
    ]);
    setPendingDelete(null);
    setDoorNotice({ type: "success", text: "Rezervacija ištrinta." });
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
        id: createNumericId(),
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
        id: createNumericId(),
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

    setReservations((previous) =>
      previous.map((item) =>
        item.id === reservationId
          ? {
              ...item,
              paid: true,
              paymentMethod,
              paidAt: new Date().toISOString(),
            }
          : item,
      ),
    );
    setNotifications((previous) => [
      { id: createNumericId(), message: `Pažymėtas apmokėjimas rezervacijai #${reservationId}.`, createdAt: formatDateTime() },
      ...previous,
    ]);
  }

  function unmarkPayment(reservationId: number) {
    setReservations((previous) =>
      previous.map((item) =>
        item.id === reservationId
          ? {
              ...item,
              paid: false,
              paymentMethod: null,
              paidAt: null,
            }
          : item,
      ),
    );
    setNotifications((previous) => [
      { id: createNumericId(), message: `Atžymėtas apmokėjimas rezervacijai #${reservationId}.`, createdAt: formatDateTime() },
      ...previous,
    ]);
  }

  function markNeedsRide(reservationId: number) {
    const reservation = reservations.find((item) => item.id === reservationId);
    const firstPerson = reservation ? activePeople(reservation)[0] : null;
    const label = firstPerson ? `${firstPerson.firstName} ${firstPerson.lastName}`.trim() : reservation?.contactEmail ?? "Svečias";

    setReservations((previous) =>
      previous.map((item) =>
        item.id === reservationId
          ? {
              ...item,
              needsRide: true,
              rideOfferSeats: null,
            }
          : item,
      ),
    );
    setNotifications((previous) => [
      {
        id: createNumericId(),
        message: `${label} pažymėjo, kad reikia pavežimo.`,
        createdAt: formatDateTime(),
      },
      ...previous,
    ]);
    setRideRequestLookup("");
    setRideRequestOpen(false);
    setDoorNotice({ type: "success", text: "Pavežimo poreikis pažymėtas." });
  }

  function openRideBooking(driverId: number) {
    setRideBookingDriverId(driverId);
    setRideBookingLookup("");
    setSelectedRidePassengerId("");
  }

  function closeRideBooking() {
    setRideBookingDriverId(null);
    setRideBookingLookup("");
    setSelectedRidePassengerId("");
  }

  function reserveRideSeat() {
    if (!rideBookingDriver) return;
    const selected = rideBookingMatches.find((match) => `${match.reservationId}:${match.personId}` === selectedRidePassengerId);
    if (!selected) {
      setDoorNotice({ type: "warning", text: "Pirma pasirink žmogų, kuriam rezervuojama vieta." });
      return;
    }
    if (selected.alreadyBooked) {
      setDoorNotice({ type: "warning", text: "Šis dalyvis jau turi rezervuotą transporto vietą." });
      return;
    }
    if (rideBookingDriver.availableSeats <= 0) {
      setDoorNotice({ type: "warning", text: "Pas šį vairuotoją laisvų vietų nebėra." });
      return;
    }

    const now = formatDateTime();
    const booking: RideReservation = {
      passengerReservationId: selected.reservationId,
      passengerPersonId: selected.personId,
      passengerName: selected.maskedName,
      createdAt: now,
    };

    setReservations((previous) =>
      previous.map((reservation) =>
        reservation.id === rideBookingDriver.id
          ? {
              ...reservation,
              rideReservations: [...(reservation.rideReservations ?? []), booking],
            }
          : reservation,
      ),
    );
    setNotifications((previous) => [
      {
        id: createNumericId(),
        message: `${selected.maskedName} rezervavo transporto vietą pas ${rideBookingDriver.label}.`,
        createdAt: now,
      },
      ...previous,
    ]);
    setDoorNotice({ type: "success", text: `Vieta rezervuota pas ${rideBookingDriver.label}.` });
    closeRideBooking();
  }

  function confirmRideSeatCancellation() {
    if (!pendingRideCancel) return;
    const now = formatDateTime();

    setReservations((previous) =>
      previous.map((reservation) =>
        reservation.id === pendingRideCancel.driverId
          ? {
              ...reservation,
              rideReservations: (reservation.rideReservations ?? []).filter((booking) => booking.passengerPersonId !== pendingRideCancel.passengerPersonId),
            }
          : reservation,
      ),
    );
    setNotifications((previous) => [
      {
        id: createNumericId(),
        message: `${pendingRideCancel.passengerName} atšaukė transporto vietą pas ${pendingRideCancel.driverLabel}.`,
        createdAt: now,
      },
      ...previous,
    ]);
    setDoorNotice({ type: "success", text: "Vieta ekipaže atšaukta." });
    setPendingRideCancel(null);
  }

  function updateAdminNote(reservationId: number, adminNote: string) {
    setReservations((previous) => previous.map((item) => (item.id === reservationId ? { ...item, adminNote } : item)));
  }

  function exportReservations() {
    const rows = [
      ["ID", "QR", "Miestas", "Telefonas", "El. paštas", "Apmokėta", "Mokėjimo būdas", "Asmenų kiekis", "Atvyko", "Suma", "Sukurta", "Admin pastaba"].join(";"),
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
          reservation.adminNote.replaceAll(";", ","),
        ].join(";"),
      ),
    ];
    downloadFile("cirkas-rezervacijos.csv", rows.join("\n"), "text/csv;charset=utf-8");
  }

  async function unlockAdmin() {
    if (!adminPin.trim()) {
      setDoorNotice({ type: "warning", text: "Įvesk PIN kodą." });
      return;
    }

    setAdminUnlocking(true);
    try {
      const response = await fetch("/api/admin-auth", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ pin: adminPin }),
      });

      if (response.ok) {
        setAdminUnlocked(true);
        setDoorNotice({ type: "success", text: "Admin zona atrakinta." });
        return;
      }

      setDoorNotice({ type: "warning", text: "Neteisingas PIN kodas." });
    } catch (error) {
      console.error("Failed to unlock admin", error);
      setDoorNotice({ type: "warning", text: "Nepavyko patikrinti PIN. Pabandyk dar kartą." });
    } finally {
      setAdminUnlocking(false);
    }
  }

  async function createManualBackup() {
    if (!adminUnlocked || !adminPin.trim()) {
      setBackupMessage("Pirma atrakink admin zoną.");
      return;
    }

    setBackupCreating(true);
    setBackupMessage("Kuriama atsarginė kopija...");

    try {
      // Autosave runs shortly after admin changes; this pause helps include very recent edits.
      await new Promise((resolve) => window.setTimeout(resolve, 1100));
      const response = await fetch("/api/backup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ adminPin }),
      });

      if (!response.ok) {
        throw new Error("Backup failed");
      }

      const data = (await response.json()) as { backupDate?: string };
      const backupDate = data.backupDate ? ` (${data.backupDate})` : "";
      setBackupMessage(`Atsarginė kopija sukurta${backupDate}.`);
      setNotifications((previous) => [
        { id: createNumericId(), message: `Rankiniu būdu sukurta atsarginė kopija${backupDate}.`, createdAt: formatDateTime() },
        ...previous,
      ]);
    } catch (error) {
      console.error("Failed to create manual backup", error);
      setBackupMessage("Nepavyko sukurti atsarginės kopijos. Pabandyk dar kartą.");
    } finally {
      setBackupCreating(false);
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
        id: createNumericId(),
        categoryId: selectedVoteCategory,
        voterPersonId: selectedVoterId,
        targetPersonId,
        createdAt: now,
      },
      ...previous,
    ]);
    setNotifications((previous) => [
      {
        id: createNumericId(),
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
      [...previous, { id: createNumericId(), name, score, createdAt: now }]
        .sort((a, b) => b.score - a.score || Date.parse(b.createdAt) - Date.parse(a.createdAt))
        .slice(0, MAX_STORED_GAME_SCORES),
    );
    setNotifications((previous) => [
      { id: createNumericId(), message: `${name} išsaugojo žaidimo rezultatą: ${score} tšk.`, createdAt: now },
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
              Kviečiame į spalvingą vakarėlį, kuriame lauks žaidimai, šokiai, gera muzika, smagi
              kompanija, daug dūmų, lazerių, šviesų, didelė scena, erdvi salė ir tik smagūs potyriai.
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
              <strong>13+ m. – 8 €, vaikams iki 13 m. – nemokamai</strong>
            </div>
          </div>

          <div className="hero-gallery" aria-label="Renginio vietos nuotraukos">
            <figure className="hero-gallery-card hero-gallery-card-large">
              <img alt="Priekulės kultūros centro apšvietimas renginio metu" src="/event-gallery/priekules-apsvietimas.jpg" />
            </figure>
            <figure className="hero-gallery-card">
              <img alt="Priekulės kultūros centro salės vaizdas" src="/event-gallery/priekules-sale.jpg" />
            </figure>
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
            <p>
              Klounas, cirko direktorius, akrobatas, gimnastas, žonglierius, mimo artistas,
              stipruolis, balionų artistas, popkornų pardavėjas, bilietų tikrintojas, cukraus
              vata, cirko palapinė, kortų karalienė, lėlė, marionetė, ugnies artistas, cirko
              muzikantas, trapecijos artistas, lankų šokėja, hula-hoop artistė, vienračio
              artistas, cirko bilietas „VIP“, cirko afiša, teatro kaukė, šou atlikėjas, konfeti
              žmogus, cirko šviesų ženklas, veidrodis, „Didžiojo šou“ žvaigždė, senų laikų cirko
              personažas, cirko darbuotojas užkulisiuose, bilietų kasa, cirkas naktį, raudonai
              baltas dryžuotas personažas, liūtas, tigras, zebras, dramblys, beždžionė, arklys,
              ponis, meška, pudelis, gyvatė, papūga ir daug kitų. Tik prašome atminti, jog
              rinktumėtės tokią tematiką, kuri būtų padori ir tinkama krikščioniui.
            </p>
          </div>

          <div className="stats-grid">
            <StatCard label="Atvyko" value={`${totalArrived}/${occupied || 0}`} tone="success" />
            <StatCard label="Apmokėta vietų" value={`${totalPaidSeats}/${occupied || 0}`} tone="accent" />
            <StatCard label="Laisvų vietų" value={String(remaining)} tone="warning" />
          </div>

          <div className="hero-actions">
            <button className="primary-button" type="button" onClick={() => { setPendingRegistration(null); resetRegistrationForm(); setRegisterOpen(true); }}>
              Noriu dalyvauti
            </button>
            <button className="secondary-button" type="button" onClick={() => setMyTicketOpen(true)}>
              Mano registracijos būsena
            </button>
            <button className="secondary-button" type="button" onClick={() => setPaymentInfoOpen(true)}>
              Apmokėjimo informacija
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
                <li>Atlik bankinį apmokėjimą per Revolut ir palauk, kol organizatorius pažymės, kad mokėjimas gautas.</li>
              <li>Kai apmokėjimas bus patvirtintas, tavo vardas atsiras svečių lentoje.</li>
              <li>Per „Mano registracijos būsena“ galėsi pasitikrinti patvirtinimą ir rasti savo QR kodą įėjimui.</li>
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
          <div className="next-steps-box">
            <div>
              <span className="muted-label">Ką daryti toliau?</span>
              <h3>Tavo registracija priimta, liko keli trumpi žingsniai</h3>
            </div>
            <ol>
              <li>Atlik bankinį pavedimą pagal apmokėjimo lange pateiktus Revolut / banko duomenis.</li>
              <li>Mokėjimo paskirtyje įrašyk vardus, už kuriuos daromas pavedimas vakarėliui.</li>
              <li>Palauk, kol organizatorius admin zonoje pažymės, kad apmokėjimas gautas.</li>
              <li>Kai apmokėjimas bus patvirtintas, tavo vardas atsiras svečių lentoje.</li>
              <li>Per „Mano registracijos būsena“ galėsi pasitikrinti patvirtinimą ir rasti QR bilietą.</li>
              <li>Prisijunk prie Telegram grupės ir perskaityk skiltį „Svarbu“.</li>
              <li>Jei reikės pavežimo arba gali pavežti kitus, pažymėk tai transporto skiltyje.</li>
            </ol>
          </div>
          {!submitted.paid ? (
            <div className="post-registration-payment">
              <PaymentInformation reservation={submitted} />
            </div>
          ) : null}
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
        <button className={activePanel === "drivers" ? "panel-tab active" : "panel-tab"} type="button" onClick={() => setActivePanel("drivers")}>
          Vairuotojai, kurie turi vietos
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
              <div className="timeline-item" key={`${item.day}-${item.time}-${item.title}`}>
                <div className="timeline-time">
                  <span>{item.day}</span>
                  <strong>{item.time}</strong>
                </div>
                <div className="timeline-content">
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
            {IMPORTANT_REMINDERS.map((item) => {
              const reminder = typeof item === "string" ? { text: item, links: [] } : item;

              return (
              <div className="pill" key={reminder.text}>
                <span>{reminder.text}</span>
                {reminder.links?.length ? (
                  <div className="reminder-links">
                    {reminder.links.map((link) => (
                      <a href={link.url} key={link.url} target="_blank" rel="noreferrer">
                        {link.label}
                      </a>
                    ))}
                  </div>
                ) : null}
              </div>
            );
            })}
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
          <div className="music-board">
            <div className="music-submit-card">
              <div>
                <span className="eyebrow">Vakaro grojaraštis</span>
                <h3>Pasiūlyk dainą šokiams</h3>
                <p>Įkelk YouTube arba Spotify nuorodą. Visi svečiai galės atidaryti dainą ir balsuoti, ar ji tinka vakarėlio nuotaikai.</p>
              </div>
              <div className="music-platform-row">
                <span className="source-pill youtube">YT YouTube</span>
                <span className="source-pill spotify">SP Spotify</span>
              </div>
              <div className="form-grid">
                <Field label="Dainos pavadinimas arba komentaras">
                  <input
                    value={songForm.title}
                    onChange={(event) => setSongForm((previous) => ({ ...previous, title: event.target.value }))}
                    placeholder="Pvz. energingas šokių hitas"
                  />
                </Field>
                <Field label="YouTube arba Spotify nuoroda">
                  <input
                    value={songForm.url}
                    onChange={(event) => setSongForm((previous) => ({ ...previous, url: event.target.value }))}
                    placeholder="https://youtube.com/... arba https://open.spotify.com/..."
                  />
                </Field>
              </div>
              <button className="music-submit-button" type="button" onClick={addSongSuggestion} disabled={songPreviewLoading}>
                {songPreviewLoading ? "Tikrinama nuoroda..." : "Pasiūlyti dainą"}
              </button>
            </div>

            <div className="music-list">
              {songSuggestions.length ? (
                songSuggestions.map((item) => {
                  const source = songSourceMeta(item.source);
                  const deviceVote = deviceSongVotes[String(item.id)];
                  return (
                    <div className="music-card" key={item.id}>
                      <div className={`music-source-badge ${source.className}`}>{source.icon}</div>
                      <div className="music-card-content">
                        <div className="music-card-head">
                          <div>
                            <strong>{item.title || "Be pavadinimo"}</strong>
                            {item.previewTitle ? <span className="music-preview-title">{item.previewTitle}</span> : null}
                            <p>{source.label} nuoroda</p>
                          </div>
                          <a className="music-open-link" href={item.url} target="_blank" rel="noreferrer">
                            Atidaryti
                          </a>
                        </div>
                        <div className="music-vote-row">
                          <button className={deviceVote === "like" ? "selected" : ""} type="button" onClick={() => voteSongSuggestion(item.id, "like")} disabled={Boolean(deviceVote)}>
                            🥳 Patinka <span>{item.likes ?? 0}</span>
                          </button>
                          <button className={deviceVote === "dislike" ? "selected" : ""} type="button" onClick={() => voteSongSuggestion(item.id, "dislike")} disabled={Boolean(deviceVote)}>
                            🙁 Netinka <span>{item.dislikes ?? 0}</span>
                          </button>
                          {deviceVote ? <small className="music-vote-lock">Šis įrenginys jau balsavo</small> : null}
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="empty-state">Kol kas nėra pasiūlytų dainų. Būk pirmas, kuris įmeta vakaro hitą.</div>
              )}
            </div>

            <div className="highlight-box">
              <Field label="Idėja renginiui">
                <textarea
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
                <div className="responsible-card" key={item.id}>
                  <div className="responsible-icon" aria-hidden="true">
                    {responsibleIcon(item.role)}
                  </div>
                  <div>
                    <span className="responsible-role">{item.role || "Papildoma pareigybė"}</span>
                    <strong className="responsible-name">{item.names || "Bus papildyta"}</strong>
                  </div>
                </div>
              ))}
          </div>
        </SectionCard>
      ) : null}

      {activePanel === "drivers" ? (
        <SectionCard title="Vairuotojai, kurie turi vietos" description="Svečiai, registracijoje pažymėję, kad gali pavežti kitus į vakarėlį.">
          <div className="driver-action-panel">
            <div>
              <strong>Reikia transporto?</strong>
              <p>Jei jau užsiregistravai ir matai, kad reikės pavežimo, pasižymėk čia. Organizatorius matys poreikį admin zonoje.</p>
            </div>
            <button className="secondary-button" type="button" onClick={() => setRideRequestOpen(true)}>
              <CarIcon />
              Man reikia pavežimo
            </button>
          </div>
          <div className="driver-grid">
            {rideOffers.length ? (
              rideOffers.map((offer) => (
                <div className="driver-card" key={offer.id}>
                  <div className="driver-main-row">
                    <div className="driver-card-icon">
                      <CarIcon className="driver-icon" />
                    </div>
                    <div>
                      <strong>{offer.label}</strong>
                      <p>{offer.city || "Miestas nenurodytas"}</p>
                    </div>
                    <div className={offer.availableSeats > 0 ? "driver-seats" : "driver-seats is-full"}>
                      <span>{offer.availableSeats}</span>
                      <small>{offer.availableSeats === 1 ? "laisva vieta" : "laisvos vietos"}</small>
                    </div>
                  </div>
                  <div className="driver-reservation-strip">
                    <span>{offer.booked.length} rezervuota</span>
                    <span>Iš viso: {offer.seats}</span>
                  </div>
                  {offer.booked.length ? (
                    <div className="driver-booked-list">
                      {offer.booked.map((booking) => (
                        <span key={`${offer.id}-${booking.passengerPersonId}`}>
                          {booking.passengerName}
                          <button
                            aria-label={`Atšaukti ${booking.passengerName} vietą ekipaže`}
                            type="button"
                            onClick={() =>
                              setPendingRideCancel({
                                driverId: offer.id,
                                driverLabel: offer.label,
                                passengerPersonId: booking.passengerPersonId,
                                passengerName: booking.passengerName,
                              })
                            }
                          >
                            -
                          </button>
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="driver-empty-note">Rezervuotų vietų dar nėra.</p>
                  )}
                  <button className="driver-book-button" type="button" onClick={() => openRideBooking(offer.id)} disabled={offer.availableSeats <= 0}>
                    {offer.availableSeats > 0 ? "Rezervuoti vietą" : "Vietų nebėra"}
                  </button>
                </div>
              ))
            ) : (
              <div className="empty-state">Kol kas niekas nepažymėjo, kad gali pavežti kitus svečius.</div>
            )}
          </div>
          <div className="driver-contact-note">
            <CarIcon />
            <span>Jeigu nežinote asmens, susisiekite su organizatoriumi.</span>
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
                  <button className="primary-button" type="button" onClick={unlockAdmin} disabled={adminUnlocking}>
                    {adminUnlocking ? "Tikrinama..." : "Atrakinti QR tikrinimą"}
                  </button>
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
                      ) : (
                        <button className="ghost-button" type="button" onClick={() => unmarkPayment(foundReservation.id)}>
                          Atžymėti apmokėjimą
                        </button>
                      )}
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
                <button className="primary-button" type="button" onClick={unlockAdmin} disabled={adminUnlocking}>
                  {adminUnlocking ? "Tikrinama..." : "Atrakinti"}
                </button>
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
                <StatCard label="Pažymėta banku" value={String(totalBankChosen)} tone="accent" />
                <StatCard label="Pažymėta grynais" value={String(totalCashChosen)} tone="success" />
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
                            <div className="admin-reservation-side">
                              <button
                                aria-label={`Ištrinti rezervaciją ${reservation.qrCode}`}
                                className="admin-delete-button"
                                type="button"
                                onClick={() => requestDeleteReservation(reservation.id, reservation.qrCode)}
                              >
                                ×
                              </button>
                              <div className="admin-reservation-meta">
                                <span>{counts(reservation).total} asm.</span>
                                <span>Banku: {amount(reservation)} €</span>
                                <span>Grynais: {cashAmount(reservation)} €</span>
                              </div>
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

                        <label className="admin-note-box">
                          <span>Admin pastaba</span>
                          <textarea
                            value={reservation.adminNote}
                            onChange={(event) => updateAdminNote(reservation.id, event.target.value)}
                            placeholder="Pvz. parašė dėl transporto, sumokėjo už 2, reikia patikrinti pavedimą..."
                          />
                        </label>

                        <div className="admin-payment-row">
                          <div className="payment-status-block">
                            <strong>Laukia patikrinimo</strong>
                            <p>
                              {reservation.preferredPaymentMethod === "bank"
                                ? "Registruojantis pasirinktas bankinis pavedimas. Jei žmogus sumokėjo grynais, gali pažymėti tai ranka."
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
                            <div className="admin-reservation-side">
                              <button
                                aria-label={`Ištrinti rezervaciją ${reservation.qrCode}`}
                                className="admin-delete-button"
                                type="button"
                                onClick={() => requestDeleteReservation(reservation.id, reservation.qrCode)}
                              >
                                ×
                              </button>
                              <div className="admin-reservation-meta">
                                <span>{counts(reservation).total} asm.</span>
                                <span>Banku: {amount(reservation)} €</span>
                                <span>Grynais: {cashAmount(reservation)} €</span>
                              </div>
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

                        <label className="admin-note-box">
                          <span>Admin pastaba</span>
                          <textarea
                            value={reservation.adminNote}
                            onChange={(event) => updateAdminNote(reservation.id, event.target.value)}
                            placeholder="Pvz. ateis vėliau, keitė vietą, reikia susisiekti..."
                          />
                        </label>

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
                            <button className="ghost-button" type="button" onClick={() => unmarkPayment(reservation.id)}>
                              Atžymėti
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </SectionCard>

              <SectionCard title="Transporto vietos" description="Čia matysi, kas registruodamasis pažymėjo, kad gali pavežti kitus svečius.">
                <div className="stack">
                  {rideOffers.length === 0 ? <div className="empty-state">Kol kas dar niekas nenurodė laisvų vietų automobilyje.</div> : null}
                  {rideOffers.map((offer) => (
                    <div className="panel" key={offer.id}>
                      <strong>{offer.label}</strong>
                      <p>Miestas: {offer.city}</p>
                      <p>Telefono numeris: {offer.phone}</p>
                      <p>Laisvos vietos automobilyje: {offer.seats}</p>
                      <p className="admin-created-at">Registruota: {offer.createdAt}</p>
                    </div>
                  ))}
                </div>
              </SectionCard>

              <SectionCard title="Reikia pavežimo" description="Svečiai, kurie registracijoje arba vėliau pažymėjo, kad jiems reikia transporto.">
                <div className="stack">
                  {rideRequests.length === 0 ? <div className="empty-state">Kol kas niekas nepažymėjo, kad reikia pavežimo.</div> : null}
                  {rideRequests.map((request) => (
                    <div className="panel transport-request-panel" key={request.id}>
                      <div>
                        <strong>{request.label}</strong>
                        <p>Miestas: {request.city || "Nenurodytas"}</p>
                        <p>Telefono numeris: {request.phone}</p>
                        <p>El. paštas: {request.email}</p>
                        <p className="admin-created-at">Registruota: {request.createdAt}</p>
                      </div>
                      <CarIcon className="transport-request-icon" />
                    </div>
                  ))}
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
                <button className="primary-button" type="button" onClick={createManualBackup} disabled={backupCreating}>
                  {backupCreating ? "Kuriama kopija..." : "Daryti atsarginę kopiją"}
                </button>
              </div>
              {backupMessage ? <div className="notice success">{backupMessage}</div> : null}
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

      <footer className="site-footer">
        Šią svetainę sukūrė ir visas autorines teises turi: Ovidijus Domkus
      </footer>

      <a
        aria-label="Greitas kontaktas per WhatsApp"
        className="floating-contact"
        href="https://wa.me/37066352281"
        target="_blank"
        rel="noreferrer"
      >
        <WhatsAppIcon />
        <span>Klausti Ovidijaus</span>
      </a>

        <Modal
        open={registerOpen}
        title="Registracijos forma"
        description="Įvesk bendrus kontaktus ir visus registruojamus asmenis."
          onClose={() => {
            setRegisterOpen(false);
            setPendingRegistration(null);
            resetRegistrationForm();
          }}
      >
        <form className="stack" onSubmit={submitReservation}>
          {registerStep === "details" ? (
            <>
              <div className="form-grid three">
                <Field label="Kvietimo numeris">
                  <input
                    required
                    value={form.invitationCode}
                    onChange={(event) => {
                      setField("invitationCode", event.target.value);
                      if (event.target.value.trim() === INVITATION_CODE) {
                        setInvitationCodeTouched(false);
                      }
                    }}
                    placeholder="Įrašyk kvietimo kodą"
                  />
                </Field>
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
                <p>Savanorių nuolaidos kodas gaunamas iš organizatoriaus ir leidžiamas naudoti tik patvirtintam renginio savanoriui, kuris prisidės prie vakarėlio darbų.</p>
                {formDiscountActive ? <strong className="success-text">Savanorio nuolaida pritaikyta.</strong> : null}
              </div>

              <div className="highlight-box">
                <label className="checkbox-row">
                  <input
                    checked={form.canOfferRide}
                    onChange={(event) => {
                      const checked = event.target.checked;
                      setField("canOfferRide", checked);
                      if (checked) {
                        setField("needsRide", false);
                      }
                      if (!checked) {
                        setField("rideSeats", "");
                        setRideSeatsTouched(false);
                      }
                    }}
                    type="checkbox"
                  />
                  <span>Galiu pavežti ką nors</span>
                </label>
                {form.canOfferRide ? (
                  <Field label="Kiek laisvų vietų turi automobilyje?">
                    <select
                      value={form.rideSeats}
                      onChange={(event) => {
                        setField("rideSeats", event.target.value);
                        if (event.target.value) setRideSeatsTouched(false);
                      }}
                    >
                      <option value="">Pasirink vietų skaičių</option>
                      {Array.from({ length: 8 }, (_, index) => (
                        <option key={index + 1} value={String(index + 1)}>
                          {index + 1}
                        </option>
                      ))}
                    </select>
                  </Field>
                ) : (
                  <p>Jei turi vietos automobilyje, pažymėk šį laukelį. Tai padės organizuoti atvykimą tiems, kam reikės pavežimo.</p>
                )}
                {rideSeatsTouched && form.canOfferRide ? (
                  <div className="validation-error">Pasirinkite, kiek laisvų vietų galite pasiūlyti automobilyje.</div>
                ) : null}
                <label className="checkbox-row">
                  <input
                    checked={form.needsRide}
                    onChange={(event) => {
                      const checked = event.target.checked;
                      setField("needsRide", checked);
                      if (checked) {
                        setField("canOfferRide", false);
                        setField("rideSeats", "");
                        setRideSeatsTouched(false);
                      }
                    }}
                    type="checkbox"
                  />
                  <span>Man reikia pavežimo</span>
                </label>
                {form.needsRide ? (
                  <p>Organizatorius matys, kad tau reikia transporto, ir galės lengviau sujungti su vairuotojais.</p>
                ) : null}
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
                      <option value="child">Vaikas iki 13 m.</option>
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
              {invitationCodeTouched ? (
                <div className="validation-error">Įveskite teisingą kvietimo numerį, kad galėtumėte tęsti registraciją.</div>
              ) : null}
              {privacyTouched && !form.consentAccepted ? (
                <div className="validation-error">Pirma spustelėkite, kad sutinkate su privatumo politika.</div>
              ) : null}

                <div className="modal-actions">
                  <button
                    className="ghost-button"
                    type="button"
                    onClick={() => {
                      setRegisterOpen(false);
                      setPendingRegistration(null);
                      resetRegistrationForm();
                    }}
                  >
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

                  <div className="payment-alert">
                    Prašome nepamiršti spustelti žemiau mygtuko „Tęsti po apmokėjimo“.
                  </div>

                  <PaymentInformation reservation={pendingRegistration} />
                </div>

                <div className="modal-actions">
                  <button className="ghost-button" type="button" onClick={() => setRegisterStep("details")}>
                    Grįžti
                  </button>
                  <button className="primary-button" type="button" onClick={finalizeReservation}>
                    Tęsti po apmokėjimo
                  </button>
                </div>
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
        open={paymentInfoOpen}
        title="Apmokėjimo informacija"
        description="Jeigu registracija jau sukurta, tikslią mokėtiną sumą gali pasitikrinti per „Mano registracijos būsena“."
        onClose={() => setPaymentInfoOpen(false)}
      >
        <PaymentInformation />
      </Modal>

      <Modal
        open={myTicketOpen}
        title="Mano registracijos būsena"
        description="Įvesk savo telefoną, el. paštą, vardą arba QR kodą. Čia matysi patvirtinimą ir savo QR bilietą."
        onClose={() => setMyTicketOpen(false)}
      >
        <div className="stack">
          <input value={myLookup} onChange={(event) => setMyLookup(event.target.value)} placeholder="+370..., el. paštas arba vardas" />
          {!myLookup ? <div className="empty-state">Įvesk paieškos duomenis.</div> : null}
          {myLookup && !myReservation ? <div className="empty-state warning">Rezervacija nerasta.</div> : null}
          {myReservation ? (
            <div className="ticket-card">
              {(() => {
                const status = registrationStatus(myReservation);
                const reservationCounts = counts(myReservation);

                return (
                  <div className="ticket-status-stack">
                    <div className={`ticket-status-card ${status.tone}`}>
                      <span>Mano registracijos būsena</span>
                      <strong>{status.title}</strong>
                      <p>{status.text}</p>
                    </div>
                    <div className="ticket-status-grid">
                      <div>
                        <span>Apmokėjimas</span>
                        <strong>{myReservation.paid ? "Patvirtintas" : "Laukia patvirtinimo"}</strong>
                      </div>
                      <div>
                        <span>Dalyviai</span>
                        <strong>{reservationCounts.total} asm.</strong>
                      </div>
                      <div>
                        <span>Transportas</span>
                        <strong>
                          {myReservation.needsRide
                            ? "Reikia pavežimo"
                            : myReservation.rideOfferSeats
                              ? `Siūlo ${myReservation.rideOfferSeats} viet.`
                              : "Nepasirinkta"}
                        </strong>
                      </div>
                    </div>
                  </div>
                );
              })()}
              <strong>{myReservation.contactEmail}</strong>
              <p>QR: {myReservation.qrCode}</p>
              <div className="qr-panel">
                <QRCodeSVG value={qrPayload(myReservation)} size={190} includeMargin />
              </div>
              <p>Parodyk šį QR prie įėjimo.</p>
              {!myReservation.paid ? <PaymentInformation reservation={myReservation} /> : null}
            </div>
          ) : null}
        </div>
      </Modal>

      <Modal
        open={rideRequestOpen}
        title="Man reikia pavežimo"
        description="Surask savo registraciją ir pažymėk, kad tau reikės transporto iki vakarėlio."
        onClose={() => setRideRequestOpen(false)}
      >
        <div className="stack">
          <Field label="Paieška pagal tavo duomenis">
            <input
              value={rideRequestLookup}
              onChange={(event) => setRideRequestLookup(event.target.value)}
              placeholder="Vardas, tel. numeris arba el. paštas"
            />
          </Field>
          {!rideRequestLookup.trim() ? <div className="empty-state">Įvesk savo vardą, telefono numerį arba el. paštą.</div> : null}
          {rideRequestLookup.trim() && !rideRequestReservation ? <div className="empty-state warning">Registracija nerasta.</div> : null}
          {rideRequestReservation ? (
            <div className="ticket-card">
              <strong>{rideRequestReservation.contactEmail}</strong>
              <p>{activePeople(rideRequestReservation).map((person) => `${person.firstName} ${person.lastName}`.trim()).join(", ")}</p>
              {rideRequestReservation.needsRide ? (
                <div className="notice success">Pavežimo poreikis jau pažymėtas. Organizatorius tai matys admin zonoje.</div>
              ) : (
                <button className="primary-button" type="button" onClick={() => markNeedsRide(rideRequestReservation.id)}>
                  Pažymėti, kad man reikia pavežimo
                </button>
              )}
            </div>
          ) : null}
        </div>
      </Modal>

      <Modal
        open={Boolean(rideBookingDriver)}
        title="Rezervuoti vietą automobilyje"
        description={rideBookingDriver ? `Vairuotojas: ${rideBookingDriver.label}. Laisvų vietų: ${rideBookingDriver.availableSeats}.` : undefined}
        onClose={closeRideBooking}
      >
        <div className="stack">
          {rideBookingDriver ? (
            <div className="ride-booking-summary">
              <div className="driver-card-icon">
                <CarIcon className="driver-icon" />
              </div>
              <div>
                <strong>{rideBookingDriver.label}</strong>
                <p>{rideBookingDriver.city || "Miestas nenurodytas"}</p>
              </div>
              <div className="driver-seats compact">
                <span>{rideBookingDriver.availableSeats}</span>
                <small>laisva</small>
              </div>
            </div>
          ) : null}

          <Field label="Surask save pagal vardą, telefoną arba el. paštą">
            <input
              value={rideBookingLookup}
              onChange={(event) => {
                setRideBookingLookup(event.target.value);
                setSelectedRidePassengerId("");
              }}
              placeholder="Pvz. Jonas, +370..., el. paštas"
            />
          </Field>

          {!rideBookingLookup.trim() ? <div className="empty-state">Įvesk savo duomenis, tada pasirink savo vardą iš sąrašo.</div> : null}
          {rideBookingLookup.trim() && rideBookingMatches.length === 0 ? <div className="empty-state warning">Pagal šią paiešką registruoto dalyvio nerasta.</div> : null}

          {rideBookingMatches.length ? (
            <div className="ride-match-list">
              {rideBookingMatches.map((match) => {
                const value = `${match.reservationId}:${match.personId}`;
                return (
                  <label className={match.alreadyBooked ? "ride-match-card disabled" : "ride-match-card"} key={value}>
                    <input
                      checked={selectedRidePassengerId === value}
                      disabled={match.alreadyBooked}
                      name="ride-passenger"
                      type="radio"
                      onChange={() => setSelectedRidePassengerId(value)}
                    />
                    <span>
                      <strong>{match.name}</strong>
                      <small>{match.city || "Miestas nenurodytas"}</small>
                      {match.alreadyBooked ? <em>Jau turi rezervuotą vietą</em> : null}
                    </span>
                  </label>
                );
              })}
            </div>
          ) : null}

          <div className="modal-actions">
            <button className="ghost-button" type="button" onClick={closeRideBooking}>
              Uždaryti
            </button>
            <button className="primary-button" type="button" onClick={reserveRideSeat} disabled={!selectedRidePassengerId || !rideBookingDriver || rideBookingDriver.availableSeats <= 0}>
              Rezervuoti vietą
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        open={Boolean(pendingRideCancel)}
        title="Atšaukti vietą ekipaže?"
        description={
          pendingRideCancel
            ? `${pendingRideCancel.passengerName} rezervacija pas ${pendingRideCancel.driverLabel} bus pašalinta, o laisvų vietų skaičius padidės.`
            : undefined
        }
        onClose={() => setPendingRideCancel(null)}
      >
        <div className="stack">
          <div className="notice warning">Ar tikrai norite atšaukti vietą ekipaže?</div>
          <div className="modal-actions">
            <button className="ghost-button" type="button" onClick={() => setPendingRideCancel(null)}>
              Ne, palikti
            </button>
            <button className="danger-button" type="button" onClick={confirmRideSeatCancellation}>
              Taip, atšaukti
            </button>
          </div>
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
                Pinigai nėra grąžinami.
              </p>
              <p>
                Norint atgauti sumokėtus pinigus, reikia susikeisti su kitu žmogumi, kuris ateitų vietoj jūsų.
                Tuomet tas žmogus įėjimo mokestį sumoka jums tiesiogiai.
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

      <Modal
        open={Boolean(pendingDelete)}
        title="Ar tikrai ištrinti rezervaciją?"
        description={pendingDelete ? `Rezervacija ${pendingDelete.label} bus pašalinta visam laikui.` : undefined}
        onClose={() => setPendingDelete(null)}
      >
        <div className="stack">
          <div className="highlight-box cancel-note">
            <p>Šis veiksmas pašalins visą rezervaciją iš admin zonos, svečių lentos ir paieškų.</p>
            <p>Jei nori palikti istoriją, geriau naudok atšaukimą ar apmokėjimo žymėjimą, o ne ištrynimą.</p>
          </div>
          <div className="modal-actions">
            <button className="ghost-button" type="button" onClick={() => setPendingDelete(null)}>
              Grįžti
            </button>
            <button className="danger-button" type="button" onClick={confirmDeleteReservation}>
              Taip, ištrinti
            </button>
          </div>
        </div>
      </Modal>

    </main>
  );
}

