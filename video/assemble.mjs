// Assembles the final video: scene clips + narration + music bed (ducked under the voice) + captions (.srt).
//   node assemble.mjs
import fs from "node:fs";
import { spawnSync } from "node:child_process";

const meta = JSON.parse(fs.readFileSync("clips/meta.json", "utf8"));
const order = Array.from({ length: 10 }, (_, i) => `s${i + 1}`).filter((id) => meta[id] && fs.existsSync(`clips/${id}.mp4`));
fs.mkdirSync("out", { recursive: true });
const run = (cmd, args) => { const r = spawnSync(cmd, args, { stdio: "inherit" }); if (r.status !== 0) throw new Error(`${cmd} failed`); };

// 1. narration track, each line delayed by its scene's head pad and padded to the scene length
const parts = [];
for (const id of order) {
  const { T, head } = meta[id];
  const out = `clips/${id}.wav`;
  if (fs.existsSync(`audio/${id}.wav`)) {
    run("ffmpeg", ["-y", "-loglevel", "error", "-i", `audio/${id}.wav`, "-af", `adelay=${Math.round(head * 1000)}|${Math.round(head * 1000)},apad=whole_dur=${T},atrim=0:${T}`, "-ar", "44100", "-ac", "2", out]);
  } else {
    run("ffmpeg", ["-y", "-loglevel", "error", "-f", "lavfi", "-i", "anullsrc=r=44100:cl=stereo", "-t", String(T), out]);
  }
  parts.push(out);
}
fs.writeFileSync("clips/audio-list.txt", parts.map((p) => `file '${p.replace("clips/", "")}'`).join("\n"));
run("ffmpeg", ["-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", "clips/audio-list.txt", "-c", "copy", "out/narration.wav"]);

// 2. video: concatenate the (already faded) clips
fs.writeFileSync("clips/video-list.txt", order.map((id) => `file '${id}.mp4'`).join("\n"));
run("ffmpeg", ["-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", "clips/video-list.txt", "-c", "copy", "out/video-only.mp4"]);

const total = order.reduce((a, id) => a + meta[id].T, 0);
console.log(`total length: ${total.toFixed(1)}s`);

// 3. mix: music ducks under the voice (sidechain), gentle fades, loudness-normalised
run("ffmpeg", [
  "-y", "-loglevel", "error", "-i", "out/video-only.mp4", "-i", "out/narration.wav", "-i", "music.wav",
  "-filter_complex",
  `[2:a]atrim=0:${total},afade=t=in:st=0:d=3,afade=t=out:st=${(total - 4).toFixed(2)}:d=4,volume=0.55[m];` +
  `[1:a]asplit=2[v1][v2];[m][v1]sidechaincompress=threshold=0.02:ratio=9:attack=15:release=450[duck];` +
  `[v2][duck]amix=inputs=2:duration=first:weights='1 0.9':normalize=0,loudnorm=I=-15:TP=-1.5:LRA=9[a]`,
  "-map", "0:v", "-map", "[a]", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", "out/chog-chaos-league-demo.mp4",
]);

// 4. captions (.srt) from the scene caption timeline
const ts = (s) => { const ms = Math.round(s * 1000); const p = (n, w = 2) => String(n).padStart(w, "0"); return `${p(Math.floor(ms / 3600000))}:${p(Math.floor((ms % 3600000) / 60000))}:${p(Math.floor((ms % 60000) / 1000))},${p(ms % 1000, 3)}`; };
let n = 1, off = 0, srt = "";
for (const id of order) {
  for (const c of meta[id].caps) srt += `${n++}\n${ts(off + c.s)} --> ${ts(off + c.e)}\n${c.text}\n\n`;
  off += meta[id].T;
}
fs.writeFileSync("out/chog-chaos-league-demo.srt", srt);

// 5. thumbnail
run("ffmpeg", ["-y", "-loglevel", "error", "-ss", "9", "-i", "out/chog-chaos-league-demo.mp4", "-frames:v", "1", "out/thumbnail.png"]);
console.log("done -> out/chog-chaos-league-demo.mp4");
