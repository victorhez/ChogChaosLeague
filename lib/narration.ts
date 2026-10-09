import { makeRng } from "./engine/prng";
import type { EngineInput, EngineResult, EventType } from "./engine/types";

/**
 * Chog Chronicle: template narration. Text only. It reads a finished result and can never change one.
 * A model can replace these templates later; this deterministic fallback always works.
 */
const OPEN: Record<EventType, string[]> = {
  "prank-heist": [
    "{A} and {B} both eye the last picnic basket in the meadow.",
    "{A} tiptoes toward the snack stash. {B} had the same idea.",
    "A rubber duck, a bucket, a plan. {A} versus {B}.",
  ],
  "meme-duel": [
    "{A} cracks their knuckles. {B} loads a fresh meme.",
    "The meadow gathers round: {A} versus {B}, bars at dawn.",
    "{B} opens with a classic. {A} has receipts.",
  ],
  "meadow-race": [
    "{A} and {B} line up at the daisy. Someone yells go.",
    "Dust, pixels, bad decisions: {A} races {B}.",
    "{A} stretches for three whole seconds. {B} just starts running.",
  ],
  "alliance-betrayal": [
    "{A} and {B} shake on a heist. Both smile a little too long.",
    "A pact is made between {A} and {B}. Fingers are crossed behind backs.",
    "{A} trusts {B}. {B} is thinking about it.",
  ],
};

const STEP: string[] = [
  "{W} takes the early lead.",
  "{W} pulls ahead with a ridiculous move.",
  "{W} nails the finish.",
  "{L} fumbles. {W} does not.",
];

const CLOSE: Record<string, string[]> = {
  clean: ["{W} wins it cleanly. {L} files a complaint with the meadow council.", "{W} takes the crown. {L} blames the wind."],
  "photo-finish": ["Photo finish! {W} edges out {L} by a whisker.", "Judges squint at the replay. {W} by a hair over {L}."],
  upset: ["Upset! Nobody had {W} winning that, least of all {L}.", "{W} defies the genes. {L} is stunned."],
  "shared-loot": ["Nobody betrayed anybody. {A} and {B} split the loot. Suspiciously wholesome."],
  betrayal: ["Betrayal! {W} walks off with everything. {L} is still waving.", "{W} pulled the rug. {L} learned a lesson about handshakes."],
  "mutual-backstab": ["Double backstab! Both reached for the knife; {W} was faster than {L}.", "Mutual betrayal. {W} lands it first against {L}."],
  draw: ["A dead heat. {A} and {B} agree to blame the referee."],
};

export interface Narration {
  headline: string;
  lines: string[];
}

export function narrate(input: EngineInput, r: EngineResult, names: { a: string; b: string }): Narration {
  const rng = makeRng(input.seedHash, `${input.eventId}:narration`);
  const pick = <T,>(xs: T[]) => xs[Math.floor(rng() * xs.length)];
  const fill = (s: string, W: string, L: string) =>
    s.replaceAll("{A}", names.a).replaceAll("{B}", names.b).replaceAll("{W}", W).replaceAll("{L}", L);
  const W = r.winner === "b" ? names.b : names.a;
  const L = r.winner === "b" ? names.a : names.b;

  const lines = [fill(pick(OPEN[input.type]), W, L)];
  for (const s of r.log) {
    if (s.betrayA !== undefined) {
      const who = s.betrayA && s.betrayB ? "both go for the knife" : s.betrayA ? `${names.a} goes for the knife` : s.betrayB ? `${names.b} goes for the knife` : "both keep their hands to themselves";
      lines.push(`Final move: ${who}.`);
      continue;
    }
    const sw = s.scoreA >= s.scoreB ? names.a : names.b;
    const sl = sw === names.a ? names.b : names.a;
    lines.push(`Round ${s.n}: ${fill(pick(STEP), sw, sl)}`);
  }
  const key = r.winner === "draw" && r.outcome !== "shared-loot" ? "draw" : r.outcome;
  const headline = fill(pick(CLOSE[key] ?? CLOSE.clean), W, L);
  return { headline, lines };
}
