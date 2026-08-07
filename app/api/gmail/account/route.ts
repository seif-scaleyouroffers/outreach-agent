import { NextRequest, NextResponse } from "next/server";
import { getGmailAccount, updateGmailSignature, disconnectGmailAccount } from "../../../../src/gmailAccountStore";

export async function GET(req: NextRequest) {
  const agentId = req.nextUrl.searchParams.get("agentId");
  if (!agentId) return NextResponse.json({ ok: false, error: "Missing agentId." }, { status: 400 });
  const account = await getGmailAccount(agentId);
  return NextResponse.json({
    ok: true,
    account: account ? { email: account.email, signature: account.signature ?? "", connectedAt: account.connectedAt } : null,
  });
}

export async function PATCH(req: NextRequest) {
  const body = await req.json();
  if (!body.agentId) return NextResponse.json({ ok: false, error: "Missing agentId." }, { status: 400 });
  const updated = await updateGmailSignature(body.agentId, body.signature ?? "");
  if (!updated) return NextResponse.json({ ok: false, error: "No connected account for this agent." }, { status: 404 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const agentId = req.nextUrl.searchParams.get("agentId");
  if (!agentId) return NextResponse.json({ ok: false, error: "Missing agentId." }, { status: 400 });
  await disconnectGmailAccount(agentId);
  return NextResponse.json({ ok: true });
}
