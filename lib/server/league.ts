import { BLOCK_SECONDS, BLOCKS_PER_ROUND, CHOG_CONTRACT, FINALITY_BLOCKS, LEAGUE_SIZE, LOCK_BLOCKS, ROUNDS_PER_SEASON, RPC_URLS, ANCHOR_BLOCK, dayOf, lastClosedRound, roundSeedBlock, seasonOf } from "../config";
import { demoChog, type Chog } from "../chog";
import { fetchChog } from "../chain";
import { keccakHex } from "../engine/prng";
import { runEvent } from "../engine/engine";
import { autopilotStance, planRound } from "../engine/round";
import type { EngineResult, Genome, Stance } from "../engine/types";
import { buildTree, leafHash, proofFor, type LeafData } from "../merkle";
import snapshot from "../seeds.json";
import { loadNudges, nudgeKey, type NudgeBook } from "./nudges";

export interface Seed { block: number; hash: string; source: "monad" | "fallback" }

export interface EventRecord {
  eventId: string;
  roundId: number;
  type: import("../engine/types").EventType;
  seed: Seed;
  a: { tokenId: number; genome: Genome; stance: Stance; nudged: boolean };
  b: { tokenId: number; genome: Genome; stance: Stance; nudged: boolean };
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

export async function getHead(): Promise<Head> {
  try {
    const r = await rpcCall<{ result: string }>({ jsonrpc: "2.0", id: 1, method: "eth_blockNumber", params: [] }, 4);
    return { latest: parseInt(r.result, 16), ok: true, checkedAt: Date.now() };
  } catch {
    // Offline estimate keeps the league clock moving; seeds fall back to the labelled public fallback.
    const est = ANCHOR_BLOCK + Math.floor((Date.now() / 1000 - 1_759_000_000) / BLOCK_SECONDS);
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

let rosterMem: { at: number; chogs: Chog[] } | null = null;
export async function getRoster(): Promise<Chog[]> {
  if (rosterMem && Date.now() - rosterMem.at < 30 * 60_000) return rosterMem.chogs;
  const ids = Array.from({ length: LEAGUE_SIZE }, (_, i) => i + 1);
  const chogs = CHOG_CONTRACT ? await Promise.all(ids.map((id) => fetchChog(id))) : ids.map(demoChog);
  rosterMem = { at: Date.now(), chogs };
  return chogs;
}

export function stanceFor(seed: Seed, roundId: number, tokenId: number, nudges: NudgeBook): { stance: Stance; nudged: boolean } {
  const n = nudges[nudgeKey(tokenId, dayOf(roundId))];
  if (n && roundId >= n.fromRound) return { stance: n.stance, nudged: true };
  return { stance: autopilotStance(seed.hash, roundId, tokenId), nudged: false };
}

const roundMem = new Map<string, EventRecord[]>();

export function eventsForRound(roundId: number, seed: Seed, roster: Chog[], nudges: NudgeBook): EventRecord[] {
  const key = `${roundId}:${seed.hash}:${roster.length}:${Object.keys(nudges).length}`;
  const hit = roundMem.get(key);
  if (hit) return hit;
  const out = computeRound(roundId, seed, roster, nudges);
  if (roundMem.size > 2500) roundMem.clear();
  roundMem.set(key, out);
  return out;
}

function computeRound(roundId: number, seed: Seed, roster: Chog[], nudges: NudgeBook): EventRecord[] {
  const byId = new Map(roster.map((c) => [c.tokenId, c]));
  return planRound(seed.hash, roundId, roster.map((c) => c.tokenId)).map((p) => {
    const sa = stanceFor(seed, roundId, p.a, nudges);
    const sb = stanceFor(seed, roundId, p.b, nudges);
    const a = { tokenId: p.a, genome: byId.get(p.a)!.genome, stance: sa.stance, nudged: sa.nudged };
    const b = { tokenId: p.b, genome: byId.get(p.b)!.genome, stance: sb.stance, nudged: sb.nudged };
    const result = runEvent({ type: p.type, seedHash: seed.hash, eventId: p.eventId, a, b });
    return { eventId: p.eventId, roundId, type: p.type, seed, a, b, result };
  });
}

export interface LeagueState {
  head: Head;
  latestClosed: number;
  liveRound: number;
  blocksToLock: number;
  blocksToSeed: number;
  secondsToLock: number;
  season: number;
}

export function leagueState(head: Head): LeagueState {
  const latestClosed = lastClosedRound(head.latest);
  const liveRound = latestClosed + 1;
  const toSeed = Math.max(0, roundSeedBlock(liveRound) + FINALITY_BLOCKS - head.latest);
  const toLock = Math.max(0, roundSeedBlock(liveRound) - LOCK_BLOCKS - head.latest);
  return { head, latestClosed, liveRound, blocksToLock: toLock, blocksToSeed: toSeed, secondsToLock: Math.round(toLock * BLOCK_SECONDS), season: seasonOf(latestClosed) };
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
  standings: Standing[];
  root: `0x${string}`;
  best: { eventId: string; roundId: number; points: number; tokenId: number } | null;
}

const seasonMem = new Map<string, SeasonResult>();

export async function computeSeason(seasonId: number, latestClosed: number, roster: Chog[], nudges: NudgeBook): Promise<SeasonResult> {
  const first = seasonId * ROUNDS_PER_SEASON;
  const last = Math.min(first + ROUNDS_PER_SEASON - 1, latestClosed);
  const complete = last === first + ROUNDS_PER_SEASON - 1;
  const memKey = `${seasonId}:${last}:${Object.keys(nudges).length}`;
  const hit = seasonMem.get(memKey);
  if (hit) return hit;

  const rounds = last >= first ? Array.from({ length: last - first + 1 }, (_, i) => first + i) : [];
  const seeds = await getSeeds(rounds);
  const st = new Map<number, Standing>(roster.map((c) => [c.tokenId, { tokenId: c.tokenId, points: 0, wins: 0, losses: 0, draws: 0, streak: 0, bestStreak: 0, upsets: 0, betrayals: 0, events: 0, rank: 0, badges: [] }]));
  let best: SeasonResult["best"] = null;

  for (const r of rounds) {
    for (const ev of eventsForRound(r, seeds.get(r)!, roster, nudges)) {
      const sides: [typeof ev.a, "a" | "b"][] = [[ev.a, "a"], [ev.b, "b"]];
      for (const [side, k] of sides) {
        const s = st.get(side.tokenId)!;
        const pts = ev.result.points[k];
        s.points += pts; s.events++;
        if (ev.result.winner === k) {
          s.wins++; s.streak++; s.bestStreak = Math.max(s.bestStreak, s.streak);
          if (ev.result.upset) s.upsets++;
          if (ev.result.outcome === "betrayal") s.betrayals++;
        } else if (ev.result.winner === "draw") { s.draws++; s.streak = 0; } else { s.losses++; s.streak = 0; }
        if (!best || pts > best.points) best = { eventId: ev.eventId, roundId: r, points: pts, tokenId: side.tokenId };
      }
    }
  }

  const standings = [...st.values()].sort((x, y) => y.points - x.points || y.wins - x.wins || x.tokenId - y.tokenId);
  const maxUpsets = Math.max(0, ...standings.map((s) => s.upsets));
  standings.forEach((s, i) => {
    s.rank = i + 1;
    if (i === 0) s.badges.push("Champion");
    else if (i < 3) s.badges.push("Podium");
    else if (i < 10) s.badges.push("Top 10");
    if (s.bestStreak >= 5) s.badges.push("Streak Master");
    if (maxUpsets > 0 && s.upsets === maxUpsets) s.badges.push("Giant Slayer");
    if (s.betrayals >= 3) s.badges.push("Backstabber");
  });

  const leaves: LeafData[] = standings.map((s) => ({ seasonId, tokenId: s.tokenId, points: s.points, wins: s.wins, losses: s.losses, bestStreak: s.bestStreak }));
  const result: SeasonResult = { seasonId, complete, rounds: rounds.length, standings, root: buildTree(leaves).root, best };
  seasonMem.set(memKey, result);
  return result;
}

export function careerProof(season: SeasonResult, tokenId: number) {
  const s = season.standings.find((x) => x.tokenId === tokenId);
  if (!s) return null;
  const leaves: LeafData[] = season.standings.map((x) => ({ seasonId: season.seasonId, tokenId: x.tokenId, points: x.points, wins: x.wins, losses: x.losses, bestStreak: x.bestStreak }));
  const tree = buildTree(leaves);
  const leaf: LeafData = { seasonId: season.seasonId, tokenId, points: s.points, wins: s.wins, losses: s.losses, bestStreak: s.bestStreak };
  return { leaf, leafHash: leafHash(leaf), proof: proofFor(tree, tokenId) ?? [], root: tree.root };
}

export async function loadLeague() {
  const [head, roster, nudges] = await Promise.all([getHead(), getRoster(), loadNudges()]);
  const state = leagueState(head);
  return { state, roster, nudges };
}

export { BLOCKS_PER_ROUND };

export async function loadEvent(eventId: string) {
  const m = /^r(\d{1,7})-e(\d{1,3})$/.exec(eventId);
  if (!m) return null;
  const roundId = Number(m[1]);
  const { state, roster, nudges } = await loadLeague();
  if (roundId > state.latestClosed) return null;
  const seed = (await getSeeds([roundId])).get(roundId)!;
  const ev = eventsForRound(roundId, seed, roster, nudges).find((e) => e.eventId === eventId);
  return ev ? { event: ev, state, roster } : null;
}

/** Events a token played in a season, newest first. */
export async function tokenEvents(tokenId: number, seasonId: number, latestClosed: number, roster: Chog[], nudges: NudgeBook): Promise<EventRecord[]> {
  const first = seasonId * ROUNDS_PER_SEASON;
  const last = Math.min(first + ROUNDS_PER_SEASON - 1, latestClosed);
  const rounds = Array.from({ length: Math.max(0, last - first + 1) }, (_, i) => last - i);
  const seeds = await getSeeds(rounds);
  const out: EventRecord[] = [];
  for (const r of rounds) {
    for (const e of eventsForRound(r, seeds.get(r)!, roster, nudges)) if (e.a.tokenId === tokenId || e.b.tokenId === tokenId) out.push(e);
  }
  return out;
}

export function nudgeWindow(state: LeagueState) {
  const fromRound = state.blocksToLock > 0 ? state.liveRound : state.liveRound + 1;
  return { fromRound, day: dayOf(fromRound), locksInSeconds: state.secondsToLock, open: state.blocksToLock > 0 };
}
