import { NextRequest, NextResponse } from "next/server";
import { getStudentAgent } from "../../../../src/agentStore";
import { listLeads, updateLead } from "../../../../src/leadStore";
import { runGapAnalysis } from "../../../../src/tools/companyGapAnalysis";
import { getOutreachContext } from "../../../../src/tools/outreachMemory";
import { generateDrafts } from "../../../../src/outreachAgent";
import type { Channel } from "../../../../src/types";

// Processes leads one at a time in a single request. Fine for realistic
// batch sizes (tens of leads); a very large list can hit the serverless
// function's time limit (10s on Vercel Hobby, longer on Pro) — if that
// becomes a real constraint, this is the point where it'd need to move to a
// background job/queue instead of one request per batch.
export async function POST(req: NextRequest) {
  const body = await req.json();
  const agentId = body.agentId as string | undefined;
  const channel = (body.channel as Channel | undefined) ?? "email";
  if (!agentId) return NextResponse.json({ ok: false, error: "Missing agentId." }, { status: 400 });

  try {
    const agent = await getStudentAgent(agentId);
    if (!agent) return NextResponse.json({ ok: false, error: "Agent not found." }, { status: 404 });

    const allLeads = await listLeads(agentId);
    const leadIds: string[] | undefined = body.leadIds;
    const targets = allLeads.filter((l) =>
      leadIds ? leadIds.includes(l.id) : l.channel === channel && l.status === "pending"
    );

    const results = [];
    for (const lead of targets) {
      const leadInput = {
        name: lead.name,
        email: lead.email,
        company: lead.company,
        companyWebsite: lead.companyWebsite,
        socialLinks: lead.socialLinks,
      };
      try {
        await updateLead(agentId, lead.id, { status: "researching" });
        const [gapAnalysis, pastMessages] = await Promise.all([
          runGapAnalysis(leadInput),
          getOutreachContext(agentId, channel),
        ]);
        const drafts = await generateDrafts(agent, channel, gapAnalysis, pastMessages, leadInput);
        results.push(await updateLead(agentId, lead.id, { status: "drafted", gapAnalysis, drafts }));
      } catch (err) {
        results.push(await updateLead(agentId, lead.id, { status: "failed", error: String(err) }));
      }
    }

    return NextResponse.json({ ok: true, leads: results });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
