export type MovieSettings = {
  eventName: string;
  dateLabel: string;
  startIso: string;
  endIso: string;
  place: string;
  ticketPrice: number;
  revolutPaymentUrl: string;
  swedbankPaymentUrl: string;
  bankRecipient: string;
  bankIban: string;
  bankBic: string;
  firstMovieTitle: string;
  secondMovieTitle: string;
};

export const DEFAULT_MOVIE_SETTINGS: MovieSettings = {
  eventName: "Kviečiame jus į dviejų filmų peržiūrą",
  dateLabel: "2026 m. rugsėjo 26 d., pradžia 18:20",
  startIso: "2026-09-26T18:20:00+03:00",
  endIso: "2026-09-26T21:20:00+03:00",
  place: "Forum Cinemas Klaipėda „Akropolis“, 2 aukštas, salė Nr. 2",
  ticketPrice: 6,
  revolutPaymentUrl: "https://revolut.me/ovidij1c5",
  swedbankPaymentUrl: "https://www.swedbank.lt/pay?id=pr-hifleifwnfuq",
  bankRecipient: "Ovidijus Domkus",
  bankIban: "LT42 3250 0669 2279 1534",
  bankBic: "REVOLT21",
  firstMovieTitle: "Viliamės to, ko nematome",
  secondMovieTitle: "Tavimi, Jehova, aš pasitikiu",
};

export const MOVIE_SEAT_HOLD_SECONDS = 180;
export const MOVIE_SEAT_COUNT = 172;

function textSetting(value: unknown, fallback: string, maxLength = 240) {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, maxLength) : fallback;
}

export function normalizeMovieSettings(value: unknown): MovieSettings {
  const settings = value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
  const price = Number(settings.ticketPrice);

  return {
    eventName: textSetting(settings.eventName, DEFAULT_MOVIE_SETTINGS.eventName),
    dateLabel: textSetting(settings.dateLabel, DEFAULT_MOVIE_SETTINGS.dateLabel),
    startIso: typeof settings.startIso === "string" ? settings.startIso.trim().slice(0, 80) : "",
    endIso: typeof settings.endIso === "string" ? settings.endIso.trim().slice(0, 80) : "",
    place: textSetting(settings.place, DEFAULT_MOVIE_SETTINGS.place),
    ticketPrice: Number.isFinite(price) && price >= 0 && price <= 1000 ? Math.round(price * 100) / 100 : DEFAULT_MOVIE_SETTINGS.ticketPrice,
    revolutPaymentUrl: textSetting(settings.revolutPaymentUrl, DEFAULT_MOVIE_SETTINGS.revolutPaymentUrl, 500),
    swedbankPaymentUrl: textSetting(settings.swedbankPaymentUrl, DEFAULT_MOVIE_SETTINGS.swedbankPaymentUrl, 500),
    bankRecipient: textSetting(settings.bankRecipient, DEFAULT_MOVIE_SETTINGS.bankRecipient, 160),
    bankIban: textSetting(settings.bankIban, DEFAULT_MOVIE_SETTINGS.bankIban, 80),
    bankBic: textSetting(settings.bankBic, DEFAULT_MOVIE_SETTINGS.bankBic, 40),
    firstMovieTitle: textSetting(settings.firstMovieTitle, DEFAULT_MOVIE_SETTINGS.firstMovieTitle),
    secondMovieTitle: textSetting(settings.secondMovieTitle, DEFAULT_MOVIE_SETTINGS.secondMovieTitle),
  };
}

export function isValidMovieSeatId(value: unknown) {
  const match = /^(\d{1,2})-(\d{1,2})$/.exec(String(value ?? "").trim());
  if (!match) return false;

  const row = Number(match[1]);
  const seat = Number(match[2]);
  if (row === 1) return seat >= 6 && seat <= 15;
  if (row >= 2 && row <= 7) return seat >= 1 && seat <= 17;
  if (row >= 8 && row <= 9) return seat >= 1 && seat <= 19;
  if (row === 10) return seat >= 1 && seat <= 22;
  return false;
}
