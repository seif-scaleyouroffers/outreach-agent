import { NextRequest, NextResponse } from "next/server";
import { createStudentAgent, listStudentAgents } from "../../../src/agentStore";
import { isAdminSessionValid } from "../../../src/sessionStore";
import type { StudentAgentFields } from "../../../src/types";

async function requireAdmin(req: NextRequest): Promise<boolean> {
  const token = req.cookies.get("admin_session")?.value;
  if (!token) return false;
  return isAdminSessionValid(token);
}

export async function GET(req: NextRequest) {
  if (!(await requireAdmin(req))) {
    return NextResponse.json({ ok: false, error: "Not authorized." }, { status: 401 });
  }
  try {
    const agents = await listStudentAgents();
    return NextResponse.json({ ok: true, agents });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!(await requireAdmin(req))) {
    return NextResponse.json({ ok: false, error: "Not authorized." }, { status: 401 });
  }
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
