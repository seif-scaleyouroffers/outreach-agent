import { NextRequest, NextResponse } from "next/server";
import { getSessionUserId } from "../../../../src/sessionStore";
import { updateUser } from "../../../../src/userStore";
import { hashPassword } from "../../../../src/passwordUtils";

export async function POST(req: NextRequest) {
  const token = req.cookies.get("session")?.value;
  if (!token) return NextResponse.json({ ok: false, error: "Not logged in." }, { status: 401 });

  const userId = await getSessionUserId(token);
  if (!userId) return NextResponse.json({ ok: false, error: "Session expired." }, { status: 401 });

  const body = await req.json();
  const newPassword = body.newPassword as string | undefined;
  if (!newPassword || newPassword.length < 8) {
    return NextResponse.json({ ok: false, error: "Password must be at least 8 characters." }, { status: 400 });
  }

  try {
    const passwordHash = await hashPassword(newPassword);
    const updated = await updateUser(userId, { passwordHash, mustChangePassword: false });
    if (!updated) return NextResponse.json({ ok: false, error: "User not found." }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
