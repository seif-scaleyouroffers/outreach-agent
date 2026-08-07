import { Redis } from "@upstash/redis";
import type { LeadRecord } from "./types";
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

const leadKey = (agentId: string, leadId: string) => `lead:${agentId}:${leadId}`;
const indexKey = (agentId: string) => `lead-index:${agentId}`;

export async function createLead(
  fields: Omit<LeadRecord, "id" | "status" | "createdAt" | "updatedAt">
): Promise<LeadRecord> {
  const client = getRedis();
  const now = Date.now();
  const lead: LeadRecord = { id: crypto.randomUUID(), status: "pending", createdAt: now, updatedAt: now, ...fields };
  await client.set(leadKey(lead.agentId, lead.id), lead);
  await client.sadd(indexKey(lead.agentId), lead.id);
  return lead;
}

export async function getLead(agentId: string, leadId: string): Promise<LeadRecord | null> {
  return (await getRedis().get<LeadRecord>(leadKey(agentId, leadId))) ?? null;
}

export async function updateLead(
  agentId: string,
  leadId: string,
  fields: Partial<LeadRecord>
): Promise<LeadRecord | null> {
  const existing = await getLead(agentId, leadId);
  if (!existing) return null;
  const updated: LeadRecord = { ...existing, ...fields, updatedAt: Date.now() };
  await getRedis().set(leadKey(agentId, leadId), updated);
  return updated;
}

export async function listLeads(agentId: string): Promise<LeadRecord[]> {
  const client = getRedis();
  const ids = await client.smembers(indexKey(agentId));
  if (!ids || ids.length === 0) return [];
  const leads = await Promise.all(ids.map((id) => client.get<LeadRecord>(leadKey(agentId, id))));
  return leads.filter((l): l is LeadRecord => l !== null).sort((a, b) => b.createdAt - a.createdAt);
}
