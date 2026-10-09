export const CHAIN = { id: 143, name: "Monad", explorer: "https://monadscan.com" } as const;

/** League clock is chain-driven: round r is seeded by the hash of block ANCHOR_BLOCK + r * BLOCKS_PER_ROUND. */
export const ANCHOR_BLOCK = 109_500_000;
export const BLOCKS_PER_ROUND = 9_000; // about one hour at Monad's ~0.4s block time
export const ROUNDS_PER_DAY = 24;
export const ROUNDS_PER_SEASON = 168; // one week
/** A seed block is only used once it is this many blocks behind head. */
export const FINALITY_BLOCKS = 200;
/** Nudges lock this many blocks before the seed block exists. */
export const LOCK_BLOCKS = 450;
export const BLOCK_SECONDS = 0.4;
export const LEAGUE_SIZE = 48;

export const RPC_URLS = [
  process.env.NEXT_PUBLIC_MONAD_RPC || "https://rpc.monad.xyz",
  process.env.NEXT_PUBLIC_MONAD_RPC_BACKUP || "https://rpc1.monad.xyz",
].filter(Boolean);

export const CHOG_CONTRACT = (process.env.NEXT_PUBLIC_CHOG_CONTRACT || "") as `0x${string}` | "";
export const LEDGER_ADDRESS = (process.env.NEXT_PUBLIC_LEDGER_ADDRESS || "") as `0x${string}` | "";

export const REPO_URL = "https://github.com/victorhez/ChogChaosLeague";

export const roundSeedBlock = (r: number) => ANCHOR_BLOCK + r * BLOCKS_PER_ROUND;
export const seasonOf = (r: number) => Math.floor(r / ROUNDS_PER_SEASON);
export const dayOf = (r: number) => Math.floor(r / ROUNDS_PER_DAY);
/** Index of the newest round whose seed block is final at head `latest`. */
export const lastClosedRound = (latest: number) => Math.floor((latest - FINALITY_BLOCKS - ANCHOR_BLOCK) / BLOCKS_PER_ROUND);
