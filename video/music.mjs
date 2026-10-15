// Synthesizes an original 8-bit style music bed (pixel meadow vibe). No samples, no licensing.
//   node music.mjs <seconds> <out.wav>
import { writeFileSync } from "node:fs";

const SECONDS = Number(process.argv[2] ?? 170), OUT = process.argv[3] ?? "music.wav";
const SR = 44100, BPM = 116, beat = 60 / BPM, N = Math.floor(SECONDS * SR);
const buf = new Float32Array(N);
const hz = (m) => 440 * 2 ** ((m - 69) / 12);
// A minor feel: Am - F - C - G, two bars each, arpeggiated in 16ths
const prog = [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]];
const bass = [45, 41, 36, 43];
let seed = 12345; const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296) * 2 - 1;
const sq = (ph, duty) => (ph % 1 < duty ? 1 : -1);
const tri = (ph) => 4 * Math.abs((ph % 1) - 0.5) - 1;

const sixteenth = beat / 4;
const steps = Math.floor(SECONDS / sixteenth);
for (let s = 0; s < steps; s++) {
  const t0 = s * sixteenth, bar = Math.floor(s / 16), chord = Math.floor(bar / 2) % 4, k = s % 16;
  const i0 = Math.floor(t0 * SR), len = Math.floor(sixteenth * SR);
  const intro = Math.min(1, t0 / 8), outro = Math.min(1, (SECONDS - t0) / 8), env0 = Math.min(intro, outro);
  const energy = bar < 4 ? 0.55 : bar < 8 ? 0.8 : 1; // builds up
  // arpeggio (square, duty 25%)
  const pat = [0, 1, 2, 1, 0, 1, 2, 1, 0, 1, 2, 1, 2, 1, 0, 1];
  const note = prog[chord][pat[k]] + (k % 8 === 7 ? 12 : 0) + 12;
  const f = hz(note);
  for (let i = 0; i < len && i0 + i < N; i++) {
    const t = i / SR, e = Math.exp(-t * 14);
    buf[i0 + i] += 0.12 * energy * env0 * e * sq(f * t, 0.25);
  }
  // bass (triangle) on beats, with offbeat bumps
  if (k % 4 === 0 || k === 10) {
    const fb = hz(bass[chord]), bl = Math.floor(beat * 0.9 * SR);
    for (let i = 0; i < bl && i0 + i < N; i++) { const t = i / SR; buf[i0 + i] += 0.2 * env0 * Math.exp(-t * 3.2) * tri(fb * t); }
  }
  // kick on beats 1 and 3 once energy rises
  if (bar >= 2 && (k === 0 || k === 8)) {
    const kl = Math.floor(0.18 * SR);
    for (let i = 0; i < kl && i0 + i < N; i++) { const t = i / SR; buf[i0 + i] += 0.3 * env0 * Math.exp(-t * 20) * Math.sin(2 * Math.PI * (120 * Math.exp(-t * 18) + 40) * t); }
  }
  // snare-ish noise on 2 and 4, hats on 8ths
  if (bar >= 4 && (k === 4 || k === 12)) {
    const nl = Math.floor(0.12 * SR);
    for (let i = 0; i < nl && i0 + i < N; i++) { const t = i / SR; buf[i0 + i] += 0.12 * env0 * Math.exp(-t * 28) * rnd(); }
  }
  if (bar >= 2 && k % 2 === 0) {
    const hl = Math.floor(0.03 * SR);
    for (let i = 0; i < hl && i0 + i < N; i++) { const t = i / SR; buf[i0 + i] += 0.05 * env0 * Math.exp(-t * 90) * rnd(); }
  }
  // lead melody (square 50%) every other bar after bar 6
  if (bar >= 6 && bar % 2 === 1 && k % 4 === 0) {
    const mel = [76, 79, 81, 79][(k / 4) | 0] + [0, -4, -9, -2][chord];
    const ml = Math.floor(sixteenth * 3.4 * SR), fm = hz(mel);
    for (let i = 0; i < ml && i0 + i < N; i++) { const t = i / SR; buf[i0 + i] += 0.07 * env0 * Math.exp(-t * 4) * sq(fm * t * (1 + 0.004 * Math.sin(t * 40)), 0.5); }
  }
}
// soft limiter + 16-bit PCM
const pcm = Buffer.alloc(N * 2);
for (let i = 0; i < N; i++) pcm.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(Math.tanh(buf[i] * 1.4) * 30000))), i * 2);
const hdr = Buffer.alloc(44);
hdr.write("RIFF", 0); hdr.writeUInt32LE(36 + pcm.length, 4); hdr.write("WAVEfmt ", 8); hdr.writeUInt32LE(16, 16); hdr.writeUInt16LE(1, 20); hdr.writeUInt16LE(1, 22);
hdr.writeUInt32LE(SR, 24); hdr.writeUInt32LE(SR * 2, 28); hdr.writeUInt16LE(2, 32); hdr.writeUInt16LE(16, 34); hdr.write("data", 36); hdr.writeUInt32LE(pcm.length, 40);
writeFileSync(OUT, Buffer.concat([hdr, pcm]));
console.log("music", SECONDS + "s ->", OUT);
