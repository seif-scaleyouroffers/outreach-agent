import { Redis } from "@upstash/redis";
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

const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days
const sessionKey = (token: string) => `session:${token}`;
const adminSessionKey = (token: string) => `admin-session:${token}`;

export async function createSession(userId: string): Promise<string> {
  const token = crypto.randomUUID();
  await getRedis().set(sessionKey(token), userId, { ex: SESSION_TTL_SECONDS });
  return token;
}

export async function getSessionUserId(token: string): Promise<string | null> {
  return (await getRedis().get<string>(sessionKey(token))) ?? null;
}

export async function deleteSession(token: string): Promise<void> {
  await getRedis().del(sessionKey(token));
}

export async function createAdminSession(): Promise<string> {
  const token = crypto.randomUUID();
  await getRedis().set(adminSessionKey(token), "1", { ex: SESSION_TTL_SECONDS });
  return token;
}

export async function isAdminSessionValid(token: string): Promise<boolean> {
  return (await getRedis().get(adminSessionKey(token))) !== null;
}
