"use client";

import { useEffect, useMemo, useReducer, useRef, useState, type TouchEvent } from "react";
import styles from "./PackingGame.module.css";

type GameScore = {
  id: number;
  name: string;
  score: number;
  createdAt: string;
  startedAt?: string;
  finishedAt?: string;
  durationMs?: number;
  verified?: boolean;
  auditSummary?: {
    customsChecks: number;
    directFlights: number;
    eventsCount: number;
    goldenTicketsUsed: number;
    lostLuggage: number;
  };
};

type PieceTemplate = {
  color: number;
  name: string;
  shape: number[][];
};

type ActivePiece = PieceTemplate & {
  col: number;
  row: number;
};

export type GameProofEvent = {
  atMs: number;
  cleared: number;
  dropPoints: number;
  goldenTicketsUsed: number;
};

export type GameScoreProof = {
  events: GameProofEvent[];
  level: number;
  lines: number;
  maxClear: number;
  maxCombo: number;
  version: 2;
  sessionToken: string;
};

type GameState = {
  active: ActivePiece | null;
  board: number[][];
  combo: number;
  effectId: number;
  gameOver: boolean;
  goldenTickets: number;
  goldenTicketsUsedPending: number;
  lastBonus: number;
  lastClear: number;
  lastClearedRows: number[];
  level: number;
  leveledUp: boolean;
  lines: number;
  maxClear: number;
  maxCombo: number;
  next: PieceTemplate | null;
  pieceDropPoints: number;
  proofEvents: GameProofEvent[];
  running: boolean;
  score: number;
  startedAtMs: number;
};

type GameAction =
  | { type: "start"; startedAtMs: number }
  | { type: "tick" }
  | { type: "move"; direction: -1 | 1 }
  | { type: "rotate" }
  | { type: "softDrop" }
  | { type: "hardDrop" }
  | { type: "useGoldenTicket"; row: number };

const BOARD_COLS = 10;
const BOARD_ROWS = 18;
const LINE_POINTS = [0, 100, 300, 500, 800];
const DIRECT_FLIGHT_BONUS = 1_200;
const CUSTOMS_INTERVAL = 10;
const LOST_LUGGAGE_INTERVAL = 14;
const GOLDEN_TICKET_INTERVAL = 24;
const PREFERENCES_KEY = "packing-game-preferences-v1";

type GamePreferences = {
  controlSide: "left" | "right";
  haptics: boolean;
  reduceEffects: boolean;
  swipeSensitivity: number;
};

const DEFAULT_PREFERENCES: GamePreferences = {
  controlSide: "right",
  haptics: true,
  reduceEffects: false,
  swipeSensitivity: 38,
};
const GAME_TIME_FORMATTER = new Intl.DateTimeFormat("lt-LT", {
  timeZone: "Europe/Vilnius",
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

const REGIONS = [
  { id: "Europe", code: "EU", name: "Europa", note: "Kelionės pradžia" },
  { id: "America", code: "AM", name: "Amerika", note: "Tolimas maršrutas" },
  { id: "Asia", code: "AS", name: "Azija", note: "Naujas horizontas" },
  { id: "Africa", code: "AF", name: "Afrika", note: "Šiltasis etapas" },
  { id: "Oceania", code: "OK", name: "Okeanija", note: "Kelionė aplink pasaulį" },
] as const;

const PIECES: PieceTemplate[] = [
  { color: 1, name: "Skrydis", shape: [[1, 1, 1, 1]] },
  { color: 2, name: "Lagaminas", shape: [[1, 1], [1, 1]] },
  { color: 3, name: "Kompasas", shape: [[0, 1, 0], [1, 1, 1]] },
  { color: 4, name: "Maršrutas", shape: [[0, 1, 1], [1, 1, 0]] },
  { color: 5, name: "Kelias", shape: [[1, 1, 0], [0, 1, 1]] },
  { color: 6, name: "Pasas", shape: [[1, 0, 0], [1, 1, 1]] },
  { color: 7, name: "Bilietas", shape: [[0, 0, 1], [1, 1, 1]] },
];

function emptyBoard() {
  return Array.from({ length: BOARD_ROWS }, () => Array<number>(BOARD_COLS).fill(0));
}

function randomPiece() {
  return PIECES[Math.floor(Math.random() * PIECES.length)];
}

function spawnPiece(template: PieceTemplate, ordinal = 1): ActivePiece {
  let prepared = template;
  let shape = template.shape.map((row) => [...row]);

  if (ordinal > 1 && ordinal % LOST_LUGGAGE_INTERVAL === 0) {
    if (shape.length === 2 && shape[0]?.length === 2) {
      prepared = PIECES[2];
      shape = prepared.shape.map((row) => [...row]);
    }
    const rotations = 1 + (ordinal % 3);
    for (let index = 0; index < rotations; index += 1) shape = rotateShape(shape);
  }

  if (ordinal > 1 && ordinal % GOLDEN_TICKET_INTERVAL === 0) {
    prepared = { ...prepared, color: 8, name: "Auksinis bilietas" };
  }

  return {
    ...prepared,
    shape,
    row: 0,
    col: Math.floor((BOARD_COLS - shape[0].length) / 2),
  };
}

function rotateShape(shape: number[][]) {
  return shape[0].map((_, column) => shape.map((row) => row[column]).reverse());
}

function canPlace(board: number[][], piece: ActivePiece, row = piece.row, col = piece.col, shape = piece.shape) {
  return shape.every((shapeRow, rowOffset) =>
    shapeRow.every((cell, colOffset) => {
      if (!cell) return true;
      const nextRow = row + rowOffset;
      const nextCol = col + colOffset;
      return nextRow >= 0 && nextRow < BOARD_ROWS && nextCol >= 0 && nextCol < BOARD_COLS && board[nextRow][nextCol] === 0;
    }),
  );
}

function mergePiece(board: number[][], piece: ActivePiece) {
  const next = board.map((row) => [...row]);
  piece.shape.forEach((shapeRow, rowOffset) => {
    shapeRow.forEach((cell, colOffset) => {
      if (cell) next[piece.row + rowOffset][piece.col + colOffset] = piece.color;
    });
  });
  return next;
}

function clearCompletedLines(board: number[][]) {
  const clearedRows = board.flatMap((row, index) => row.every((cell) => cell !== 0) ? [index] : []);
  const remaining = board.filter((_, index) => !clearedRows.includes(index));
  const cleared = BOARD_ROWS - remaining.length;
  return {
    board: [...Array.from({ length: cleared }, () => Array<number>(BOARD_COLS).fill(0)), ...remaining],
    cleared,
    clearedRows,
  };
}

function lockPiece(state: GameState, piece: ActivePiece, dropBonus = 0): GameState {
  const result = clearCompletedLines(mergePiece(state.board, piece));
  const lines = state.lines + result.cleared;
  const level = 1 + Math.floor(lines / 10);
  const combo = result.cleared ? state.combo + 1 : 0;
  const comboBonus = result.cleared ? Math.max(0, combo - 1) * 50 * state.level : 0;
  const directFlightBonus = result.cleared === 4 ? DIRECT_FLIGHT_BONUS * state.level : 0;
  const score = state.score + dropBonus + (LINE_POINTS[result.cleared] ?? 0) * state.level + comboBonus + directFlightBonus;
  const nextTemplate = state.next ?? randomPiece();
  const eventNumber = state.proofEvents.length + 1;
  const nextOrdinal = eventNumber + 1;
  const active = spawnPiece(nextTemplate, nextOrdinal);
  const next = randomPiece();
  const pieceDropPoints = state.pieceDropPoints + dropBonus;
  const earnedGoldenTicket = eventNumber % GOLDEN_TICKET_INTERVAL === 0 ? 1 : 0;
  const atMs = Math.max(
    (state.proofEvents.at(-1)?.atMs ?? 0) + 1,
    Date.now() - state.startedAtMs,
  );
  const roundState = {
    board: result.board,
    combo,
    effectId: result.cleared ? state.effectId + 1 : state.effectId,
    goldenTickets: state.goldenTickets + earnedGoldenTicket,
    goldenTicketsUsedPending: 0,
    lastBonus: directFlightBonus,
    lastClear: result.cleared,
    lastClearedRows: result.clearedRows,
    level,
    leveledUp: level > state.level,
    lines,
    maxClear: Math.max(state.maxClear, result.cleared),
    maxCombo: Math.max(state.maxCombo, combo),
    next,
    pieceDropPoints: 0,
    proofEvents: [...state.proofEvents, {
      atMs,
      cleared: result.cleared,
      dropPoints: pieceDropPoints,
      goldenTicketsUsed: state.goldenTicketsUsedPending,
    }],
    score,
  };

  if (!canPlace(result.board, active)) {
    return { ...state, ...roundState, active: null, running: false, gameOver: true };
  }

  return { ...state, ...roundState, active };
}

const initialGameState: GameState = {
  active: null,
  board: emptyBoard(),
  combo: 0,
  effectId: 0,
  gameOver: false,
  goldenTickets: 0,
  goldenTicketsUsedPending: 0,
  lastBonus: 0,
  lastClear: 0,
  lastClearedRows: [],
  level: 1,
  leveledUp: false,
  lines: 0,
  maxClear: 0,
  maxCombo: 0,
  next: null,
  pieceDropPoints: 0,
  proofEvents: [],
  running: false,
  score: 0,
  startedAtMs: 0,
};

function gameReducer(state: GameState, action: GameAction): GameState {
  if (action.type === "start") {
    const first = randomPiece();
    return {
      ...initialGameState,
      board: emptyBoard(),
      active: spawnPiece(first),
      next: randomPiece(),
      running: true,
      startedAtMs: action.startedAtMs,
    };
  }

  if (!state.running || !state.active) return state;

  if (action.type === "useGoldenTicket") {
    if (state.goldenTickets < 1 || action.row < 0 || action.row >= BOARD_ROWS || !state.board[action.row].some(Boolean)) return state;
    const board = state.board.map((row, index) => index === action.row ? Array<number>(BOARD_COLS).fill(0) : [...row]);
    return {
      ...state,
      board,
      goldenTickets: state.goldenTickets - 1,
      goldenTicketsUsedPending: state.goldenTicketsUsedPending + 1,
    };
  }

  if (action.type === "move") {
    const col = state.active.col + action.direction;
    return canPlace(state.board, state.active, state.active.row, col)
      ? { ...state, active: { ...state.active, col } }
      : state;
  }

  if (action.type === "rotate") {
    const shape = rotateShape(state.active.shape);
    const kick = [0, -1, 1, -2, 2].find((offset) =>
      canPlace(state.board, state.active as ActivePiece, state.active!.row, state.active!.col + offset, shape),
    );
    return kick === undefined ? state : { ...state, active: { ...state.active, shape, col: state.active.col + kick } };
  }

  if (action.type === "hardDrop") {
    let row = state.active.row;
    while (canPlace(state.board, state.active, row + 1, state.active.col)) row += 1;
    return lockPiece(state, { ...state.active, row }, Math.max(0, row - state.active.row) * 2);
  }

  const nextRow = state.active.row + 1;
  if (canPlace(state.board, state.active, nextRow, state.active.col)) {
    return {
      ...state,
      active: { ...state.active, row: nextRow },
      pieceDropPoints: state.pieceDropPoints + (action.type === "softDrop" ? 1 : 0),
      score: state.score + (action.type === "softDrop" ? 1 : 0),
    };
  }

  return lockPiece(state, state.active);
}

function ghostRow(board: number[][], piece: ActivePiece) {
  let row = piece.row;
  while (canPlace(board, piece, row + 1, piece.col)) row += 1;
  return row;
}

function formatGameTimestamp(value: string | undefined) {
  if (!value) return "–";
  if (!value.includes("T")) return value;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : GAME_TIME_FORMATTER.format(parsed);
}

function formatGameDuration(value: number | undefined) {
  if (!Number.isFinite(value) || !value || value < 0) return null;
  const totalSeconds = Math.max(1, Math.round(value / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours ? `${hours} val.` : "", minutes ? `${minutes} min.` : "", `${seconds} sek.`].filter(Boolean).join(" ");
}

export default function PackingGame({
  scores,
  onCreateSession,
  onSaveScore,
}: {
  scores: GameScore[];
  onCreateSession: () => Promise<string | null>;
  onSaveScore: (name: string, score: number, proof: GameScoreProof) => Promise<boolean>;
}) {
  const fullscreenRef = useRef<HTMLDivElement | null>(null);
  const nameInputRef = useRef<HTMLInputElement | null>(null);
  const sessionHandlerRef = useRef(onCreateSession);
  const sessionTokenRef = useRef("");
  const scoreHandlerRef = useRef(onSaveScore);
  const scoreAttemptRef = useRef<string | null>(null);
  const stabilityLevelRef = useRef(0);
  const hapticEventRef = useRef(0);
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const [state, dispatch] = useReducer(gameReducer, initialGameState);
  const [celebration, setCelebration] = useState<{ id: number; title: string; detail: string } | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [playerName, setPlayerName] = useState("");
  const [preferences, setPreferences] = useState<GamePreferences>(DEFAULT_PREFERENCES);
  const [savedScore, setSavedScore] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [starting, setStarting] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [stabilitySeconds, setStabilitySeconds] = useState(0);
  const [stabilityUntil, setStabilityUntil] = useState(0);
  const [startError, setStartError] = useState("");
  const [ticketMode, setTicketMode] = useState(false);

  const sortedScores = useMemo(
    () => [...scores].sort((a, b) => b.score - a.score),
    [scores],
  );
  const topScores = sortedScores.slice(0, 5);
  const qualifiesForTopFive = state.score > 0 && (topScores.length < 5 || state.score > (topScores[4]?.score ?? 0));
  const liveRank = state.score > 0 ? 1 + sortedScores.filter((entry) => entry.score > state.score).length : null;
  const activeOrdinal = state.proofEvents.length + 1;
  const customsActive = state.running && activeOrdinal > 1 && activeOrdinal % CUSTOMS_INTERVAL === 0;
  const lostLuggageActive = state.running && activeOrdinal > 1 && activeOrdinal % LOST_LUGGAGE_INTERVAL === 0;
  const goldenPieceActive = state.running && activeOrdinal > 1 && activeOrdinal % GOLDEN_TICKET_INTERVAL === 0;
  const regionIndex = Math.min(REGIONS.length - 1, Math.max(0, state.level - 1));
  const region = REGIONS[regionIndex];
  const regionClass = styles[`region${region.id}`];
  const regularDropDelay = Math.max(135, 820 - (state.level - 1) * 55);
  const previousLevelDropDelay = Math.max(135, 820 - Math.max(0, state.level - 2) * 55);
  const dropDelay = stabilitySeconds > 0 ? previousLevelDropDelay : regularDropDelay;
  const speedMultiplier = (820 / dropDelay).toFixed(1).replace(".", ",");
  const missions = [
    { id: "lines", title: "Maršruto pradžia", detail: "Pašalink 3 eilutes", progress: `${Math.min(state.lines, 3)}/3`, done: state.lines >= 3 },
    { id: "score", title: "Pilnas bilietas", detail: "Surink 1 000 taškų", progress: `${Math.min(state.score, 1000)}/1000`, done: state.score >= 1000 },
    { id: "level", title: "Penki žemynai", detail: "Pasiek 5 lygį", progress: `${Math.min(state.level, 5)}/5`, done: state.level >= 5 },
    { id: "clear", title: "Tobulas lagaminas", detail: "Pašalink 4 eilutes kartu", progress: `${Math.min(state.maxClear, 4)}/4`, done: state.maxClear >= 4 },
  ];
  const achievements = [
    { id: "first-line", code: "01", title: "Pirmoji eilutė", done: state.lines >= 1 },
    { id: "combo", code: "K3", title: "Kombo meistras", done: state.maxCombo >= 3 },
    { id: "continents", code: "360", title: "Penki žemynai", done: state.level >= 5 },
    { id: "perfect", code: "4X", title: "Tobulas lagaminas", done: state.maxClear >= 4 },
  ];
  const landingRow = state.active ? ghostRow(state.board, state.active) : 0;
  const activeCells = new Map<string, number>();
  const ghostCells = new Set<string>();

  if (state.active) {
    state.active.shape.forEach((row, rowOffset) => {
      row.forEach((cell, colOffset) => {
        if (!cell) return;
        activeCells.set(`${state.active!.row + rowOffset}:${state.active!.col + colOffset}`, state.active!.color);
        if (landingRow !== state.active!.row) ghostCells.add(`${landingRow + rowOffset}:${state.active!.col + colOffset}`);
      });
    });
  }

  useEffect(() => {
    sessionHandlerRef.current = onCreateSession;
    scoreHandlerRef.current = onSaveScore;
  }, [onCreateSession, onSaveScore]);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(PREFERENCES_KEY);
      if (!saved) return;
      const parsed = JSON.parse(saved) as Partial<GamePreferences>;
      setPreferences({
        controlSide: parsed.controlSide === "left" ? "left" : "right",
        haptics: parsed.haptics !== false,
        reduceEffects: parsed.reduceEffects === true,
        swipeSensitivity: [24, 38, 54].includes(Number(parsed.swipeSensitivity)) ? Number(parsed.swipeSensitivity) : 38,
      });
    } catch (error) {
      console.error("Failed to load game preferences", error);
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(PREFERENCES_KEY, JSON.stringify(preferences));
    } catch (error) {
      console.error("Failed to save game preferences", error);
    }
  }, [preferences]);

  useEffect(() => {
    if (!state.running) return;
    const timer = window.setInterval(() => dispatch({ type: "tick" }), dropDelay);
    return () => window.clearInterval(timer);
  }, [dropDelay, state.running]);

  useEffect(() => {
    const eventCount = state.proofEvents.length;
    if (!preferences.haptics || eventCount <= hapticEventRef.current) {
      hapticEventRef.current = eventCount;
      return;
    }
    hapticEventRef.current = eventCount;
    const latest = state.proofEvents.at(-1);
    if (typeof navigator.vibrate === "function") navigator.vibrate(latest?.cleared ? [24, 35, 48] : 18);
  }, [preferences.haptics, state.proofEvents]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const target = event.target;
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) return;
      const action: GameAction | null =
        event.code === "ArrowLeft" ? { type: "move", direction: -1 }
        : event.code === "ArrowRight" ? { type: "move", direction: 1 }
        : event.code === "ArrowDown" ? { type: "softDrop" }
        : event.code === "ArrowUp" ? { type: "rotate" }
        : event.code === "Space" ? { type: "hardDrop" }
        : null;
      if (!action) return;
      event.preventDefault();
      dispatch(action);
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    if (!state.effectId) return;
    const comboTitle = state.combo >= 4
      ? "Kelionės meistras"
      : state.combo === 3
        ? "Be persėdimų"
        : "Puikus maršrutas";
    const title = state.lastClear === 4
        ? "Tiesioginis skrydis"
        : state.leveledUp
          ? `${region.name} atrakinta`
        : state.combo > 1
          ? `${comboTitle} · kombo x${state.combo}`
          : state.lastClear > 1
            ? `${state.lastClear} eilutės vienu metu`
            : "Kelionės antspaudas";
    const detail = state.lastClear === 4
        ? `Keturių eilučių bonusas +${state.lastBonus} taškų`
        : state.leveledUp
          ? `${state.level} lygis · ${region.note}`
        : state.combo > 1
        ? `Papildomas ${Math.max(0, state.combo - 1) * 50 * state.level} taškų priedas`
        : "+ viena pilna eilutė";
    setCelebration({ id: state.effectId, title, detail });
    const timer = window.setTimeout(() => setCelebration(null), 1250);
    return () => window.clearTimeout(timer);
  }, [region, state.combo, state.effectId, state.lastBonus, state.lastClear, state.level, state.leveledUp]);

  useEffect(() => {
    const isBonusLevel = state.level >= 5 && (state.level - 5) % 3 === 0;
    if (!state.running || !isBonusLevel || stabilityLevelRef.current === state.level) return;
    stabilityLevelRef.current = state.level;
    const until = Date.now() + 15_000;
    setStabilityUntil(until);
    setStabilitySeconds(15);
    setCelebration({
      id: Date.now(),
      title: "Ramus skrydis",
      detail: "Greitis stabilus 15 sekundžių",
    });
  }, [state.level, state.running]);

  useEffect(() => {
    if (!stabilityUntil) return;
    function updateCountdown() {
      const remaining = Math.max(0, Math.ceil((stabilityUntil - Date.now()) / 1000));
      setStabilitySeconds(remaining);
      if (!remaining) setStabilityUntil(0);
    }
    updateCountdown();
    const timer = window.setInterval(updateCountdown, 250);
    return () => window.clearInterval(timer);
  }, [stabilityUntil]);

  useEffect(() => {
    const name = playerName.trim();
    const key = `${name}:${state.score}`;
    if (!state.gameOver || !name || !qualifiesForTopFive || savedScore === state.score || scoreAttemptRef.current === key) return;
    scoreAttemptRef.current = key;
    setSaving(true);
    setSaveError("");
    const proof: GameScoreProof = {
      events: state.proofEvents,
      level: state.level,
      lines: state.lines,
      maxClear: state.maxClear,
      maxCombo: state.maxCombo,
      version: 2,
      sessionToken: sessionTokenRef.current,
    };
    void scoreHandlerRef.current(name, state.score, proof).then((saved) => {
      setSaving(false);
      if (saved) setSavedScore(state.score);
      else setSaveError("Nepavyko išsaugoti rezultato. Patikrink internetą ir pabandyk dar kartą.");
    });
  }, [playerName, qualifiesForTopFive, savedScore, state.gameOver, state.level, state.lines, state.maxClear, state.maxCombo, state.proofEvents, state.score]);

  useEffect(() => {
    function handleFullscreenChange() {
      setIsFullscreen(document.fullscreenElement === fullscreenRef.current);
    }
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  async function startGame() {
    if (!playerName.trim()) {
      setStartError("Pirmiausia įrašyk savo vardą.");
      window.requestAnimationFrame(() => nameInputRef.current?.focus());
      return;
    }
    if (starting) return;
    setStarting(true);
    setStartError("");
    const sessionToken = await sessionHandlerRef.current();
    setStarting(false);
    if (!sessionToken) {
      setStartError("Nepavyko saugiai pradėti žaidimo. Patikrink internetą ir bandyk dar kartą.");
      return;
    }
    sessionTokenRef.current = sessionToken;
    setSavedScore(null);
    scoreAttemptRef.current = null;
    stabilityLevelRef.current = 0;
    setSaveError("");
    setStabilitySeconds(0);
    setStabilityUntil(0);
    setStartError("");
    setTicketMode(false);
    hapticEventRef.current = 0;
    dispatch({ type: "start", startedAtMs: Date.now() });
  }

  async function retryScoreSave() {
    const name = playerName.trim();
    if (!name || !state.gameOver || !qualifiesForTopFive) return;
    setSaving(true);
    setSaveError("");
    const saved = await scoreHandlerRef.current(name, state.score, {
      events: state.proofEvents,
      level: state.level,
      lines: state.lines,
      maxClear: state.maxClear,
      maxCombo: state.maxCombo,
      version: 2,
      sessionToken: sessionTokenRef.current,
    });
    setSaving(false);
    if (!saved) {
      setSaveError("Nepavyko išsaugoti rezultato. Patikrink internetą ir pabandyk dar kartą.");
      return;
    }
    setSavedScore(state.score);
  }

  function handleTouchStart(event: TouchEvent<HTMLDivElement>) {
    if (!state.running) return;
    const touch = event.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY, time: Date.now() };
  }

  function handleTouchMove(event: TouchEvent<HTMLDivElement>) {
    if (state.running) event.preventDefault();
  }

  function handleTouchEnd(event: TouchEvent<HTMLDivElement>) {
    const start = touchStartRef.current;
    touchStartRef.current = null;
    if (!start || !state.running) return;
    const touch = event.changedTouches[0];
    const x = touch.clientX - start.x;
    const y = touch.clientY - start.y;

    const sensitivity = preferences.swipeSensitivity;
    const gestureThreshold = Math.max(16, Math.round(sensitivity * 0.65));

    if (Math.abs(x) < gestureThreshold && Math.abs(y) < gestureThreshold && Date.now() - start.time < 450) {
      dispatch({ type: "rotate" });
      return;
    }

    if (Math.abs(x) > Math.abs(y) && Math.abs(x) >= gestureThreshold) {
      const direction = x > 0 ? 1 : -1;
      const steps = Math.min(4, Math.max(1, Math.round(Math.abs(x) / sensitivity)));
      for (let step = 0; step < steps; step += 1) dispatch({ type: "move", direction });
      return;
    }

    if (y > gestureThreshold) dispatch({ type: "hardDrop" });
  }

  function useGoldenTicket(row: number) {
    if (!ticketMode || !state.board[row]?.some(Boolean)) return;
    dispatch({ type: "useGoldenTicket", row });
    setTicketMode(false);
    setCelebration({
      id: Date.now(),
      title: "Auksinis bilietas panaudotas",
      detail: `Pašalinta ${row + 1} lentos eilutė`,
    });
  }

  function updatePreference<K extends keyof GamePreferences>(key: K, value: GamePreferences[K]) {
    setPreferences((previous) => ({ ...previous, [key]: value }));
  }

  async function toggleFullscreen() {
    if (!fullscreenRef.current) return;
    if (document.fullscreenElement === fullscreenRef.current) await document.exitFullscreen();
    else await fullscreenRef.current.requestFullscreen();
  }

  return (
    <div
      className={`${styles.shell} ${regionClass}${isFullscreen ? ` ${styles.fullscreen}` : ""}${preferences.reduceEffects ? ` ${styles.reducedEffects}` : ""}`}
      ref={fullscreenRef}
    >
      <div className={styles.gameCard}>
        <div className={styles.gameHead}>
          <div>
            <span className={styles.kicker}>Pakuok išmaniai</span>
            <strong>Lagaminas 360</strong>
          </div>
          <button className={styles.fullscreenButton} type="button" onClick={toggleFullscreen}>
            {isFullscreen ? "Mažinti" : "Visas ekranas"}
          </button>
        </div>

        <div className={styles.regionRibbon}>
          <span>{region.code}</span>
          <div>
            <small>{state.level} lygio kryptis</small>
            <strong>{region.name}</strong>
          </div>
          <b>
            <span>{region.note}</span>
            <small>Greitis x{speedMultiplier}</small>
          </b>
        </div>

        <div className={styles.stats} aria-label="Žaidimo statistika">
          <div><span>Taškai</span><strong>{state.score}</strong></div>
          <div><span>Eilutės</span><strong>{state.lines}</strong></div>
          <div><span>Lygis</span><strong>{state.level}</strong></div>
          <div className={state.combo > 1 ? styles.comboStat : ""}><span>Kombo</span><strong>{state.combo > 1 ? `x${state.combo}` : "–"}</strong></div>
        </div>

        {state.running && liveRank ? (
          <div className={`${styles.liveRank}${liveRank <= 5 ? ` ${styles.liveRankTop}` : ""}`} aria-live="polite">
            <span>Gyva turnyro vieta</span>
            <strong>{liveRank === 1 ? "Šiuo metu būtum 1 vietoje" : `Šiuo metu būtum ${liveRank} vietoje`}</strong>
          </div>
        ) : null}

        {stabilitySeconds > 0 ? (
          <div className={styles.stabilityBanner} aria-live="polite">
            <strong>Ramus skrydis</strong>
            <span>Greitis stabilus dar {stabilitySeconds} sek.</span>
          </div>
        ) : null}

        {goldenPieceActive || customsActive || lostLuggageActive ? (
          <div className={`${styles.specialBanner}${goldenPieceActive ? ` ${styles.goldenBanner}` : ""}`} aria-live="polite">
            <span>{goldenPieceActive ? "Auksinis bilietas" : customsActive ? "Muitinės patikra" : "Pamestas bagažas"}</span>
            <strong>
              {goldenPieceActive
                ? "Nuleisk auksinę figūrą ir gauk vienos blogos eilutės pašalinimą"
                : customsActive
                  ? "Kita figūra laikinai paslėpta"
                  : "Figūra atkeliavo netikėta padėtimi"}
            </strong>
          </div>
        ) : null}

        <div
          className={styles.boardFrame}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <div className={`${styles.board}${celebration && state.lastClear ? ` ${styles.boardClearing}` : ""}`} role="group" aria-label="Žaidimo Lagaminas 360 lenta">
            {state.board.flatMap((row, rowIndex) =>
              row.map((cell, colIndex) => {
                const key = `${rowIndex}:${colIndex}`;
                const activeColor = activeCells.get(key);
                const value = activeColor ?? cell;
                const className = [styles.cell, value ? styles.filled : "", value ? styles[`color${value}`] : "", ghostCells.has(key) && !value ? styles.ghost : ""]
                  .filter(Boolean)
                  .join(" ");
                return <span className={className} key={key} />;
              }),
            )}

            {ticketMode ? (
              <div className={styles.ticketRows} aria-label="Pasirink eilutę, kurią pašalins auksinis bilietas">
                {state.board.map((row, rowIndex) => (
                  <button
                    aria-label={`${rowIndex + 1} eilutė${row.some(Boolean) ? "" : " tuščia"}`}
                    disabled={!row.some(Boolean)}
                    key={rowIndex}
                    type="button"
                    onTouchStart={(event) => event.stopPropagation()}
                    onTouchEnd={(event) => event.stopPropagation()}
                    onClick={() => useGoldenTicket(rowIndex)}
                  >
                    {row.some(Boolean) ? `${rowIndex + 1}` : ""}
                  </button>
                ))}
              </div>
            ) : null}

            {!state.active && !state.gameOver ? (
              <div className={styles.overlay}>
                <span>Kelionė prasideda čia</span>
                <strong>Supakuok kuo daugiau pilnų eilučių</strong>
                <label className={styles.startName}>
                  <b>Tavo vardas</b>
                  <input
                    ref={nameInputRef}
                    value={playerName}
                    onChange={(event) => {
                      setPlayerName(event.target.value);
                      setStartError("");
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") void startGame();
                    }}
                    placeholder="Įrašyk vardą prieš žaidimą"
                    autoComplete="name"
                  />
                </label>
                {startError ? <small className={styles.startError}>{startError}</small> : null}
                <button disabled={starting} type="button" onClick={() => void startGame()}>
                  {starting ? "Tikrinama..." : "Pradėti žaidimą"}
                </button>
              </div>
            ) : null}

            {state.gameOver ? (
              <div className={styles.overlay}>
                <span>Lagaminas pilnas</span>
                <strong>{state.score} taškų</strong>
                <small className={styles.resultMeta}>{state.lines} eilučių · geriausias kombo x{state.maxCombo}</small>
                <small className={styles.resultNote}>
                  {savedScore === state.score
                    ? `${playerName.trim()}, tavo rezultatas išsaugotas Top 5 lentoje.`
                    : qualifiesForTopFive
                      ? saving
                      ? "Rezultatas saugomas..."
                      : saveError || "Ruošiamas rezultato išsaugojimas..."
                      : `${playerName.trim()}, šį kartą iki Top 5 šiek tiek pritrūko.`}
                </small>
                <button disabled={starting} type="button" onClick={() => void startGame()}>
                  {starting ? "Tikrinama..." : "Žaisti dar kartą"}
                </button>
              </div>
            ) : null}

            {celebration && !preferences.reduceEffects ? (
              <div className={styles.celebration} key={celebration.id} aria-live="polite">
                <strong>{celebration.title}</strong>
                <span>{celebration.detail}</span>
                <div className={styles.confetti} aria-hidden="true">
                  {Array.from({ length: 14 }, (_, index) => <i key={index} />)}
                </div>
              </div>
            ) : null}

            {celebration && state.lastClearedRows.length && !preferences.reduceEffects ? (
              <div className={styles.lineExplosions} aria-hidden="true">
                {state.lastClearedRows.map((row) => (
                  <div className={styles.lineExplosion} style={{ top: `${((row + 0.5) / BOARD_ROWS) * 100}%` }} key={`${celebration.id}-${row}`}>
                    {Array.from({ length: BOARD_COLS }, (_, index) => <i key={index} />)}
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </div>

        <p className={styles.touchHint}>Telefone: brauk į šonus, bakstelėk arba spausk didįjį mygtuką pasukti, brauk žemyn nuleisti.</p>

        <div className={`${styles.controls} ${preferences.controlSide === "left" ? styles.controlsLeft : styles.controlsRight}`} aria-label="Žaidimo valdymas">
          <button className={styles.rotateButton} aria-label="Pasukti figūrą" disabled={!state.running} type="button" onClick={() => dispatch({ type: "rotate" })}>
            <b>↻</b><span>Pasukti</span>
          </button>
          <div className={styles.controlPad}>
            <button aria-label="Stumti į kairę" disabled={!state.running} type="button" onClick={() => dispatch({ type: "move", direction: -1 })}>←</button>
            <button aria-label="Stumti į dešinę" disabled={!state.running} type="button" onClick={() => dispatch({ type: "move", direction: 1 })}>→</button>
            <button aria-label="Nuleisti vienu langeliu" disabled={!state.running} type="button" onClick={() => dispatch({ type: "softDrop" })}>↓</button>
            <button className={styles.dropButton} disabled={!state.running} type="button" onClick={() => dispatch({ type: "hardDrop" })}>Nuleisti</button>
          </div>
        </div>

        <div className={styles.goldenTicketBar}>
          <div><span>Auksinis bilietas</span><strong>{state.goldenTickets ? `${state.goldenTickets} paruošta` : `Kas ${GOLDEN_TICKET_INTERVAL} figūras`}</strong></div>
          <button
            disabled={!state.running || state.goldenTickets < 1}
            type="button"
            onClick={() => setTicketMode((current) => !current)}
          >
            {ticketMode ? "Atšaukti" : "Pasirinkti eilutę"}
          </button>
        </div>
      </div>

      <aside className={styles.side}>
        <div className={styles.sideCard}>
          <div className={styles.sideTitle}>
            <strong>Kita detalė</strong>
            <span>{customsActive ? "Tikrinama" : state.next?.name ?? "Laukia starto"}</span>
          </div>
          <div className={`${styles.preview}${customsActive ? ` ${styles.previewBlocked}` : ""}`} aria-label="Kita žaidimo detalė">
            {customsActive ? (
              <div><b>MUITINĖ</b><small>Figūra slepiama</small></div>
            ) : Array.from({ length: 16 }, (_, index) => {
                const row = Math.floor(index / 4);
                const col = index % 4;
                const shape = state.next?.shape ?? [];
                const rowOffset = Math.floor((4 - shape.length) / 2);
                const colOffset = Math.floor((4 - (shape[0]?.length ?? 0)) / 2);
                const filled = shape[row - rowOffset]?.[col - colOffset];
                return <span className={`${styles.previewCell}${filled ? ` ${styles.filled} ${styles[`color${state.next?.color ?? 1}`]}` : ""}`} key={index} />;
              })}
          </div>
          {playerName.trim() ? <div className={styles.playerTag}>Žaidžia: <strong>{playerName.trim()}</strong></div> : null}
          <button className={styles.newGameButton} disabled={starting} type="button" onClick={() => void startGame()}>
            {starting ? "Tikrinama..." : state.active || state.gameOver ? "Pradėti iš naujo" : "Pradėti žaidimą"}
          </button>
        </div>

        <div className={styles.sideCard}>
          <div className={styles.sideTitle}>
            <strong>Telefono valdymas</strong>
            <span>Išsaugoma šiame telefone</span>
          </div>
          <div className={styles.gameSettings}>
            <label>
              <span>Braukimo jautrumas</span>
              <select
                value={preferences.swipeSensitivity}
                onChange={(event) => updatePreference("swipeSensitivity", Number(event.target.value))}
              >
                <option value={24}>Jautrus</option>
                <option value={38}>Subalansuotas</option>
                <option value={54}>Ramus</option>
              </select>
            </label>
            <fieldset>
              <legend>Vienos rankos valdymas</legend>
              <button className={preferences.controlSide === "left" ? styles.settingActive : ""} type="button" onClick={() => updatePreference("controlSide", "left")}>Kairėje</button>
              <button className={preferences.controlSide === "right" ? styles.settingActive : ""} type="button" onClick={() => updatePreference("controlSide", "right")}>Dešinėje</button>
            </fieldset>
            <label className={styles.toggleSetting}>
              <input checked={preferences.haptics} type="checkbox" onChange={(event) => updatePreference("haptics", event.target.checked)} />
              <span>Vibracija nusileidus figūrai</span>
            </label>
            <label className={styles.toggleSetting}>
              <input checked={preferences.reduceEffects} type="checkbox" onChange={(event) => updatePreference("reduceEffects", event.target.checked)} />
              <span>Išjungti intensyvias animacijas</span>
            </label>
          </div>
        </div>

        <div className={styles.sideCard}>
          <div className={styles.sideTitle}>
            <strong>Kelionės pasas</strong>
            <span>{region.name}</span>
          </div>
          <div className={styles.passport}>
            {REGIONS.map((item, index) => (
              <div className={index <= regionIndex ? styles.stampActive : ""} key={item.id}>
                <span>{item.code}</span>
                <small>{item.name}</small>
              </div>
            ))}
          </div>
        </div>

        <div className={styles.sideCard}>
          <div className={styles.sideTitle}>
            <strong>Teminės misijos</strong>
            <span>{missions.filter((mission) => mission.done).length}/{missions.length}</span>
          </div>
          <div className={styles.missions}>
            {missions.map((mission) => (
              <div className={mission.done ? styles.missionDone : ""} key={mission.id}>
                <span>{mission.done ? "Atlikta" : mission.progress}</span>
                <strong>{mission.title}</strong>
                <small>{mission.detail}</small>
              </div>
            ))}
          </div>
          <p className={styles.bonusRule}>Nuo 5 lygio kas tris lygius gausi „Ramaus skrydžio“ bonusą: 15 sekundžių be naujo pagreitėjimo.</p>
        </div>

        <div className={styles.sideCard}>
          <div className={styles.sideTitle}>
            <strong>Pasiekimų ženkliukai</strong>
            <span>{achievements.filter((achievement) => achievement.done).length}/{achievements.length}</span>
          </div>
          <div className={styles.achievements}>
            {achievements.map((achievement) => (
              <div className={achievement.done ? styles.achievementDone : ""} key={achievement.id}>
                <span>{achievement.code}</span>
                <strong>{achievement.title}</strong>
                <small>{achievement.done ? "Atrakinta" : "Dar neatrakinta"}</small>
              </div>
            ))}
          </div>
        </div>

        <div className={styles.sideCard}>
          <strong>Kaip žaisti</strong>
          <p>Užpildyk horizontalią eilutę be tarpų. Šalink eilutes viena figūra po kitos, kad augtų kombo. Keturios eilutės vienu metu aktyvuoja „Tiesioginį skrydį“, o kas 24 figūras gausi „Auksinį bilietą“ blogai eilutei pašalinti.</p>
          <div className={styles.keyGuide}>
            <span>← → judėti</span>
            <span>↑ pasukti</span>
            <span>↓ lėtai leisti</span>
            <span>Space nuleisti</span>
          </div>
        </div>

        {state.gameOver && qualifiesForTopFive && saveError ? (
          <div className={`${styles.sideCard} ${styles.saveCard}`}>
            <strong>Rezultato išsaugoti nepavyko</strong>
            <p>{saveError}</p>
            <button disabled={saving} type="button" onClick={retryScoreSave}>
              {saving ? "Saugoma..." : "Bandyti dar kartą"}
            </button>
          </div>
        ) : null}

        <div className={styles.sideCard}>
          <div className={styles.sideTitle}>
            <strong>Dalyvių rekordai</strong>
            <span>Top 5</span>
          </div>
          <div className={styles.leaderboard}>
            {topScores.length ? topScores.map((entry, index) => (
              <div key={entry.id}>
                <span>{index + 1}</span>
                <section className={styles.leaderboardPlayer}>
                  <strong>{entry.name}</strong>
                  {entry.verified ? <em className={styles.verifiedBadge}>✓ Patvirtintas rezultatas</em> : null}
                  {entry.startedAt && entry.finishedAt && formatGameDuration(entry.durationMs) ? (
                    <small>
                      <span>Pradėta {formatGameTimestamp(entry.startedAt)}</span>
                      <span>Baigta {formatGameTimestamp(entry.finishedAt)}</span>
                      <b>Žaista {formatGameDuration(entry.durationMs)}</b>
                      {entry.auditSummary ? <span>{entry.auditSummary.eventsCount} figūrų · serverio žurnalas išsaugotas</span> : null}
                    </small>
                  ) : (
                    <small>
                      <span>Baigta {formatGameTimestamp(entry.createdAt)}</span>
                      <span>Trukmė anksčiau nefiksuota</span>
                    </small>
                  )}
                </section>
                <b className={styles.leaderboardScore}>{entry.score}</b>
              </div>
            )) : <p>Rekordų dar nėra. Pirmasis lagaminas laukia tavęs.</p>}
          </div>
        </div>
      </aside>
    </div>
  );
}
