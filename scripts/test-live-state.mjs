// Consistency checks on the live deployment and the public repo.
//   node scripts/test-live-state.mjs [siteUrl]
const site = (process.argv[2] ?? "https://chog-chaos-league.vercel.app").replace(/\/$/, "");
const ANCHOR = 111_518_000, BPR = 9_000, FINALITY = 200;
let pass = 0, fail = 0;
const check = (name, ok, extra = "") => { (ok ? pass++ : fail++); console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? "  → " + extra : ""}`); };
const get = async (p) => { const r = await fetch(site + p); return { status: r.status, text: await r.text() }; };

const league = JSON.parse((await get("/api/league")).text);
const L = league.latestClosedRound, H = league.latestBlock;
console.log(`head ${H.toLocaleString("en-US")}, latest closed round ${L}, live rounds ${league.liveRoundsClosed}\n`);

// 1. a closed round's seed block exists on chain; a future round is "not played yet"
check("latest closed round's seed block is already final on Monad", ANCHOR + L * BPR + FINALITY <= H);
let r = await get(`/event/r${L}-e0`);
check(`closed round r${L}-e0 renders a replayable event`, r.status === 200 && r.text.includes("Check seed against Monad RPC"));
for (const f of [L + 1, L + 5, 380 > L ? 380 : L + 40, 9999]) {
  r = await get(`/event/r${f}-e0`);
  check(`future round r${f}-e0 says "Not played yet" and shows no seed`, r.text.includes("Not played yet") && !r.text.includes("Check seed against Monad RPC") && !/seed hash/i.test(r.text));
}
r = await get(`/api/card/r${L + 5}-e0`);
check("future round has no share card (404)", r.status === 404);

// 2. the testing guide is consistent with the API
const guide = (await get("/test-guide")).text;
const m = /(\d+) live rounds have closed so far/.exec(guide);
check("testing guide live-round count matches /api/league", !!m && Math.abs(Number(m[1]) - league.liveRoundsClosed) <= 1, m ? `${m[1]} vs ${league.liveRoundsClosed}` : "no count found");
const ev = [...guide.matchAll(/\/event\/r(\d+)-e\d+/g)].map((x) => Number(x[1]));
check("testing guide links only closed rounds", ev.length > 0 && ev.every((x) => x <= L), `linked ${[...new Set(ev)].join(", ")}`);
check("testing guide no longer mentions demo adoption or 48 Chogs", !/demo adoption|adopts three demo|1 to 48/i.test(guide));

// 3. status page agrees
const status = (await get("/status")).text;
const sm = /Latest closed round<\/b><span[^>]*>(\d+)/.exec(status) ?? /Latest closed round[^0-9]{0,200}(\d{2,4}) \(season/.exec(status);
check("status page latest closed round matches /api/league", !!sm && Math.abs(Number(sm[1]) - L) <= 1, sm ? `${sm[1]} vs ${L}` : "not found");

// 4. the public repo matches the app
const readme = await (await fetch("https://raw.githubusercontent.com/victorhez/ChogChaosLeague/main/README.md")).text();
check("repo README uses the live epoch block 111,518,000", readme.includes("111,518,000") && !readme.includes("109,500,000"));
check("repo README has no stale claims (48 Chogs, demo traits, ledger not deployed)", !/48 Chogs|demo traits|not deployed/i.test(readme));
check("repo README verify example is a closed round", /verify -- r(\d+)-e\d+/.test(readme) && Number(/verify -- r(\d+)-e\d+/.exec(readme)[1]) <= L);
const commits = await (await fetch("https://api.github.com/repos/victorhez/ChogChaosLeague/commits?per_page=100")).json();
check("repo has the full commit history", Array.isArray(commits) && commits.length >= 10, `${commits.length} commits`);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
