import { BLOCK_SECONDS, FINALITY_BLOCKS, LIVE_FROM_ROUND, LOCK_BLOCKS, ROUNDS_PER_SEASON, RPC_URLS, dayOf, lastClosedRound, roundSeedBlock, seasonOf } from "../config";
import type { Chog } from "../chog";
import { keccakHex } from "../engine/prng";
import { runEvent } from "../engine/engine";
import { autopilotStance, planRound } from "../engine/round";
import type { EngineResult, EventType, Genome, Stance } from "../engine/types";
import { buildTree, leafHash, proofFor, type LeafData, type MerkleTree } from "../merkle";
import snapshot from "../seeds.json";
import history from "../history.json";
import { allChogs } from "./collection";
import { loadNudges, nudgeKey, type NudgeBook } from "./nudges";

export interface Seed { block: number; hash: string; source: "monad" | "fallback" }

export interface Side { tokenId: number; genome: Genome; stance: Stance; nudged: boolean }

export interface EventRecord {
  eventId: string;
  roundId: number;
  type: EventType;
  seed: Seed;
  a: Side;
  b: Side;
  result: EngineResult;
}

async function rpcCall<T>(body: unknown, revalidate: number | false): Promise<T> {
  let last: unknown;
  for (const url of RPC_URLS) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(7000),
        ...(revalidate === false ? { cache: "force-cache" as const } : { next: { revalidate } }),
      });
      if (!res.ok) throw new Error(`rpc ${res.status}`);
      return (await res.json()) as T;
    } catch (e) {
      last = e;
    }
  }
  throw last;
}

export interface Head { latest: number; ok: boolean; checkedAt: number }

/** Last head we saw (or a known point), used to keep the clock moving if RPC is down. */
let lastHead = { block: 113_026_364, at: Date.parse("2026-10-13T16:15:17Z") };

export async function getHead(): Promise<Head> {
  try {
    const r = await rpcCall<{ result: string }>({ jsonrpc: "2.0", id: 1, method: "eth_blockNumber", params: [] }, 4);
    const latest = parseInt(r.result, 16);
    lastHead = { block: latest, at: Date.now() };
    return { latest, ok: true, checkedAt: Date.now() };
  } catch {
    const est = lastHead.block + Math.floor((Date.now() - lastHead.at) / 1000 / BLOCK_SECONDS);
    return { latest: est, ok: false, checkedAt: Date.now() };
  }
}

export const fallbackSeed = (round: number): Seed => ({ block: roundSeedBlock(round), hash: keccakHex(`chog-chaos-league:fallback:${round}`), source: "fallback" });

const seedMem = new Map<number, Seed>(
  Object.entries(snapshot as Record<string, string>).map(([r, hash]) => [Number(r), { block: roundSeedBlock(Number(r)), hash, source: "monad" as const }]),
);

export async function getSeeds(rounds: number[]): Promise<Map<number, Seed>> {
  const need = rounds.filter((r) => !seedMem.has(r));
  if (need.length) {
    try {
      const batch = need.map((r, i) => ({ jsonrpc: "2.0", id: i, method: "eth_getBlockByNumber", params: ["0x" + roundSeedBlock(r).toString(16), false] }));
      for (let i = 0; i < batch.length; i += 25) {
        const slice = batch.slice(i, i + 25);
        const res = await rpcCall<{ id: number; result?: { hash: string } }[]>(slice, false);
        if (!Array.isArray(res)) continue;
        for (const item of res) {
          const r = need[item.id];
          if (item.result?.hash) seedMem.set(r, { block: roundSeedBlock(r), hash: item.result.hash, source: "monad" });
        }
      }
    } catch {
      /* fall through to fallback seeds below */
    }
  }
  const out = new Map<number, Seed>();
  for (const r of rounds) out.set(r, seedMem.get(r) ?? fallbackSeed(r));
  return out;
}

/** Every Chog in the collection plays. The list is built from the Chog Genesis token ids and traits. */
export async function getRoster(): Promise<Chog[]> {
  return allChogs();
}

const genomeIndex = new WeakMap<Chog[], Map<number, Chog>>();
function indexOf(roster: Chog[]) {
  let m = genomeIndex.get(roster);
  if (!m) { m = new Map(roster.map((c) => [c.tokenId, c])); genomeIndex.set(roster, m); }
  return m;
}

export function stanceFor(seed: Seed, roundId: number, tokenId: number, nudges: NudgeBook): { stance: Stance; nudged: boolean } {
  const n = nudges[nudgeKey(tokenId, dayOf(roundId))];
  if (n && roundId >= n.fromRound) return { stance: n.stance, nudged: true };
  return { stance: autopilotStance(seed.hash, roundId, tokenId), nudged: false };
}

function playPairing(roundId: number, seed: Seed, p: { eventId: string; type: EventType; a: number; b: number }, by: Map<number, Chog>, nudges: NudgeBook, hash: boolean): EventRecord {
  const sa = stanceFor(seed, roundId, p.a, nudges);
  const sb = stanceFor(seed, roundId, p.b, nudges);
  const a: Side = { tokenId: p.a, genome: by.get(p.a)!.genome, stance: sa.stance, nudged: sa.nudged };
  const b: Side = { tokenId: p.b, genome: by.get(p.b)!.genome, stance: sb.stance, nudged: sb.nudged };
  const result = runEvent({ type: p.type, seedHash: seed.hash, eventId: p.eventId, a, b }, { skipHash: !hash });
  return { eventId: p.eventId, roundId, type: p.type, seed, a, b, result };
}

/** How many nudges affect round r. Used in memo keys so a new nudge only invalidates the rounds it touches. */
function nudgeSig(roundId: number, nudges: NudgeBook): number {
  const day = dayOf(roundId);
  let n = 0;
  for (const k in nudges) { const v = nudges[k]; if (v.day === day && roundId >= v.fromRound) n++; }
  return n;
}

const roundMem = new Map<string, EventRecord[]>();

export function eventsForRound(roundId: number, seed: Seed, roster: Chog[], nudges: NudgeBook): EventRecord[] {
  const key = `${roundId}:${seed.hash}:${nudgeSig(roundId, nudges)}`;
  const hit = roundMem.get(key);
  if (hit) return hit;
  const by = indexOf(roster);
  const out = planRound(seed.hash, roundId, roster.map((c) => c.tokenId)).map((p) => playPairing(roundId, seed, p, by, nudges, true));
  if (roundMem.size >= 10) roundMem.delete(roundMem.keys().next().value as string);
  roundMem.set(key, out);
  return out;
}

export interface LeagueState {
  head: Head;
  latestClosed: number;
  liveRound: number;
  blocksToLock: number;
  blocksToSeed: number;
  secondsToLock: number;
  season: number;
  /** Rounds closed since the real-collection league went live (excludes replayed history). */
  liveRoundsClosed: number;
}

export function leagueState(head: Head): LeagueState {
  const latestClosed = lastClosedRound(head.latest);
  const liveRound = latestClosed + 1;
  const toSeed = Math.max(0, roundSeedBlock(liveRound) + FINALITY_BLOCKS - head.latest);
  const toLock = Math.max(0, roundSeedBlock(liveRound) - LOCK_BLOCKS - head.latest);
  return {
    head, latestClosed, liveRound, blocksToLock: toLock, blocksToSeed: toSeed,
    secondsToLock: Math.round(toLock * BLOCK_SECONDS), season: seasonOf(latestClosed),
    liveRoundsClosed: Math.max(0, latestClosed - LIVE_FROM_ROUND + 1),
  };
}

export async function recentRounds(latestClosed: number, count: number, roster: Chog[], nudges: NudgeBook) {
  const ids = Array.from({ length: count }, (_, i) => latestClosed - i).filter((r) => r >= 0);
  const seeds = await getSeeds(ids);
  return ids.map((r) => ({ roundId: r, seed: seeds.get(r)!, events: eventsForRound(r, seeds.get(r)!, roster, nudges) }));
}

export interface Standing {
  tokenId: number;
  points: number;
  wins: number;
  losses: number;
  draws: number;
  streak: number;
  bestStreak: number;
  upsets: number;
  betrayals: number;
  events: number;
  rank: number;
  badges: string[];
}

export interface SeasonResult {
  seasonId: number;
  complete: boolean;
  rounds: number;
  /** Season consists only of replayed history (no owner ever nudged these rounds). */
  history: boolean;
  /** How many of its rounds are replayed history. */
  historyRounds: number;
  standings: Standing[];
  root: `0x${string}`;
  best: { eventId: string; roundId: number; points: number; tokenId: number } | null;
}

const seasonMem = new Map<string, SeasonResult>();
const treeMem = new WeakMap<SeasonResult, MerkleTree>();

/** Compact per-round outcome per token (indexed by roster position): points and a result code. */
interface RoundAgg { pts: Uint8Array; res: Uint8Array; best: { eventId: string; points: number; tokenId: number } | null }
const RES_BENCH = 0, RES_WIN = 1, RES_LOSS = 2, RES_DRAW = 3, FLAG_UPSET = 4, FLAG_BETRAYAL = 8;
const aggMem = new Map<string, RoundAgg>();

type HistoryRow = { p: string; r: string; b: [string, number, number] | null };
const HISTORY = (history as { rounds: Record<string, HistoryRow> }).rounds;

/** Replayed-history rounds never had a nudge, so their aggregates are immutable and shipped precomputed. */
function fromHistory(roundId: number, size: number): RoundAgg | null {
  const row = HISTORY[roundId];
  if (!row || process.env.CCL_NO_HISTORY) return null;
  const pts = Uint8Array.from(Buffer.from(row.p, "base64")), res = Uint8Array.from(Buffer.from(row.r, "base64"));
  if (pts.length !== size) return null;
  return { pts, res, best: row.b ? { eventId: row.b[0], points: row.b[1], tokenId: row.b[2] } : null };
}

export function encodeAgg(a: RoundAgg): HistoryRow {
  return { p: Buffer.from(a.pts).toString("base64"), r: Buffer.from(a.res).toString("base64"), b: a.best ? [a.best.eventId, a.best.points, a.best.tokenId] : null };
}

export function aggregate(roundId: number, seed: Seed, roster: Chog[], nudges: NudgeBook): RoundAgg {
  if (roundId < LIVE_FROM_ROUND) { const h = fromHistory(roundId, roster.length); if (h) return h; }
  const key = `${roundId}:${seed.hash}:${nudgeSig(roundId, nudges)}`;
  const hit = aggMem.get(key);
  if (hit) return hit;
  const by = indexOf(roster);
  const pos = new Map(roster.map((c, i) => [c.tokenId, i]));
  const agg: RoundAgg = { pts: new Uint8Array(roster.length), res: new Uint8Array(roster.length), best: null };
  for (const p of planRound(seed.hash, roundId, roster.map((c) => c.tokenId))) {
    const ev = playPairing(roundId, seed, p, by, nudges, false);
    const r = ev.result;
    const sides: [Side, "a" | "b"][] = [[ev.a, "a"], [ev.b, "b"]];
    for (const [side, k] of sides) {
      const i = pos.get(side.tokenId)!;
      const pts = r.points[k];
      agg.pts[i] = pts;
      let code = r.winner === k ? RES_WIN : r.winner === "draw" ? RES_DRAW : RES_LOSS;
      if (r.winner === k && r.upset) code |= FLAG_UPSET;
      if (r.winner === k && r.outcome === "betrayal") code |= FLAG_BETRAYAL;
      agg.res[i] = code;
      if (!agg.best || pts > agg.best.points) agg.best = { eventId: ev.eventId, points: pts, tokenId: side.tokenId };
    }
  }
  if (aggMem.size >= 420) aggMem.delete(aggMem.keys().next().value as string);
  aggMem.set(key, agg);
  return agg;
}

export async function computeSeason(seasonId: number, latestClosed: number, roster: Chog[], nudges: NudgeBook): Promise<SeasonResult> {
  const first = seasonId * ROUNDS_PER_SEASON;
  const last = Math.min(first + ROUNDS_PER_SEASON - 1, latestClosed);
  const complete = last === first + ROUNDS_PER_SEASON - 1;
  const memKey = `${seasonId}:${last}:${Object.keys(nudges).length}`;
  const hit = seasonMem.get(memKey);
  if (hit) return hit;

  const rounds = last >= first ? Array.from({ length: last - first + 1 }, (_, i) => first + i) : [];
  const seeds = await getSeeds(rounds);
  const n = roster.length;
  const st: Standing[] = roster.map((c) => ({ tokenId: c.tokenId, points: 0, wins: 0, losses: 0, draws: 0, streak: 0, bestStreak: 0, upsets: 0, betrayals: 0, events: 0, rank: 0, badges: [] }));
  let best: (SeasonResult["best"] & { points: number }) | null = null;

  for (const r of rounds) {
    const agg = aggregate(r, seeds.get(r)!, roster, nudges);
    for (let i = 0; i < n; i++) {
      const code = agg.res[i];
      if (code === RES_BENCH) continue;
      const s = st[i];
      s.points += agg.pts[i]; s.events++;
      const base = code & 3;
      if (base === RES_WIN) {
        s.wins++; s.streak++; if (s.streak > s.bestStreak) s.bestStreak = s.streak;
        if (code & FLAG_UPSET) s.upsets++;
        if (code & FLAG_BETRAYAL) s.betrayals++;
      } else if (base === RES_DRAW) { s.draws++; s.streak = 0; } else { s.losses++; s.streak = 0; }
    }
    if (agg.best && (!best || agg.best.points > best.points)) best = { eventId: agg.best.eventId, roundId: r, points: agg.best.points, tokenId: agg.best.tokenId };
  }

  const standings = [...st].sort((x, y) => y.points - x.points || y.wins - x.wins || x.tokenId - y.tokenId);
  const maxUpsets = Math.max(0, ...standings.map((s) => s.upsets));
  standings.forEach((s, i) => {
    s.rank = i + 1;
    if (i === 0 && rounds.length) s.badges.push("Champion");
    else if (i < 3 && rounds.length) s.badges.push("Podium");
    else if (i < 10 && rounds.length) s.badges.push("Top 10");
    if (s.bestStreak >= 5) s.badges.push("Streak Master");
    if (maxUpsets > 1 && s.upsets === maxUpsets) s.badges.push("Giant Slayer");
    if (s.betrayals >= 3) s.badges.push("Backstabber");
  });

  const leaves = standings.map((s): LeafData => ({ seasonId, tokenId: s.tokenId, points: s.points, wins: s.wins, losses: s.losses, bestStreak: s.bestStreak }));
  const tree = buildTree(leaves);
  const historyRounds = rounds.filter((r) => r < LIVE_FROM_ROUND).length;
  const result: SeasonResult = { seasonId, complete, rounds: rounds.length, history: rounds.length > 0 && historyRounds === rounds.length, historyRounds, standings, root: tree.root, best };
  treeMem.set(result, tree);
  if (seasonMem.size > 8) seasonMem.delete(seasonMem.keys().next().value as string);
  seasonMem.set(memKey, result);
  return result;
}

export function careerProof(season: SeasonResult, tokenId: number) {
  const s = season.standings.find((x) => x.tokenId === tokenId);
  const tree = treeMem.get(season);
  if (!s || !tree) return null;
  const leaf: LeafData = { seasonId: season.seasonId, tokenId, points: s.points, wins: s.wins, losses: s.losses, bestStreak: s.bestStreak };
  return { leaf, leafHash: leafHash(leaf), proof: proofFor(tree, tokenId) ?? [], root: tree.root };
}

export async function loadLeague() {
  const [head, roster, nudges] = await Promise.all([getHead(), getRoster(), loadNudges()]);
  const state = leagueState(head);
  return { state, roster, nudges };
}

export async function loadEvent(eventId: string) {
  const m = /^r(\d{1,7})-e(\d{1,4})$/.exec(eventId);
  if (!m) return null;
  const roundId = Number(m[1]);
  const { state, roster, nudges } = await loadLeague();
  if (roundId > state.latestClosed) return null;
  const seed = (await getSeeds([roundId])).get(roundId)!;
  const by = indexOf(roster);
  const p = planRound(seed.hash, roundId, roster.map((c) => c.tokenId)).find((x) => x.eventId === eventId);
  if (!p) return null;
  return { event: playPairing(roundId, seed, p, by, nudges, true), state, roster };
}

/** Events a token played in a season, newest first. Runs only that token's pairing in each round. */
export async function tokenEvents(tokenId: number, seasonId: number, latestClosed: number, roster: Chog[], nudges: NudgeBook): Promise<EventRecord[]> {
  const first = seasonId * ROUNDS_PER_SEASON;
  const last = Math.min(first + ROUNDS_PER_SEASON - 1, latestClosed);
  const rounds = Array.from({ length: Math.max(0, last - first + 1) }, (_, i) => last - i);
  const seeds = await getSeeds(rounds);
  const by = indexOf(roster);
  const ids = roster.map((c) => c.tokenId);
  const out: EventRecord[] = [];
  for (const r of rounds) {
    const seed = seeds.get(r)!;
    const p = planRound(seed.hash, r, ids).find((x) => x.a === tokenId || x.b === tokenId);
    if (p) out.push(playPairing(r, seed, p, by, nudges, true));
  }
  return out;
}

export function nudgeWindow(state: LeagueState) {
  const fromRound = state.blocksToLock > 0 ? state.liveRound : state.liveRound + 1;
  return { fromRound, day: dayOf(fromRound), locksInSeconds: state.secondsToLock, open: state.blocksToLock > 0 };
}
