import { NextRequest, NextResponse } from "next/server";
import { getUserByEmail } from "../../../../src/userStore";
import { verifyPassword } from "../../../../src/passwordUtils";
import { createSession } from "../../../../src/sessionStore";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const email = (body.email as string | undefined)?.trim().toLowerCase();
  const password = body.password as string | undefined;
  if (!email || !password) {
    return NextResponse.json({ ok: false, error: "Missing email or password." }, { status: 400 });
  }

  try {
    const user = await getUserByEmail(email);
    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      return NextResponse.json({ ok: false, error: "Incorrect email or password." }, { status: 401 });
    }

    const token = await createSession(user.id);
    const res = NextResponse.json({ ok: true, agentId: user.agentId, mustChangePassword: user.mustChangePassword });
    res.cookies.set("session", token, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
    return res;
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
