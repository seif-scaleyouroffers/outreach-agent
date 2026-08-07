import { NextRequest, NextResponse } from "next/server";
import { addSuppression, removeSuppression, listSuppressed } from "../../../src/suppressionStore";

export async function GET(req: NextRequest) {
  const agentId = req.nextUrl.searchParams.get("agentId");
  if (!agentId) return NextResponse.json({ ok: false, error: "Missing agentId." }, { status: 400 });
  try {
    const suppressed = await listSuppressed(agentId);
    return NextResponse.json({ ok: true, suppressed });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const agentId = body.agentId as string | undefined;
  const email = body.email as string | undefined;
  if (!agentId || !email) return NextResponse.json({ ok: false, error: "Missing agentId or email." }, { status: 400 });
  try {
    await addSuppression(agentId, email, body.reason ?? "manual");
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const agentId = req.nextUrl.searchParams.get("agentId");
  const email = req.nextUrl.searchParams.get("email");
  if (!agentId || !email) return NextResponse.json({ ok: false, error: "Missing agentId or email." }, { status: 400 });
  try {
    const removed = await removeSuppression(agentId, email);
    return NextResponse.json({ ok: true, removed });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
