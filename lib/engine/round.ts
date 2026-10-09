import { makeRng } from "./prng";
import { EVENT_TYPES, STANCES, type EventType, type Stance } from "./types";

export interface Pairing {
  eventId: string;
  type: EventType;
  a: number;
  b: number;
}

/** Autopilot stance used when an owner has not nudged. Seeded, so it is replayable too. */
export function autopilotStance(seedHash: string, roundId: number, tokenId: number): Stance {
  const r = makeRng(seedHash, `stance:${roundId}:${tokenId}`)();
  return STANCES[Math.floor(r * STANCES.length)];
}

/** Seeded Fisher-Yates pairing of the roster. An odd Chog out sits the round on the bench. */
export function planRound(seedHash: string, roundId: number, roster: number[]): Pairing[] {
  const rng = makeRng(seedHash, `round:${roundId}`);
  const order = [...roster];
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  const out: Pairing[] = [];
  for (let i = 0; i + 1 < order.length; i += 2) {
    const type = EVENT_TYPES[Math.floor(rng() * EVENT_TYPES.length)];
    out.push({ eventId: `r${roundId}-e${out.length}`, type, a: order[i], b: order[i + 1] });
  }
  return out;
}
