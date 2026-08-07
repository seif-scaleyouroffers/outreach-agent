// One connected Gmail account per student agent. Storing tokens per-agent
// (rather than per-student-login, since there's no auth system yet) means
// each agent link's owner connects their own inbox once and it's remembered.

import { Redis } from "@upstash/redis";
import type { GmailAccount } from "./types";
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

const key = (agentId: string) => `gmail-account:${agentId}`;

export async function saveGmailAccount(account: GmailAccount): Promise<void> {
  await getRedis().set(key(account.agentId), account);
}

export async function getGmailAccount(agentId: string): Promise<GmailAccount | null> {
  return (await getRedis().get<GmailAccount>(key(agentId))) ?? null;
}

export async function updateGmailAccountTokens(agentId: string, fields: Partial<GmailAccount>): Promise<void> {
  const existing = await getGmailAccount(agentId);
  if (!existing) return;
  await saveGmailAccount({ ...existing, ...fields });
}

export async function updateGmailSignature(agentId: string, signature: string): Promise<GmailAccount | null> {
  const existing = await getGmailAccount(agentId);
  if (!existing) return null;
  const updated = { ...existing, signature };
  await saveGmailAccount(updated);
  return updated;
}

export async function disconnectGmailAccount(agentId: string): Promise<void> {
  await getRedis().del(key(agentId));
}
