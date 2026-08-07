import { NextRequest, NextResponse } from "next/server";
import { getLead, updateLead } from "../../../../src/leadStore";
import { updateOutcome } from "../../../../src/tools/outreachMemory";
import { addSuppression } from "../../../../src/suppressionStore";
import type { Outcome } from "../../../../src/types";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const agentId = req.nextUrl.searchParams.get("agentId");
  if (!agentId) return NextResponse.json({ ok: false, error: "Missing agentId." }, { status: 400 });
  const lead = await getLead(agentId, id);
  if (!lead) return NextResponse.json({ ok: false, error: "Not found." }, { status: 404 });
  return NextResponse.json({ ok: true, lead });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const agentId = body.agentId as string | undefined;
  if (!agentId) return NextResponse.json({ ok: false, error: "Missing agentId." }, { status: 400 });

  try {
    if (body.action === "approve") {
      const draftIndex = body.draftIndex as number;
      const updated = await updateLead(agentId, id, { status: "approved", approvedDraftIndex: draftIndex });
      if (!updated) return NextResponse.json({ ok: false, error: "Not found." }, { status: 404 });
      return NextResponse.json({ ok: true, lead: updated });
    }

    if (body.action === "reject") {
      const updated = await updateLead(agentId, id, { status: "rejected" });
      if (!updated) return NextResponse.json({ ok: false, error: "Not found." }, { status: 404 });
      return NextResponse.json({ ok: true, lead: updated });
    }

    // Lets a student record what happened themselves, rather than waiting
    // for the scheduled poller (email-only) to catch it — also the only way
    // to record an outcome at all on copy-to-send channels.
    if (body.action === "mark-outcome") {
      const outcome = body.outcome as Outcome;
      const lead = await getLead(agentId, id);
      if (!lead) return NextResponse.json({ ok: false, error: "Not found." }, { status: 404 });
      if (lead.outreachMessageId) await updateOutcome(agentId, lead.outreachMessageId, outcome);
      if (outcome === "bounced" || outcome === "unsubscribed") {
        if (lead.email) await addSuppression(agentId, lead.email, outcome);
        await updateLead(agentId, id, { status: outcome });
      }
      const updated = await getLead(agentId, id);
      return NextResponse.json({ ok: true, lead: updated });
    }

    return NextResponse.json({ ok: false, error: "Unknown action." }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
