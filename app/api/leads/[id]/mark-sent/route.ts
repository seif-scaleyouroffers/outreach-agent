import { NextRequest, NextResponse } from "next/server";
import { getLead, updateLead } from "../../../../../src/leadStore";
import { logMessage } from "../../../../../src/tools/outreachMemory";

// For channels without an auto-send integration (WhatsApp, LinkedIn, Meta):
// the student copies the approved draft and sends it themselves elsewhere.
// This just records that it happened, so it counts toward the dashboard and
// feeds future drafts — mirrors what /api/leads/[id]/send does for email,
// minus the actual Gmail API call.
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

  const draft = lead.drafts[lead.approvedDraftIndex];

  try {
    const loggedMessage = await logMessage(agentId, lead.channel, lead.company, draft.text);
    const updated = await updateLead(agentId, id, { status: "sent", outreachMessageId: loggedMessage.id });
    return NextResponse.json({ ok: true, lead: updated });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
