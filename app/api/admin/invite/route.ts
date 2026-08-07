import { NextRequest, NextResponse } from "next/server";
import { isAdminSessionValid } from "../../../../src/sessionStore";
import { createStudentAgent } from "../../../../src/agentStore";
import { createUser, getUserByEmail } from "../../../../src/userStore";
import { hashPassword, generateTempPassword } from "../../../../src/passwordUtils";
import { sendTransactionalEmail } from "../../../../src/tools/email";

async function requireAdmin(req: NextRequest): Promise<boolean> {
  const token = req.cookies.get("admin_session")?.value;
  if (!token) return false;
  return isAdminSessionValid(token);
}

export async function POST(req: NextRequest) {
  if (!(await requireAdmin(req))) {
    return NextResponse.json({ ok: false, error: "Not authorized." }, { status: 401 });
  }

  const body = await req.json();
  const email = (body.email as string | undefined)?.trim().toLowerCase();
  const studentName = body.studentName as string | undefined;
  const niche = (body.niche as string | undefined) ?? "";
  if (!email || !studentName) {
    return NextResponse.json({ ok: false, error: "Missing email or studentName." }, { status: 400 });
  }

  try {
    const existing = await getUserByEmail(email);
    if (existing) {
      return NextResponse.json({ ok: false, error: "That email already has an account." }, { status: 409 });
    }

    const agent = await createStudentAgent({ studentName, niche, toneReference: "", materials: "" });
    const tempPassword = generateTempPassword();
    const passwordHash = await hashPassword(tempPassword);
    await createUser({ email, passwordHash, agentId: agent.id, mustChangePassword: true });

    const appUrl = process.env.APP_URL || `https://${req.headers.get("host")}`;
    const loginMessage =
      `Hi ${studentName},\n\nYour outreach agent is set up. Log in here:\n${appUrl}/login\n\n` +
      `Email: ${email}\nTemporary password: ${tempPassword}\n\n` +
      `You'll be asked to set your own password the first time you log in.\n`;

    // Don't let an email-sending failure orphan the account with a
    // password nobody can see — if Resend isn't configured yet (or the
    // send fails for any reason), fall back to returning the temp password
    // directly in this response instead of losing it.
    let emailSent = false;
    let emailError: string | undefined;
    try {
      await sendTransactionalEmail(email, "Your Scale Your Offers outreach agent is ready", loginMessage);
      emailSent = true;
    } catch (err) {
      emailError = String(err);
    }

    return NextResponse.json({
      ok: true,
      agentId: agent.id,
      emailSent,
      emailError,
      // Only returned when the email didn't go out — this response is only
      // ever seen by whoever already unlocked /admin.
      tempPassword: emailSent ? undefined : tempPassword,
    });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
