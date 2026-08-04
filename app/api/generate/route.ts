import { NextRequest, NextResponse } from "next/server";
import { getStudentAgent } from "../../../src/agentStore";
import { runGapAnalysis } from "../../../src/tools/companyGapAnalysis";
import { getOutreachContext } from "../../../src/tools/outreachMemory";
import { generateDrafts } from "../../../src/outreachAgent";
import type { Channel, LeadInput } from "../../../src/types";

interface GenerateBody {
  agentId: string;
  channel: Channel;
  lead: LeadInput;
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as Partial<GenerateBody>;
  if (!body.agentId || !body.channel || !body.lead?.name || !body.lead?.company) {
    return NextResponse.json(
      { ok: false, error: "Missing required fields (agentId, channel, lead.name, lead.company)." },
      { status: 400 }
    );
  }

  try {
    const agent = await getStudentAgent(body.agentId);
    if (!agent) return NextResponse.json({ ok: false, error: "Agent not found." }, { status: 404 });

    const [gapAnalysis, pastMessages] = await Promise.all([
      runGapAnalysis(body.lead),
      getOutreachContext(agent.id, body.channel),
    ]);

    const drafts = await generateDrafts(agent, body.channel, gapAnalysis, pastMessages, body.lead);

    return NextResponse.json({ ok: true, gapAnalysis, drafts });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
