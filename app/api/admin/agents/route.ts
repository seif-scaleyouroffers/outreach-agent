import { NextRequest, NextResponse } from "next/server";
import { isAdminSessionValid } from "../../../../src/sessionStore";
import { listStudentAgents } from "../../../../src/agentStore";

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
