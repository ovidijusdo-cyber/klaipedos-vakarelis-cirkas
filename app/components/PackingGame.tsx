"use client";

import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import styles from "./PackingGame.module.css";

type GameScore = {
  id: number;
  name: string;
  score: number;
  createdAt: string;
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

type GameState = {
  active: ActivePiece | null;
  board: number[][];
  gameOver: boolean;
  level: number;
  lines: number;
  next: PieceTemplate | null;
  running: boolean;
  score: number;
};

type GameAction =
  | { type: "start" }
  | { type: "tick" }
  | { type: "move"; direction: -1 | 1 }
  | { type: "rotate" }
  | { type: "softDrop" }
  | { type: "hardDrop" }
  | { type: "togglePause" };

const BOARD_COLS = 10;
const BOARD_ROWS = 18;
const LINE_POINTS = [0, 100, 300, 500, 800];

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

function spawnPiece(template: PieceTemplate): ActivePiece {
  return {
    ...template,
    shape: template.shape.map((row) => [...row]),
    row: 0,
    col: Math.floor((BOARD_COLS - template.shape[0].length) / 2),
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
  const remaining = board.filter((row) => row.some((cell) => cell === 0));
  const cleared = BOARD_ROWS - remaining.length;
  return {
    board: [...Array.from({ length: cleared }, () => Array<number>(BOARD_COLS).fill(0)), ...remaining],
    cleared,
  };
}

function lockPiece(state: GameState, piece: ActivePiece, dropBonus = 0): GameState {
  const result = clearCompletedLines(mergePiece(state.board, piece));
  const lines = state.lines + result.cleared;
  const level = 1 + Math.floor(lines / 10);
  const score = state.score + dropBonus + (LINE_POINTS[result.cleared] ?? 0) * state.level;
  const nextTemplate = state.next ?? randomPiece();
  const active = spawnPiece(nextTemplate);
  const next = randomPiece();

  if (!canPlace(result.board, active)) {
    return { ...state, board: result.board, active: null, next, lines, level, score, running: false, gameOver: true };
  }

  return { ...state, board: result.board, active, next, lines, level, score };
}

const initialGameState: GameState = {
  active: null,
  board: emptyBoard(),
  gameOver: false,
  level: 1,
  lines: 0,
  next: null,
  running: false,
  score: 0,
};

function gameReducer(state: GameState, action: GameAction): GameState {
  if (action.type === "start") {
    const first = randomPiece();
    return { ...initialGameState, board: emptyBoard(), active: spawnPiece(first), next: randomPiece(), running: true };
  }

  if (action.type === "togglePause") {
    if (state.gameOver || !state.active) return state;
    return { ...state, running: !state.running };
  }

  if (!state.running || !state.active) return state;

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

export default function PackingGame({
  scores,
  onSaveScore,
}: {
  scores: GameScore[];
  onSaveScore: (name: string, score: number) => Promise<boolean>;
}) {
  const fullscreenRef = useRef<HTMLDivElement | null>(null);
  const [state, dispatch] = useReducer(gameReducer, initialGameState);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [playerName, setPlayerName] = useState("");
  const [savedScore, setSavedScore] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  const topScores = useMemo(
    () => [...scores].sort((a, b) => b.score - a.score).slice(0, 5),
    [scores],
  );
  const qualifiesForTopFive = state.score > 0 && (topScores.length < 5 || state.score > (topScores[4]?.score ?? 0));
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
    if (!state.running) return;
    const speed = Math.max(130, 820 - (state.level - 1) * 72);
    const timer = window.setInterval(() => dispatch({ type: "tick" }), speed);
    return () => window.clearInterval(timer);
  }, [state.level, state.running]);

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
        : event.code === "KeyP" ? { type: "togglePause" }
        : null;
      if (!action) return;
      event.preventDefault();
      dispatch(action);
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    function handleFullscreenChange() {
      setIsFullscreen(document.fullscreenElement === fullscreenRef.current);
    }
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  function startGame() {
    setSavedScore(null);
    setSaveError("");
    dispatch({ type: "start" });
  }

  async function saveScore() {
    const name = playerName.trim();
    if (!name || !state.gameOver || !qualifiesForTopFive || savedScore === state.score) return;
    setSaving(true);
    setSaveError("");
    const saved = await onSaveScore(name, state.score);
    setSaving(false);
    if (!saved) {
      setSaveError("Nepavyko išsaugoti rezultato. Patikrink internetą ir pabandyk dar kartą.");
      return;
    }
    setSavedScore(state.score);
  }

  async function toggleFullscreen() {
    if (!fullscreenRef.current) return;
    if (document.fullscreenElement === fullscreenRef.current) await document.exitFullscreen();
    else await fullscreenRef.current.requestFullscreen();
  }

  return (
    <div className={`${styles.shell}${isFullscreen ? ` ${styles.fullscreen}` : ""}`} ref={fullscreenRef}>
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

        <div className={styles.stats} aria-label="Žaidimo statistika">
          <div><span>Taškai</span><strong>{state.score}</strong></div>
          <div><span>Eilutės</span><strong>{state.lines}</strong></div>
          <div><span>Lygis</span><strong>{state.level}</strong></div>
        </div>

        <div className={styles.boardFrame}>
          <div className={styles.board} role="img" aria-label="Žaidimo Lagaminas 360 lenta">
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

            {!state.active && !state.gameOver ? (
              <div className={styles.overlay}>
                <span>Kelionė prasideda čia</span>
                <strong>Supakuok kuo daugiau pilnų eilučių</strong>
                <button type="button" onClick={startGame}>Pradėti žaidimą</button>
              </div>
            ) : null}

            {!state.running && state.active && !state.gameOver ? (
              <div className={styles.overlay}>
                <span>Trumpa stotelė</span>
                <strong>Žaidimas pristabdytas</strong>
                <button type="button" onClick={() => dispatch({ type: "togglePause" })}>Tęsti</button>
              </div>
            ) : null}

            {state.gameOver ? (
              <div className={styles.overlay}>
                <span>Lagaminas pilnas</span>
                <strong>{state.score} taškų</strong>
                <button type="button" onClick={startGame}>Žaisti dar kartą</button>
              </div>
            ) : null}
          </div>
        </div>

        <div className={styles.controls} aria-label="Žaidimo valdymas">
          <button aria-label="Stumti į kairę" disabled={!state.running} type="button" onClick={() => dispatch({ type: "move", direction: -1 })}>←</button>
          <button aria-label="Pasukti figūrą" disabled={!state.running} type="button" onClick={() => dispatch({ type: "rotate" })}>↻</button>
          <button aria-label="Stumti į dešinę" disabled={!state.running} type="button" onClick={() => dispatch({ type: "move", direction: 1 })}>→</button>
          <button aria-label="Nuleisti vienu langeliu" disabled={!state.running} type="button" onClick={() => dispatch({ type: "softDrop" })}>↓</button>
          <button className={styles.dropButton} disabled={!state.running} type="button" onClick={() => dispatch({ type: "hardDrop" })}>Nuleisti</button>
        </div>
      </div>

      <aside className={styles.side}>
        <div className={styles.sideCard}>
          <div className={styles.sideTitle}>
            <strong>Kita detalė</strong>
            <span>{state.next?.name ?? "Laukia starto"}</span>
          </div>
          <div className={styles.preview} aria-label="Kita žaidimo detalė">
            {Array.from({ length: 16 }, (_, index) => {
              const row = Math.floor(index / 4);
              const col = index % 4;
              const shape = state.next?.shape ?? [];
              const rowOffset = Math.floor((4 - shape.length) / 2);
              const colOffset = Math.floor((4 - (shape[0]?.length ?? 0)) / 2);
              const filled = shape[row - rowOffset]?.[col - colOffset];
              return <span className={`${styles.previewCell}${filled ? ` ${styles.filled} ${styles[`color${state.next?.color ?? 1}`]}` : ""}`} key={index} />;
            })}
          </div>
          <div className={styles.actionRow}>
            <button type="button" onClick={startGame}>{state.active || state.gameOver ? "Iš naujo" : "Pradėti"}</button>
            <button disabled={!state.active || state.gameOver} type="button" onClick={() => dispatch({ type: "togglePause" })}>
              {state.running ? "Pauzė" : "Tęsti"}
            </button>
          </div>
        </div>

        <div className={styles.sideCard}>
          <strong>Kaip žaisti</strong>
          <p>Užpildyk visą horizontalią eilutę be tarpų. Pilna eilutė iškeliauja iš lagamino ir pelno taškų.</p>
          <div className={styles.keyGuide}>
            <span>← → judėti</span>
            <span>↑ pasukti</span>
            <span>↓ lėtai leisti</span>
            <span>Space nuleisti</span>
          </div>
        </div>

        {state.gameOver && qualifiesForTopFive ? (
          <div className={`${styles.sideCard} ${styles.saveCard}`}>
            <strong>Naujas Top 5 rezultatas</strong>
            <p>Įrašyk vardą, kad rezultatas liktų rekordų lentoje.</p>
            <input value={playerName} onChange={(event) => setPlayerName(event.target.value)} placeholder="Tavo vardas" />
            <button disabled={!playerName.trim() || saving || savedScore === state.score} type="button" onClick={saveScore}>
              {saving ? "Saugoma..." : savedScore === state.score ? "Išsaugota" : "Išsaugoti rezultatą"}
            </button>
            {saveError ? <small>{saveError}</small> : null}
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
                <strong>{entry.name}</strong>
                <b>{entry.score}</b>
              </div>
            )) : <p>Rekordų dar nėra. Pirmasis lagaminas laukia tavęs.</p>}
          </div>
        </div>
      </aside>
    </div>
  );
}
