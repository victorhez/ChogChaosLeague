import { keccakHex, makeRng } from "./prng";
import type { Contender, EngineInput, EngineResult, EventType, GeneKey, LogStep, Outcome, Stance } from "./types";

/**
 * Chaos engine. Pure TypeScript, no I/O, no hidden randomness.
 * Same input + same seed gives the same result on the server and in the browser.
 * No gene weight exceeds 0.38, so no single trait decides a match.
 */
export const WEIGHTS: Record<EventType, Record<GeneKey, number>> = {
  "prank-heist": { mischief: 0.35, wit: 0.25, nerve: 0.2, speed: 0.1, charm: 0.1 },
  "meme-duel": { wit: 0.35, charm: 0.3, mischief: 0.15, nerve: 0.1, speed: 0.1 },
  "meadow-race": { speed: 0.38, nerve: 0.22, wit: 0.15, charm: 0.15, mischief: 0.1 },
  "alliance-betrayal": { charm: 0.3, mischief: 0.3, wit: 0.2, nerve: 0.1, speed: 0.1 },
};

export const STEPS = 3;
export const ROLL_RANGE = 50;
export const COUNTER_BONUS = 4;
/** bold crushes friendly, friendly charms sneaky, sneaky ambushes bold. */
export const BEATS: Record<Stance, Stance> = { bold: "friendly", friendly: "sneaky", sneaky: "bold" };
export const VARIANCE: Record<Stance, number> = { bold: 1.4, sneaky: 1, friendly: 0.7 };

const r3 = (n: number) => Math.round(n * 1000) / 1000;

export function power(c: Contender, type: EventType): number {
  const w = WEIGHTS[type];
  let p = 0;
  (Object.keys(w) as GeneKey[]).forEach((g) => (p += w[g] * c.genome[g]));
  if (c.stance === "bold") p *= 1.06;
  if (c.stance === "friendly") p += c.genome.charm * 0.05;
  return r3(p);
}

function counter(me: Stance, other: Stance): number {
  return BEATS[me] === other ? COUNTER_BONUS : 0;
}

export function betrayChance(c: Contender): number {
  const g = c.genome;
  let p = 0.15 + g.mischief / 200 - g.charm / 400 + g.nerve / 500;
  if (c.stance === "bold") p += 0.1;
  if (c.stance === "friendly") p -= 0.15;
  return Math.min(0.85, Math.max(0.05, p));
}

export function runEvent(input: EngineInput, opts?: { skipHash?: boolean }): EngineResult {
  const { type, seedHash, eventId, a, b } = input;
  const rng = makeRng(seedHash, eventId);
  const powerA = power(a, type);
  const powerB = power(b, type);
  const cA = counter(a.stance, b.stance);
  const cB = counter(b.stance, a.stance);
  const log: LogStep[] = [];
  let totalA = 0;
  let totalB = 0;
  let betrayA = false;
  let betrayB = false;

  for (let n = 1; n <= STEPS; n++) {
    const rollA = rng();
    const rollB = rng();
    if (type === "alliance-betrayal" && n === STEPS) {
      betrayA = rollA < betrayChance(a);
      betrayB = rollB < betrayChance(b);
      log.push({ n, rollA: r3(rollA), rollB: r3(rollB), scoreA: 0, scoreB: 0, betrayA, betrayB });
      continue;
    }
    const scoreA = r3(powerA + rollA * ROLL_RANGE * VARIANCE[a.stance] + cA);
    const scoreB = r3(powerB + rollB * ROLL_RANGE * VARIANCE[b.stance] + cB);
    totalA = r3(totalA + scoreA);
    totalB = r3(totalB + scoreB);
    log.push({ n, rollA: r3(rollA), rollB: r3(rollB), scoreA, scoreB });
  }

  let winner: EngineResult["winner"];
  let outcome: Outcome = "clean";
  let margin = r3(Math.abs(totalA - totalB));
  let points = { a: 0, b: 0 };

  if (type === "alliance-betrayal") {
    if (!betrayA && !betrayB) {
      winner = "draw"; outcome = "shared-loot"; margin = 0; points = { a: 6, b: 6 };
    } else if (betrayA !== betrayB) {
      winner = betrayA ? "a" : "b"; outcome = "betrayal"; margin = r3(margin + 20);
      points = betrayA ? { a: 12, b: 2 } : { a: 2, b: 12 };
    } else {
      winner = totalA === totalB ? "draw" : totalA > totalB ? "a" : "b"; outcome = "mutual-backstab";
      points = winner === "a" ? { a: 8, b: 3 } : winner === "b" ? { a: 3, b: 8 } : { a: 5, b: 5 };
    }
  } else if (totalA === totalB) {
    winner = "draw"; points = { a: 6, b: 6 };
  } else {
    winner = totalA > totalB ? "a" : "b";
    const win = 10 + Math.min(10, Math.floor(margin / 6));
    points = winner === "a" ? { a: win, b: 3 } : { a: 3, b: win };
  }

  const wp = winner === "a" ? powerA : powerB;
  const lp = winner === "a" ? powerB : powerA;
  const upset = winner !== "draw" && wp < lp - 4;
  if (upset) {
    if (outcome === "clean") outcome = "upset";
    if (winner === "a") points.a += 5; else points.b += 5;
  }
  if (outcome === "clean" && winner !== "draw" && margin < 6) outcome = "photo-finish";

  const highlight = upset || outcome === "photo-finish" || outcome === "betrayal" || outcome === "mutual-backstab";
  const core = { type, eventId, seedHash, a: [a.tokenId, a.stance], b: [b.tokenId, b.stance], log, winner, points, outcome };
  const logHash = opts?.skipHash ? "" : keccakHex(JSON.stringify(core));
  return { winner, margin, totalA, totalB, powerA, powerB, points, upset, highlight, outcome, log, logHash };
}
