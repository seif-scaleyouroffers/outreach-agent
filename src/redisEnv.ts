// Vercel's Redis integrations inject env vars under different names
// depending on how the database was connected — a plain Upstash connection
// uses UPSTASH_REDIS_REST_URL/TOKEN, while the Vercel Marketplace / KV-style
// integration uses KV_REST_API_URL/TOKEN for the same underlying database.
// Accept either so setup isn't naming-convention-fragile.

export function resolveRedisCredentials(): { url: string; token: string } | null {
  const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  return { url, token };
}
