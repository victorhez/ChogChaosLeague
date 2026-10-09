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

export const nudgeStoreKind = () => (REST_URL && REST_TOKEN ? "durable (Redis REST)" : "in-memory (demo)");

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
