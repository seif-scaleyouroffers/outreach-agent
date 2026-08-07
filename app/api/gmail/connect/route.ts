import { NextRequest, NextResponse } from "next/server";
import { Redis } from "@upstash/redis";
import { buildAuthUrl } from "../../../../src/tools/gmail";
import { resolveRedisCredentials } from "../../../../src/redisEnv";

const STATE_TTL_SECONDS = 600;

export async function GET(req: NextRequest) {
  const agentId = req.nextUrl.searchParams.get("agentId");
  if (!agentId) return NextResponse.json({ ok: false, error: "Missing agentId." }, { status: 400 });

  const creds = resolveRedisCredentials();
  if (!creds) return NextResponse.json({ ok: false, error: "Storage isn't configured." }, { status: 500 });
  const redis = new Redis(creds);

  // Short-lived state token ties the OAuth callback back to which agent
  // initiated the connect — same CSRF-protection pattern as the reference tool.
  const state = crypto.randomUUID();
  await redis.set(`gmail-oauth-state:${state}`, agentId, { ex: STATE_TTL_SECONDS });

  return NextResponse.redirect(buildAuthUrl(state));
}
