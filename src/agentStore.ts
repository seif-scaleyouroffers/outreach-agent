// Persistence for student outreach agents. Each student gets one saved
// agent (id -> shareable link at /agent/<id>). Backed by this app's own
// Upstash Redis database — a separate instance from any other internal
// tool, so there's no shared data or shared deploy between them.

import { Redis } from "@upstash/redis";
import type { StudentAgent, StudentAgentFields } from "./types";
import { resolveRedisCredentials } from "./redisEnv";

let redis: Redis | null | undefined;

function getRedis(): Redis {
  if (redis === undefined) {
    const creds = resolveRedisCredentials();
    redis = creds ? new Redis(creds) : null;
  }
  if (!redis) {
    throw new Error(
      "Agent storage isn't configured — set UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN (or KV_REST_API_URL / KV_REST_API_TOKEN)."
    );
  }
  return redis;
}

const INDEX_KEY = "student-agents:index";
const agentKey = (id: string) => `student-agent:${id}`;

export async function createStudentAgent(fields: StudentAgentFields): Promise<StudentAgent> {
  const client = getRedis();
  const now = Date.now();
  const agent: StudentAgent = { id: crypto.randomUUID(), ...fields, createdAt: now, updatedAt: now };
  await client.set(agentKey(agent.id), agent);
  await client.hset(INDEX_KEY, { [agent.id]: { id: agent.id, studentName: agent.studentName, updatedAt: now } });
  return agent;
}

export async function updateStudentAgent(
  id: string,
  fields: StudentAgentFields
): Promise<StudentAgent | null> {
  const client = getRedis();
  const existing = await client.get<StudentAgent>(agentKey(id));
  if (!existing) return null;
  const updated: StudentAgent = { ...existing, ...fields, id, updatedAt: Date.now() };
  await client.set(agentKey(id), updated);
  await client.hset(INDEX_KEY, { [id]: { id, studentName: updated.studentName, updatedAt: updated.updatedAt } });
  return updated;
}

export async function getStudentAgent(id: string): Promise<StudentAgent | null> {
  const client = getRedis();
  return (await client.get<StudentAgent>(agentKey(id))) ?? null;
}

export async function listStudentAgents(): Promise<{ id: string; studentName: string; updatedAt: number }[]> {
  const client = getRedis();
  const index = await client.hgetall<Record<string, { id: string; studentName: string; updatedAt: number }>>(
    INDEX_KEY
  );
  if (!index) return [];
  return Object.values(index).sort((a, b) => b.updatedAt - a.updatedAt);
}
