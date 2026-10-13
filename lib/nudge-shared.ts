import type { Stance } from "./engine/types";

export const STANCE_INFO: Record<Stance, { label: string; blurb: string; beats: string }> = {
  bold: { label: "Bold", blurb: "+6% power, wilder rolls", beats: "Crushes Friendly" },
  sneaky: { label: "Sneaky", blurb: "Steady rolls", beats: "Ambushes Bold" },
  friendly: { label: "Friendly", blurb: "+charm, calmer rolls", beats: "Charms Sneaky" },
};

/** Signatures older than this (or from the future) are rejected, so an old signature cannot be replayed. */
export const NUDGE_MAX_AGE_MS = 10 * 60 * 1000;

/** The exact text the owner signs. The server rebuilds it to verify the signature. */
export function nudgeMessage(tokenId: number, day: number, stance: Stance, issuedAt: number, nonce: string): string {
  return `Chog Chaos League nudge\nChog token: #${tokenId}\nDay: ${day}\nStance: ${stance}\nIssued: ${new Date(issuedAt).toISOString()}\nNonce: ${nonce}`;
}
