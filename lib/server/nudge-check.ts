import { STANCES, type Stance } from "../engine/types";
import { NUDGE_MAX_AGE_MS, nudgeMessage } from "../nudge-shared";
import { inCollection } from "./collection";

export interface NudgeRequest {
  tokenId?: number;
  stance?: string;
  owner?: string;
  day?: number;
  issuedAt?: number;
  nonce?: string;
  signature?: string;
}

export interface NudgeDeps {
  ownerOf: (tokenId: number) => Promise<string | null>;
  verify: (a: { address: `0x${string}`; message: string; signature: `0x${string}` }) => Promise<boolean>;
  now: number;
  window: { open: boolean; day: number };
}

export type NudgeCheck =
  | { ok: true; tokenId: number; stance: Stance; owner: `0x${string}`; signature: string }
  | { ok: false; status: number; error: string };

const fail = (status: number, error: string): NudgeCheck => ({ ok: false, status, error });

/** Pure validation of a signed nudge. Ownership is read from the Chog contract at lock time. */
export async function checkNudge(r: NudgeRequest, d: NudgeDeps): Promise<NudgeCheck> {
  if (!r.tokenId || !r.owner || !r.signature || !r.issuedAt || !r.nonce || !STANCES.includes(r.stance as Stance)) return fail(400, "Bad request");
  if (!/^0x[0-9a-fA-F]{40}$/.test(r.owner) || !/^0x[0-9a-fA-F]+$/.test(r.signature) || !/^[0-9a-f]{16,64}$/.test(r.nonce)) return fail(400, "Bad request");
  if (!inCollection(r.tokenId)) return fail(404, "That token is not in the Chog collection.");
  if (!d.window.open) return fail(409, "This round is locked. A nudge counts from the next unlocked round; try again shortly.");
  if (r.day !== d.window.day) return fail(409, "The day rolled over while you were signing. Please sign again.");
  if (Math.abs(d.now - r.issuedAt) > NUDGE_MAX_AGE_MS) return fail(401, "That signature has expired. Please sign again.");

  const owner = r.owner as `0x${string}`;
  const stance = r.stance as Stance;
  const ok = await d
    .verify({ address: owner, message: nudgeMessage(r.tokenId, d.window.day, stance, r.issuedAt, r.nonce), signature: r.signature as `0x${string}` })
    .catch(() => false);
  if (!ok) return fail(401, "The signature does not match this wallet.");

  const actual = await d.ownerOf(r.tokenId);
  if (!actual) return fail(503, "Could not read the Chog owner from Monad. Try again.");
  if (actual.toLowerCase() !== owner.toLowerCase()) return fail(403, "This wallet does not own that Chog.");
  return { ok: true, tokenId: r.tokenId, stance, owner, signature: r.signature };
}
