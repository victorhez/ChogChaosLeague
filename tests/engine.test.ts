import assert from "node:assert/strict";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { verifyMessage } from "viem";
import { runEvent, WEIGHTS } from "../lib/engine/engine";
import { planRound } from "../lib/engine/round";
import { EVENT_TYPES, GENES } from "../lib/engine/types";
import { decodeGenome, isKnownTrait, MAPPING_CAP } from "../lib/genome/genome";
import { buildTree, leafHash, proofFor, verifyProof } from "../lib/merkle";
import { allChogs, collectionChog, inCollection, TOKEN_IDS } from "../lib/server/collection";
import { aggregate, encodeAgg, eventsForRound, fallbackSeed, getRoster, getSeeds } from "../lib/server/league";
import history from "../lib/history.json";
import { checkNudge } from "../lib/server/nudge-check";
import { nudgeMessage } from "../lib/nudge-shared";
import { COLLECTION_SIZE } from "../lib/config";

let n = 0;
const tests: [string, () => void | Promise<void>][] = [];
const test = (name: string, fn: () => void | Promise<void>) => tests.push([name, fn]);

const seed = "0x" + "ab".repeat(32);
const a = collectionChog(1)!, b = collectionChog(2)!;

test("collection covers token ids 1..1969 with traits", () => {
  assert.equal(TOKEN_IDS.length, COLLECTION_SIZE);
  assert.ok(TOKEN_IDS.every((id, i) => id === i + 1));
  assert.ok(allChogs().every((c) => Object.keys(c.traits).length >= 2));
  assert.ok(!inCollection(0) && !inCollection(1970));
});

test("every real trait value maps through the table (no fallback)", () => {
  const unknown = new Set<string>();
  for (const c of allChogs()) for (const [t, v] of Object.entries(c.traits)) if (!isKnownTrait(t, v)) unknown.add(`${t}:${v}`);
  assert.deepEqual([...unknown], []);
});

test("genomes are deterministic, bounded, and the trait bonus is capped", () => {
  for (const c of allChogs()) {
    assert.deepEqual(decodeGenome(c.traits), c.genome);
    for (const g of GENES) assert.ok(c.genome[g] >= 0 && c.genome[g] <= 40 + MAPPING_CAP);
  }
  const spread = allChogs().map((c) => c.genome.nerve);
  assert.ok(Math.max(...spread) - Math.min(...spread) >= 10, "genomes should vary across the collection");
});

test("same input and seed give an identical result and log hash", () => {
  for (const type of EVENT_TYPES) {
    const input = { type, seedHash: seed, eventId: "r1-e0", a: { tokenId: 1, genome: a.genome, stance: "bold" as const }, b: { tokenId: 2, genome: b.genome, stance: "sneaky" as const } };
    assert.deepEqual(runEvent(input), runEvent(structuredClone(input)));
  }
});

test("a different seed changes the log hash", () => {
  const mk = (s: string) => runEvent({ type: "meme-duel", seedHash: s, eventId: "x", a: { tokenId: 1, genome: a.genome, stance: "bold" }, b: { tokenId: 2, genome: b.genome, stance: "bold" } });
  assert.notEqual(mk(seed).logHash, mk("0x" + "cd".repeat(32)).logHash);
});

test("no single gene weight exceeds 0.4 and weights sum to 1", () => {
  for (const type of EVENT_TYPES) {
    const w = WEIGHTS[type];
    assert.ok(GENES.every((g) => w[g] <= 0.4));
    assert.ok(Math.abs(GENES.reduce((s, g) => s + w[g], 0) - 1) < 1e-9);
  }
});

test("a weaker Chog still wins sometimes (common Chogs stay competitive)", () => {
  const weak = { mischief: 40, nerve: 40, wit: 40, speed: 40, charm: 40 }, strong = { mischief: 58, nerve: 58, wit: 58, speed: 58, charm: 58 };
  let weakWins = 0;
  for (let i = 0; i < 400; i++) {
    const r = runEvent({ type: "prank-heist", seedHash: seed, eventId: `t${i}`, a: { tokenId: 1, genome: weak, stance: "sneaky" }, b: { tokenId: 2, genome: strong, stance: "sneaky" } });
    if (r.winner === "a") weakWins++;
  }
  assert.ok(weakWins > 4 && weakWins < 300, `weak wins ${weakWins}/400`);
});

test("full-roster pairing is deterministic and covers each Chog at most once", () => {
  const roster = TOKEN_IDS;
  const p1 = planRound(seed, 7, roster), p2 = planRound(seed, 7, roster);
  assert.deepEqual(p1, p2);
  const ids = p1.flatMap((p) => [p.a, p.b]);
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(p1.length, Math.floor(COLLECTION_SIZE / 2));
});

test("replay from stored inputs reproduces a full-roster round", () => {
  const roster = allChogs();
  const s = fallbackSeed(5);
  const t0 = Date.now();
  const events = eventsForRound(5, s, roster, {});
  assert.ok(Date.now() - t0 < 5000, "a 984-event round should compute in well under 5s");
  for (const e of events.slice(0, 200)) {
    const again = runEvent({ type: e.type, seedHash: s.hash, eventId: e.eventId, a: { tokenId: e.a.tokenId, genome: e.a.genome, stance: e.a.stance }, b: { tokenId: e.b.tokenId, genome: e.b.genome, stance: e.b.stance } });
    assert.equal(again.logHash, e.result.logHash);
  }
});

test("merkle proofs verify for every leaf and fail when tampered", () => {
  const leaves = Array.from({ length: 13 }, (_, i) => ({ seasonId: 1, tokenId: i + 1, points: i * 3, wins: i, losses: 2, bestStreak: 1 }));
  const tree = buildTree(leaves);
  for (const l of leaves) assert.ok(verifyProof(tree.root, leafHash(l), proofFor(tree, l.tokenId)!));
  assert.ok(!verifyProof(tree.root, leafHash({ ...leaves[3], points: 999 }), proofFor(tree, 4)!));
});

test("precomputed history matches a fresh recompute (rounds 0, 77, 167)", async () => {
  const roster = await getRoster();
  const rows = (history as unknown as { rounds: Record<string, ReturnType<typeof encodeAgg>> }).rounds;
  const seeds = await getSeeds([0, 77, 167]);
  process.env.CCL_NO_HISTORY = "1";
  try {
    for (const r of [0, 77, 167]) assert.deepEqual(encodeAgg(aggregate(r, seeds.get(r)!, roster, {})), rows[r]);
  } finally {
    delete process.env.CCL_NO_HISTORY;
  }
});

// ---- nudge ownership ----
const owner = privateKeyToAccount(generatePrivateKey());
const stranger = privateKeyToAccount(generatePrivateKey());
const NOW = 1_800_000_000_000;
const win = { open: true, day: 21 };
const onChain = { 7: owner.address } as Record<number, string>;
const deps = { ownerOf: async (id: number) => onChain[id] ?? null, verify: (x: Parameters<typeof verifyMessage>[0]) => verifyMessage(x), now: NOW, window: win };
const nonce = "0123456789abcdef0123456789abcdef";
async function signed(acct: typeof owner, tokenId: number, over: Partial<{ day: number; issuedAt: number }> = {}) {
  const day = over.day ?? win.day, issuedAt = over.issuedAt ?? NOW - 1000;
  const signature = await acct.signMessage({ message: nudgeMessage(tokenId, day, "bold", issuedAt, nonce) });
  return { tokenId, stance: "bold", owner: acct.address, day, issuedAt, nonce, signature };
}

test("nudge: the on-chain owner is accepted", async () => {
  const r = await checkNudge(await signed(owner, 7), deps);
  assert.equal(r.ok, true);
});

test("nudge: a wallet that does not own the Chog is rejected (403), even with a valid signature", async () => {
  const r = await checkNudge(await signed(stranger, 7), deps);
  assert.deepEqual([r.ok, !r.ok && r.status], [false, 403]);
});

test("nudge: a signature for another wallet is rejected (401)", async () => {
  const req = await signed(stranger, 7);
  const r = await checkNudge({ ...req, owner: owner.address }, deps);
  assert.deepEqual([r.ok, !r.ok && r.status], [false, 401]);
});

test("nudge: expired signatures, locked rounds and stale days are rejected", async () => {
  const old = await checkNudge(await signed(owner, 7, { issuedAt: NOW - 11 * 60_000 }), deps);
  assert.ok(!old.ok && old.status === 401);
  const locked = await checkNudge(await signed(owner, 7), { ...deps, window: { open: false, day: 21 } });
  assert.ok(!locked.ok && locked.status === 409);
  const stale = await checkNudge(await signed(owner, 7, { day: 20 }), deps);
  assert.ok(!stale.ok && stale.status === 409);
});

test("nudge: tokens outside the collection are rejected", async () => {
  const r = await checkNudge(await signed(owner, 5000), deps);
  assert.ok(!r.ok && r.status === 404);
});

(async () => {
  for (const [name, fn] of tests) {
    await fn();
    n++;
    console.log("ok -", name);
  }
  console.log(`\n${n} tests passed`);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
