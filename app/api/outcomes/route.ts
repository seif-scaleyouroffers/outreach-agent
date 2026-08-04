import { NextRequest, NextResponse } from "next/server";
import { logMessage, updateOutcome, getPerformanceSummary } from "../../../src/tools/outreachMemory";
import type { Channel, Outcome } from "../../../src/types";

// POST { action: "log", agentId, channel, leadCompany, messageText } -> logs a sent message
// POST { action: "update", agentId, messageId, outcome } -> records what happened
// GET  ?agentId=... -> performance summary

export async function GET(req: NextRequest) {
  const agentId = req.nextUrl.searchParams.get("agentId");
  if (!agentId) return NextResponse.json({ ok: false, error: "Missing agentId." }, { status: 400 });
  try {
    const summary = await getPerformanceSummary(agentId);
    return NextResponse.json({ ok: true, summary });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  try {
    if (body.action === "log") {
      const { agentId, channel, leadCompany, messageText } = body as {
        agentId: string;
        channel: Channel;
        leadCompany: string;
        messageText: string;
      };
      if (!agentId || !channel || !messageText) {
        return NextResponse.json({ ok: false, error: "Missing fields." }, { status: 400 });
      }
      const message = await logMessage(agentId, channel, leadCompany ?? "", messageText);
      return NextResponse.json({ ok: true, message });
    }

    if (body.action === "update") {
      const { agentId, messageId, outcome } = body as { agentId: string; messageId: string; outcome: Outcome };
      if (!agentId || !messageId || !outcome) {
        return NextResponse.json({ ok: false, error: "Missing fields." }, { status: 400 });
      }
      const message = await updateOutcome(agentId, messageId, outcome);
      if (!message) return NextResponse.json({ ok: false, error: "Message not found." }, { status: 404 });
      return NextResponse.json({ ok: true, message });
    }

    return NextResponse.json({ ok: false, error: "Unknown action." }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
