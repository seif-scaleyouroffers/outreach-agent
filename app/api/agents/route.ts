import { NextRequest, NextResponse } from "next/server";
import { createStudentAgent, listStudentAgents } from "../../../src/agentStore";
import type { StudentAgentFields } from "../../../src/types";

export async function GET() {
  try {
    const agents = await listStudentAgents();
    return NextResponse.json({ ok: true, agents });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as Partial<StudentAgentFields>;
  if (!body.studentName) {
    return NextResponse.json({ ok: false, error: "Missing 'studentName'." }, { status: 400 });
  }
  try {
    const agent = await createStudentAgent({
      studentName: body.studentName,
      niche: body.niche ?? "",
      toneReference: body.toneReference ?? "",
      materials: body.materials ?? "",
    });
    return NextResponse.json({ ok: true, agent });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
