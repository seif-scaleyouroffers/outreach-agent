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
const USER_LIST_INDEX_KEY = "users:index";

export async function createUser(fields: Omit<StudentUser, "id" | "createdAt" | "updatedAt">): Promise<StudentUser> {
  const client = getRedis();
  const now = Date.now();
  const user: StudentUser = { id: crypto.randomUUID(), ...fields, createdAt: now, updatedAt: now };
  await client.set(userKey(user.id), user);
  await client.set(emailIndexKey(user.email), user.id);
  await client.hset(USER_LIST_INDEX_KEY, { [user.id]: { id: user.id, email: user.email, agentId: user.agentId } });
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

export interface UserSummary {
  id: string;
  email: string;
  agentId: string;
}

export async function listUsers(): Promise<UserSummary[]> {
  const index = await getRedis().hgetall<Record<string, UserSummary>>(USER_LIST_INDEX_KEY);
  if (!index) return [];
  return Object.values(index);
}

/** Revokes login access. Does not delete the underlying agent or its leads/history — see admin UI for that distinction. */
export async function deleteUser(id: string): Promise<boolean> {
  const client = getRedis();
  const user = await getUserById(id);
  if (!user) return false;
  await client.del(userKey(id));
  await client.del(emailIndexKey(user.email));
  await client.hdel(USER_LIST_INDEX_KEY, id);
  return true;
}

// Rebuilds the listing index from the actual user:* records in Redis.
// Needed once, for accounts created before this index existed — their
// records were always there (login worked fine), they just never got
// added to this index since it didn't exist yet when they were created.
// Safe to run anytime; it only ever reconstructs from real records, never
// invents or removes anything.
export async function rebuildUserIndex(): Promise<number> {
  const client = getRedis();
  let cursor = "0";
  let count = 0;
  const entries: Record<string, UserSummary> = {};

  do {
    const [nextCursor, keys] = await client.scan(cursor, { match: "user:*", count: 100 });
    cursor = nextCursor;
    for (const key of keys) {
      const user = await client.get<StudentUser>(key);
      if (user) {
        entries[user.id] = { id: user.id, email: user.email, agentId: user.agentId };
        count++;
      }
    }
  } while (cursor !== "0");

  if (count > 0) await client.hset(USER_LIST_INDEX_KEY, entries);
  return count;
}
