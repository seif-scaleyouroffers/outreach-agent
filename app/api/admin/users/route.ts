import { NextRequest, NextResponse } from "next/server";
import { isAdminSessionValid } from "../../../../src/sessionStore";
import { listUsers, deleteUser } from "../../../../src/userStore";

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
    const users = await listUsers();
    return NextResponse.json({ ok: true, users });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}

// Revokes login access only — does NOT delete the underlying agent, its
// leads, or its outreach history. A removed student's agent stays intact
// in case they're re-invited later, or you just want their data preserved.
export async function DELETE(req: NextRequest) {
  if (!(await requireAdmin(req))) {
    return NextResponse.json({ ok: false, error: "Not authorized." }, { status: 401 });
  }
  const userId = req.nextUrl.searchParams.get("userId");
  if (!userId) return NextResponse.json({ ok: false, error: "Missing userId." }, { status: 400 });
  try {
    const removed = await deleteUser(userId);
    return NextResponse.json({ ok: true, removed });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
