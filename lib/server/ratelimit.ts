const buckets = new Map<string, { n: number; reset: number }>();

/** Small fixed-window limiter per client and route (per server instance). Returns true when over the limit. */
export function limited(req: Request, route: string, perMinute: number): boolean {
  const ip = (req.headers.get("x-forwarded-for") ?? "local").split(",")[0].trim();
  const key = `${route}:${ip}`;
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.reset < now) {
    if (buckets.size > 5000) buckets.clear();
    buckets.set(key, { n: 1, reset: now + 60_000 });
    return false;
  }
  b.n++;
  return b.n > perMinute;
}
