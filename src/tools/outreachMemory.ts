// Outreach memory — hosted port of Stage 1's local MCP server logic.
//
// Stage 1 (Python, local SQLite, one file per student) exposed four tools:
// log_message, update_outcome, get_outreach_context, get_performance_summary.
// Same four operations here, same ranking/fallback/sample-size rules, just
// backed by this app's own Redis instance so it works for every student from
// one hosted app instead of a local file per student.

import { Redis } from "@upstash/redis";
import type { Channel, OutreachMessage, Outcome } from "../types";

let redis: Redis | null | undefined;

function getRedis(): Redis {
  if (redis === undefined) {
    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;
    redis = url && token ? new Redis({ url, token }) : null;
  }
  if (!redis) {
    throw new Error(
      "Outreach memory storage isn't configured — set UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN."
    );
  }
  return redis;
}

function messageKey(agentId: string, messageId: string) {
  return `msg:${agentId}:${messageId}`;
}
function indexKey(agentId: string) {
  return `msg-index:${agentId}`;
}

// --- log_message -----------------------------------------------------------
export async function logMessage(
  agentId: string,
  channel: Channel,
  leadCompany: string,
  messageText: string
): Promise<OutreachMessage> {
  const client = getRedis();
  const now = Date.now();
  const message: OutreachMessage = {
    id: crypto.randomUUID(),
    agentId,
    channel,
    leadCompany,
    messageText,
    outcome: "pending",
    createdAt: now,
    updatedAt: now,
  };
  await client.set(messageKey(agentId, message.id), message);
  await client.sadd(indexKey(agentId), message.id);
  return message;
}

// --- update_outcome ----------------------------------------------------------
export async function updateOutcome(
  agentId: string,
  messageId: string,
  outcome: Outcome
): Promise<OutreachMessage | null> {
  const client = getRedis();
  const existing = await client.get<OutreachMessage>(messageKey(agentId, messageId));
  if (!existing) return null;
  const updated: OutreachMessage = { ...existing, outcome, updatedAt: Date.now() };
  await client.set(messageKey(agentId, messageId), updated);
  return updated;
}

async function getAllMessages(agentId: string): Promise<OutreachMessage[]> {
  const client = getRedis();
  const ids = await client.smembers(indexKey(agentId));
  if (!ids || ids.length === 0) return [];
  const messages = await Promise.all(
    ids.map((id) => client.get<OutreachMessage>(messageKey(agentId, id)))
  );
  return messages.filter((m): m is OutreachMessage => m !== null);
}

// --- get_outreach_context ----------------------------------------------------
// Returns the student's best-performing past messages: ranked booked >
// replied, filtered to channel when possible, with graceful fallback to all
// data if the filtered set is too sparse to be useful.
export async function getOutreachContext(
  agentId: string,
  channel: Channel,
  limit = 5
): Promise<OutreachMessage[]> {
  const all = await getAllMessages(agentId);

  const rank = (o: Outcome) => (o === "booked" ? 2 : o === "replied" ? 1 : 0);
  const sortByPerformance = (msgs: OutreachMessage[]) =>
    [...msgs].sort((a, b) => rank(b.outcome) - rank(a.outcome) || b.updatedAt - a.updatedAt);

  const sameChannel = all.filter((m) => m.channel === channel && m.outcome !== "pending");
  const MIN_USEFUL = 3;

  const pool = sameChannel.length >= MIN_USEFUL ? sameChannel : all.filter((m) => m.outcome !== "pending");
  return sortByPerformance(pool).slice(0, limit);
}

// --- get_performance_summary --------------------------------------------------
export interface PerformanceSummary {
  overall: { total: number; replyRate: number; bookedRate: number };
  byChannel: Record<string, { total: number; replyRate: number; bookedRate: number }>;
}

export async function getPerformanceSummary(agentId: string): Promise<PerformanceSummary> {
  const all = await getAllMessages(agentId);
  const MIN_GROUP = 3;

  const rates = (msgs: OutreachMessage[]) => {
    const total = msgs.length;
    const replied = msgs.filter((m) => m.outcome === "replied" || m.outcome === "booked").length;
    const booked = msgs.filter((m) => m.outcome === "booked").length;
    return {
      total,
      replyRate: total ? replied / total : 0,
      bookedRate: total ? booked / total : 0,
    };
  };

  const byChannel: PerformanceSummary["byChannel"] = {};
  const channels = new Set(all.map((m) => m.channel));
  for (const channel of channels) {
    const group = all.filter((m) => m.channel === channel);
    if (group.length >= MIN_GROUP) byChannel[channel] = rates(group);
  }

  return { overall: rates(all), byChannel };
}
