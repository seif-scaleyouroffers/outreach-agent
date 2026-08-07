// Do-not-contact list, per agent. Checked before a lead's added (see
// app/api/leads/route.ts) so nobody drafts to someone who's bounced or
// asked to stop. Auto-populated by the reply/bounce poller; also
// manually manageable.

import { Redis } from "@upstash/redis";
import type { SuppressedContact } from "./types";
import { resolveRedisCredentials } from "./redisEnv";

let redis: Redis | null | undefined;

function getRedis(): Redis {
  if (redis === undefined) {
    const creds = resolveRedisCredentials();
    redis = creds ? new Redis(creds) : null;
  }
  if (!redis) {
    throw new Error("Storage isn't configured — set UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN.");
  }
  return redis;
}

const key = (agentId: string) => `suppression:${agentId}`;

export async function addSuppression(agentId: string, email: string, reason: string): Promise<void> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return;
  const entry: SuppressedContact = { email: normalized, reason, addedAt: Date.now() };
  await getRedis().hset(key(agentId), { [normalized]: entry });
}

export async function removeSuppression(agentId: string, email: string): Promise<boolean> {
  const normalized = email.trim().toLowerCase();
  const removed = await getRedis().hdel(key(agentId), normalized);
  return removed > 0;
}

export async function isSuppressed(agentId: string, email: string): Promise<boolean> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return false;
  const entry = await getRedis().hget(key(agentId), normalized);
  return entry !== null;
}

export async function listSuppressed(agentId: string): Promise<SuppressedContact[]> {
  const all = await getRedis().hgetall<Record<string, SuppressedContact>>(key(agentId));
  if (!all) return [];
  return Object.values(all).sort((a, b) => b.addedAt - a.addedAt);
}
