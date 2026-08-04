import { NextRequest, NextResponse } from "next/server";
import { getStudentAgent, updateStudentAgent } from "../../../../src/agentStore";
import type { StudentAgentFields } from "../../../../src/types";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const agent = await getStudentAgent(id);
    if (!agent) return NextResponse.json({ ok: false, error: "Not found." }, { status: 404 });
    return NextResponse.json({ ok: true, agent });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await req.json()) as Partial<StudentAgentFields>;
  if (!body.studentName) {
    return NextResponse.json({ ok: false, error: "Missing 'studentName'." }, { status: 400 });
  }
  try {
    const agent = await updateStudentAgent(id, {
      studentName: body.studentName,
      niche: body.niche ?? "",
      toneReference: body.toneReference ?? "",
      materials: body.materials ?? "",
    });
    if (!agent) return NextResponse.json({ ok: false, error: "Not found." }, { status: 404 });
    return NextResponse.json({ ok: true, agent });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
