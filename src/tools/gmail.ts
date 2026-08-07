// Gmail OAuth connect + send. Ported from the reference cold-email-sequencer
// tool's gmail.py — same OAuth flow, same token-refresh pattern, same raw
// MIME send — translated to TypeScript for this Next.js app. Deliberately
// leaves out that tool's warm-up ramping, bounce detection, and sequencer
// machinery, which solve a different problem (one team running high-volume
// campaigns from a few shared mailboxes) than this app has (many students,
// each sending occasional messages from their own inbox).

import type { GmailAccount } from "../types";

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const GMAIL_API = "https://gmail.googleapis.com/gmail/v1/users/me";

const SCOPES = [
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/userinfo.email",
  "openid",
];

function env(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

export function buildAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: env("GOOGLE_CLIENT_ID"),
    redirect_uri: env("GOOGLE_REDIRECT_URI"),
    response_type: "code",
    scope: SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent",
    state,
  });
  return `${AUTH_URL}?${params.toString()}`;
}

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
}

export async function exchangeCode(code: string): Promise<TokenResponse> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: env("GOOGLE_CLIENT_ID"),
      client_secret: env("GOOGLE_CLIENT_SECRET"),
      redirect_uri: env("GOOGLE_REDIRECT_URI"),
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) throw new Error(`Gmail token exchange failed: ${await res.text()}`);
  return res.json();
}

async function refreshAccessToken(refreshToken: string): Promise<TokenResponse> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: env("GOOGLE_CLIENT_ID"),
      client_secret: env("GOOGLE_CLIENT_SECRET"),
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) throw new Error(`Gmail token refresh failed: ${await res.text()}`);
  return res.json();
}

export async function getUserEmail(accessToken: string): Promise<string> {
  const res = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Gmail userinfo lookup failed: ${await res.text()}`);
  const data = await res.json();
  return data.email as string;
}

/** Returns a usable access token, refreshing first if the stored one is expired/near-expiry. */
export async function getValidAccessToken(
  account: GmailAccount
): Promise<{ accessToken: string; refreshed?: Partial<GmailAccount> }> {
  const nowSeconds = Date.now() / 1000;
  if (account.tokenExpiresAt > nowSeconds + 60) {
    return { accessToken: account.accessToken };
  }
  const tokens = await refreshAccessToken(account.refreshToken);
  return {
    accessToken: tokens.access_token,
    refreshed: { accessToken: tokens.access_token, tokenExpiresAt: nowSeconds + tokens.expires_in },
  };
}

function buildRawMessage(fromEmail: string, toEmail: string, subject: string, bodyText: string, signature?: string): string {
  const fullBody = signature ? `${bodyText}\n\n${signature}` : bodyText;
  const message = [
    `From: ${fromEmail}`,
    `To: ${toEmail}`,
    `Subject: ${subject}`,
    `Content-Type: text/plain; charset="UTF-8"`,
    "",
    fullBody,
  ].join("\r\n");
  return Buffer.from(message, "utf-8").toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function sendMessage(
  accessToken: string,
  fromEmail: string,
  toEmail: string,
  subject: string,
  bodyText: string,
  signature?: string
): Promise<{ id: string; threadId: string }> {
  const raw = buildRawMessage(fromEmail, toEmail, subject, bodyText, signature);
  const res = await fetch(`${GMAIL_API}/messages/send`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ raw }),
  });
  if (!res.ok) throw new Error(`Gmail send failed: ${await res.text()}`);
  return res.json();
}

// --- Reply + bounce polling — ported from the reference cold-email-sequencer's
// cron.py. Not webhooks: Gmail doesn't offer a simple per-message webhook for
// this use case, so this re-checks threads/searches the inbox on a schedule
// (see /api/cron/poll-replies and vercel.json).

export interface GmailThread {
  messages: { payload: { headers: { name: string; value: string }[] } }[];
}

export async function getThread(accessToken: string, threadId: string): Promise<GmailThread> {
  const res = await fetch(`${GMAIL_API}/threads/${threadId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Gmail thread lookup failed: ${await res.text()}`);
  return res.json();
}

/** True if anyone other than the sending account replied in this thread. */
export function threadHasReplyFrom(thread: GmailThread, contactEmail: string, accountEmail: string): boolean {
  const contact = contactEmail.toLowerCase();
  const account = accountEmail.toLowerCase();
  for (const message of thread.messages ?? []) {
    const fromHeader = (message.payload.headers.find((h) => h.name === "From")?.value ?? "").toLowerCase();
    if (fromHeader.includes(contact) && !fromHeader.includes(account)) return true;
  }
  return false;
}

/** The latest reply's plain-text body, for STOP-keyword detection. Best-effort. */
export function latestReplyText(thread: GmailThread, contactEmail: string, accountEmail: string): string {
  const contact = contactEmail.toLowerCase();
  const account = accountEmail.toLowerCase();
  const messages = thread.messages ?? [];
  for (let i = messages.length - 1; i >= 0; i--) {
    const headers = messages[i].payload.headers;
    const fromHeader = (headers.find((h) => h.name === "From")?.value ?? "").toLowerCase();
    if (fromHeader.includes(contact) && !fromHeader.includes(account)) {
      return extractMessageText(messages[i].payload);
    }
  }
  return "";
}

interface GmailPayload {
  mimeType?: string;
  body?: { data?: string };
  parts?: GmailPayload[];
  headers?: { name: string; value: string }[];
}

function decodeBase64Url(data: string): string {
  return Buffer.from(data.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf-8");
}

/** Best-effort plain-text extraction from a Gmail message payload (walks multipart). */
export function extractMessageText(payload: GmailPayload): string {
  if (payload.mimeType === "text/plain" && payload.body?.data) {
    return decodeBase64Url(payload.body.data);
  }
  for (const part of payload.parts ?? []) {
    const text = extractMessageText(part);
    if (text) return text;
  }
  if (payload.body?.data) return decodeBase64Url(payload.body.data);
  return "";
}

export interface GmailMessageStub {
  id: string;
}

export async function searchMessages(accessToken: string, query: string): Promise<GmailMessageStub[]> {
  const res = await fetch(`${GMAIL_API}/messages?q=${encodeURIComponent(query)}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Gmail search failed: ${await res.text()}`);
  const data = await res.json();
  return data.messages ?? [];
}

export async function getMessageFull(accessToken: string, messageId: string): Promise<{ payload: GmailPayload }> {
  const res = await fetch(`${GMAIL_API}/messages/${messageId}?format=full`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Gmail message lookup failed: ${await res.text()}`);
  return res.json();
}

// Bounce notifications land in the *sending* account's own inbox as a
// separate message, in wildly varying formats across receiving mail
// servers — rather than parsing every provider's DSN layout, this searches
// for bounce-shaped messages and the caller then confirms which lead it's
// about by checking whether exactly one currently-sent lead's email appears
// in the subject/body text.
export const BOUNCE_SEARCH_QUERY =
  '(from:mailer-daemon OR from:postmaster OR subject:"delivery status notification" ' +
  'OR subject:"undelivered mail" OR subject:"delivery has failed" ' +
  'OR subject:"returned to sender" OR subject:"delivery incomplete") newer_than:3d';
