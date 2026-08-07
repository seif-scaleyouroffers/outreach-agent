// Invite-only user accounts. Created by /api/admin/invite, never by a
// public signup form — there is no self-serve account creation anywhere
// in this app on purpose.

import { Redis } from "@upstash/redis";
import type { StudentUser } from "./types";
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

const userKey = (id: string) => `user:${id}`;
const emailIndexKey = (email: string) => `user-by-email:${email.trim().toLowerCase()}`;

export async function createUser(fields: Omit<StudentUser, "id" | "createdAt" | "updatedAt">): Promise<StudentUser> {
  const client = getRedis();
  const now = Date.now();
  const user: StudentUser = { id: crypto.randomUUID(), ...fields, createdAt: now, updatedAt: now };
  await client.set(userKey(user.id), user);
  await client.set(emailIndexKey(user.email), user.id);
  return user;
}

export async function getUserByEmail(email: string): Promise<StudentUser | null> {
  const client = getRedis();
  const id = await client.get<string>(emailIndexKey(email));
  if (!id) return null;
  return (await client.get<StudentUser>(userKey(id))) ?? null;
}

export async function getUserById(id: string): Promise<StudentUser | null> {
  return (await getRedis().get<StudentUser>(userKey(id))) ?? null;
}

export async function updateUser(id: string, fields: Partial<StudentUser>): Promise<StudentUser | null> {
  const existing = await getUserById(id);
  if (!existing) return null;
  const updated: StudentUser = { ...existing, ...fields, updatedAt: Date.now() };
  await getRedis().set(userKey(id), updated);
  return updated;
}
