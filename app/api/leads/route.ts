import { NextRequest, NextResponse } from "next/server";
import { createLead, listLeads } from "../../../src/leadStore";
import { isSuppressed } from "../../../src/suppressionStore";
import type { Channel, LeadUploadRow } from "../../../src/types";

export async function GET(req: NextRequest) {
  const agentId = req.nextUrl.searchParams.get("agentId");
  const channel = req.nextUrl.searchParams.get("channel") as Channel | null;
  if (!agentId) return NextResponse.json({ ok: false, error: "Missing agentId." }, { status: 400 });
  try {
    const leads = await listLeads(agentId);
    const filtered = channel ? leads.filter((l) => l.channel === channel) : leads;
    return NextResponse.json({ ok: true, leads: filtered });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const agentId = body.agentId as string | undefined;
  const channel = (body.channel as Channel | undefined) ?? "email"; // default keeps old callers working
  const rows = body.leads as LeadUploadRow[] | undefined;
  if (!agentId || !Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json({ ok: false, error: "Missing agentId or leads." }, { status: 400 });
  }
  try {
    const created = [];
    let suppressed = 0;
    for (const row of rows) {
      if (!row.name?.trim() || !row.company?.trim()) continue; // skip incomplete rows silently
      if (row.email && (await isSuppressed(agentId, row.email))) {
        suppressed++;
        continue; // on the do-not-contact list — don't add them
      }
      created.push(await createLead({ agentId, channel, ...row }));
    }
    return NextResponse.json({ ok: true, leads: created, skipped: rows.length - created.length - suppressed, suppressed });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
