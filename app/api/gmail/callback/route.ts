import { NextRequest, NextResponse } from "next/server";
import { Redis } from "@upstash/redis";
import { exchangeCode, getUserEmail } from "../../../../src/tools/gmail";
import { saveGmailAccount, getGmailAccount } from "../../../../src/gmailAccountStore";
import { resolveRedisCredentials } from "../../../../src/redisEnv";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const error = req.nextUrl.searchParams.get("error");

  const creds = resolveRedisCredentials();
  if (!creds) return NextResponse.json({ ok: false, error: "Storage isn't configured." }, { status: 500 });
  const redis = new Redis(creds);

  if (error || !code || !state) {
    return NextResponse.redirect(new URL(`/?error=gmail_oauth_failed`, req.url));
  }

  const stateKey = `gmail-oauth-state:${state}`;
  const agentId = await redis.get<string>(stateKey);
  if (!agentId) {
    return NextResponse.redirect(new URL(`/?error=gmail_invalid_state`, req.url));
  }
  await redis.del(stateKey);

  try {
    const tokens = await exchangeCode(code);
    const email = await getUserEmail(tokens.access_token);

    // Google only returns a refresh_token on the *first* consent for this
    // account; if this agent already had one connected, keep the existing
    // refresh_token rather than losing the ability to refresh later.
    let refreshToken = tokens.refresh_token;
    if (!refreshToken) {
      const existing = await getGmailAccount(agentId);
      refreshToken = existing?.refreshToken;
    }
    if (!refreshToken) {
      return NextResponse.redirect(new URL(`/agent/${agentId}/email?error=no_refresh_token`, req.url));
    }

    await saveGmailAccount({
      agentId,
      email,
      accessToken: tokens.access_token,
      refreshToken,
      tokenExpiresAt: Date.now() / 1000 + tokens.expires_in,
      connectedAt: Date.now(),
    });

    return NextResponse.redirect(new URL(`/agent/${agentId}/email?connected=1`, req.url));
  } catch {
    return NextResponse.redirect(new URL(`/agent/${agentId}/email?error=oauth_failed`, req.url));
  }
}
