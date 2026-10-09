import { keccak_256 } from "@noble/hashes/sha3";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils";

export const keccakHex = (s: string): string => "0x" + bytesToHex(keccak_256(utf8ToBytes(s)));

/** sfc32 seeded from keccak256(seed ":" salt). Identical on the server and in the browser. */
export function makeRng(seedHash: string, salt: string): () => number {
  const h = keccak_256(utf8ToBytes(`${seedHash}:${salt}`));
  const dv = new DataView(h.buffer, h.byteOffset, h.byteLength);
  let a = dv.getUint32(0), b = dv.getUint32(4), c = dv.getUint32(8), d = dv.getUint32(12);
  const next = () => {
    a >>>= 0; b >>>= 0; c >>>= 0; d >>>= 0;
    let t = (a + b) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    d = (d + 1) | 0;
    t = (t + d) | 0;
    c = (c + t) | 0;
    return (t >>> 0) / 4294967296;
  };
  for (let i = 0; i < 12; i++) next();
  return next;
}
