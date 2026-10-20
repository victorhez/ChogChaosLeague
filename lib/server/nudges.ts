import type { Stance } from "../engine/types";

export interface NudgeRecord {
  tokenId: number;
  day: number;
  stance: Stance;
  /** First round this nudge applies to (the first round not yet locked when it was submitted). */
  fromRound: number;
  owner: string;
  signature: string;
}

export type NudgeBook = Record<string, NudgeRecord>;
export const nudgeKey = (tokenId: number, day: number) => `${tokenId}:${day}`;

const REST_URL = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const REST_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
const HASH = "ccl:nudges";

const g = globalThis as unknown as { __nudges?: NudgeBook };
const mem = (g.__nudges ??= {});

export const nudgeStoreKind = () => (REST_URL && REST_TOKEN ? "Redis configured" : "in-memory (nudges can be lost on restart)");

/** Truthful store status: "durable" only if Redis answers a PING right now. */
export async function nudgeStoreHealth(): Promise<{ durable: boolean; label: string }> {
  if (!(REST_URL && REST_TOKEN)) return { durable: false, label: "in-memory: nudges can be lost on restart (connect Redis for durability)" };
  try {
    const pong = await rest(["PING"]);
    return pong === "PONG" ? { durable: true, label: "durable: Redis reachable" } : { durable: false, label: "Redis configured but returned an unexpected reply" };
  } catch {
    return { durable: false, label: "Redis configured but unreachable: falling back to memory" };
  }
}

async function rest(cmd: (string | number)[]): Promise<unknown> {
  const res = await fetch(`${REST_URL}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${REST_TOKEN}`, "content-type": "application/json" },
    body: JSON.stringify(cmd),
    cache: "no-store",
    signal: AbortSignal.timeout(4000),
  });
  return ((await res.json()) as { result: unknown }).result;
}

export async function loadNudges(): Promise<NudgeBook> {
  if (REST_URL && REST_TOKEN) {
    try {
      const flat = (await rest(["HGETALL", HASH])) as string[];
      const book: NudgeBook = {};
      for (let i = 0; i + 1 < flat.length; i += 2) book[flat[i]] = JSON.parse(flat[i + 1]);
      return book;
    } catch {
      return { ...mem };
    }
  }
  return { ...mem };
}

/** First write wins: a nudge for (token, day) cannot be replaced once recorded. */
export async function saveNudge(n: NudgeRecord): Promise<boolean> {
  const key = nudgeKey(n.tokenId, n.day);
  if (REST_URL && REST_TOKEN) {
    try {
      const ok = (await rest(["HSETNX", HASH, key, JSON.stringify(n)])) as number;
      return ok === 1;
    } catch {
      /* fall through to memory */
    }
  }
  if (mem[key]) return false;
  mem[key] = n;
  return true;
}

const SEEDS_KEY = "ccl:seeds";

/** Seed block hashes already read from Monad by any instance (shared, so every instance agrees on every round). */
export async function kvGetSeeds(rounds: number[]): Promise<Map<number, string>> {
  const out = new Map<number, string>();
  if (!(REST_URL && REST_TOKEN) || !rounds.length) return out;
  try {
    const vals = (await rest(["HMGET", SEEDS_KEY, ...rounds.map(String)])) as (string | null)[];
    vals.forEach((v, i) => { if (v && /^0x[0-9a-fA-F]{64}$/.test(v)) out.set(rounds[i], v); });
  } catch {
    /* the store is only a cache; Monad RPC is the source */
  }
  return out;
}

export async function kvSetSeeds(seeds: Map<number, string>): Promise<void> {
  if (!(REST_URL && REST_TOKEN) || !seeds.size) return;
  try {
    await rest(["HSET", SEEDS_KEY, ...[...seeds].flatMap(([r, h]) => [String(r), h])]);
  } catch {
    /* best effort */
  }
}
