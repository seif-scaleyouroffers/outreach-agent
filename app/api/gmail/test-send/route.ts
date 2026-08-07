import { NextRequest, NextResponse } from "next/server";
import { getGmailAccount, updateGmailAccountTokens } from "../../../../src/gmailAccountStore";
import { getValidAccessToken, sendMessage } from "../../../../src/tools/gmail";

// Deliberately bypasses drafting, lead records, and outreach-memory logging
// entirely — this exists purely to confirm the Gmail connection itself
// actually sends, independent of anything AI-related.
export async function POST(req: NextRequest) {
  const body = await req.json();
  const agentId = body.agentId as string | undefined;
  const to = body.to as string | undefined;
  const subject = (body.subject as string | undefined) || "Test email from your outreach agent";
  const text = (body.text as string | undefined) || "This is a test — if you're reading this, sending works.";

  if (!agentId || !to) {
    return NextResponse.json({ ok: false, error: "Missing agentId or to." }, { status: 400 });
  }

  const account = await getGmailAccount(agentId);
  if (!account) {
    return NextResponse.json({ ok: false, error: "No Gmail account connected for this agent yet." }, { status: 400 });
  }

  try {
    const { accessToken, refreshed } = await getValidAccessToken(account);
    if (refreshed) await updateGmailAccountTokens(agentId, refreshed);

    const result = await sendMessage(accessToken, account.email, to, subject, text, account.signature);
    return NextResponse.json({ ok: true, messageId: result.id, from: account.email });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
