import assert from "node:assert/strict";
import { runEvent, WEIGHTS } from "../lib/engine/engine";
import { planRound } from "../lib/engine/round";
import { EVENT_TYPES, GENES } from "../lib/engine/types";
import { decodeGenome, syntheticTraits } from "../lib/genome/genome";
import { demoChog } from "../lib/chog";
import { buildTree, leafHash, proofFor, verifyProof } from "../lib/merkle";
import { eventsForRound, fallbackSeed } from "../lib/server/league";

let n = 0;
const test = (name: string, fn: () => void) => { fn(); n++; console.log("ok -", name); };

const seed = "0x" + "ab".repeat(32);
const a = demoChog(1), b = demoChog(2);

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

test("genome decoding is deterministic and bounded 0..100", () => {
  for (let id = 1; id <= 200; id++) {
    const g1 = decodeGenome(syntheticTraits(id)), g2 = decodeGenome(syntheticTraits(id));
    assert.deepEqual(g1, g2);
    assert.ok(GENES.every((k) => g1[k] >= 0 && g1[k] <= 100));
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

test("round pairing is deterministic and covers each Chog at most once", () => {
  const roster = Array.from({ length: 48 }, (_, i) => i + 1);
  const p1 = planRound(seed, 7, roster), p2 = planRound(seed, 7, roster);
  assert.deepEqual(p1, p2);
  const ids = p1.flatMap((p) => [p.a, p.b]);
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(p1.length, 24);
});

test("replay from stored inputs reproduces the stored round", () => {
  const roster = Array.from({ length: 48 }, (_, i) => demoChog(i + 1));
  const s = fallbackSeed(5);
  const events = eventsForRound(5, s, roster, {});
  for (const e of events) {
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

console.log(`\n${n} tests passed`);
