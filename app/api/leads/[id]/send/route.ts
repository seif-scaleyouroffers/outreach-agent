import { NextRequest, NextResponse } from "next/server";
import { getLead, updateLead } from "../../../../../src/leadStore";
import { getGmailAccount, updateGmailAccountTokens } from "../../../../../src/gmailAccountStore";
import { getValidAccessToken, sendMessage } from "../../../../../src/tools/gmail";
import { logMessage } from "../../../../../src/tools/outreachMemory";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const agentId = body.agentId as string | undefined;
  if (!agentId) return NextResponse.json({ ok: false, error: "Missing agentId." }, { status: 400 });

  const lead = await getLead(agentId, id);
  if (!lead) return NextResponse.json({ ok: false, error: "Lead not found." }, { status: 404 });
  if (lead.status !== "approved" || lead.approvedDraftIndex === undefined || !lead.drafts) {
    return NextResponse.json({ ok: false, error: "This lead isn't approved with a chosen draft yet." }, { status: 400 });
  }
  if (!lead.email) {
    return NextResponse.json({ ok: false, error: "This lead has no email address on file." }, { status: 400 });
  }

  const account = await getGmailAccount(agentId);
  if (!account) {
    return NextResponse.json({ ok: false, error: "No Gmail account connected for this agent yet." }, { status: 400 });
  }

  const draft = lead.drafts[lead.approvedDraftIndex];

  try {
    const { accessToken, refreshed } = await getValidAccessToken(account);
    if (refreshed) await updateGmailAccountTokens(agentId, refreshed);

    const result = await sendMessage(
      accessToken,
      account.email,
      lead.email,
      draft.subject ?? `Quick note for ${lead.company}`,
      draft.text,
      account.signature
    );

    const loggedMessage = await logMessage(agentId, "email", lead.company, draft.text);
    const updated = await updateLead(agentId, id, {
      status: "sent",
      sentMessageId: result.id,
      threadId: result.threadId,
      outreachMessageId: loggedMessage.id,
    });

    return NextResponse.json({ ok: true, lead: updated });
  } catch (err) {
    await updateLead(agentId, id, { status: "failed", error: String(err) });
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
