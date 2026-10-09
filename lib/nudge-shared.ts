import type { Stance } from "./engine/types";

export const STANCE_INFO: Record<Stance, { label: string; blurb: string; beats: string }> = {
  bold: { label: "Bold", blurb: "+6% power, wilder rolls", beats: "Crushes Friendly" },
  sneaky: { label: "Sneaky", blurb: "Steady rolls", beats: "Ambushes Bold" },
  friendly: { label: "Friendly", blurb: "+charm, calmer rolls", beats: "Charms Sneaky" },
};

/** The exact text the owner signs. The server rebuilds it to verify the signature. */
export function nudgeMessage(tokenId: number, day: number, stance: Stance): string {
  return `Chog Chaos League nudge\nChog: #${tokenId}\nDay: ${day}\nStance: ${stance}`;
}
