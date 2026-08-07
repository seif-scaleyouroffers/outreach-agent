import { NextRequest, NextResponse } from "next/server";
import { getSessionUserId } from "../../../../src/sessionStore";
import { getUserById } from "../../../../src/userStore";

export async function GET(req: NextRequest) {
  const token = req.cookies.get("session")?.value;
  if (!token) return NextResponse.json({ ok: false, error: "Not logged in." }, { status: 401 });

  const userId = await getSessionUserId(token);
  if (!userId) return NextResponse.json({ ok: false, error: "Session expired." }, { status: 401 });

  const user = await getUserById(userId);
  if (!user) return NextResponse.json({ ok: false, error: "User not found." }, { status: 404 });

  return NextResponse.json({
    ok: true,
    email: user.email,
    agentId: user.agentId,
    mustChangePassword: user.mustChangePassword,
  });
}
