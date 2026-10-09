export const GENES = ["mischief", "nerve", "wit", "speed", "charm"] as const;
export type GeneKey = (typeof GENES)[number];
export type Genome = Record<GeneKey, number>;

export const STANCES = ["bold", "sneaky", "friendly"] as const;
export type Stance = (typeof STANCES)[number];

export const EVENT_TYPES = ["prank-heist", "meme-duel", "meadow-race", "alliance-betrayal"] as const;
export type EventType = (typeof EVENT_TYPES)[number];

export interface Contender {
  tokenId: number;
  genome: Genome;
  stance: Stance;
}

export interface EngineInput {
  type: EventType;
  /** 0x-prefixed hash of the Monad seed block (or the labelled fallback seed). */
  seedHash: string;
  eventId: string;
  a: Contender;
  b: Contender;
}

export interface LogStep {
  n: number;
  /** Raw seeded rolls, 0..1 (alliance step 3 uses them as betrayal draws). */
  rollA: number;
  rollB: number;
  scoreA: number;
  scoreB: number;
  betrayA?: boolean;
  betrayB?: boolean;
}

export type Winner = "a" | "b" | "draw";

export type Outcome = "clean" | "photo-finish" | "upset" | "shared-loot" | "betrayal" | "mutual-backstab";

export interface EngineResult {
  winner: Winner;
  margin: number;
  totalA: number;
  totalB: number;
  powerA: number;
  powerB: number;
  points: { a: number; b: number };
  upset: boolean;
  highlight: boolean;
  outcome: Outcome;
  log: LogStep[];
  logHash: string;
}
