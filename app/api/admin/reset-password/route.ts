import { NextRequest, NextResponse } from "next/server";
import { isAdminSessionValid } from "../../../../src/sessionStore";
import { getUserByEmail, updateUser } from "../../../../src/userStore";
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
  if (!email) return NextResponse.json({ ok: false, error: "Missing email." }, { status: 400 });

  try {
    const user = await getUserByEmail(email);
    if (!user) return NextResponse.json({ ok: false, error: "No account with that email." }, { status: 404 });

    const tempPassword = generateTempPassword();
    const passwordHash = await hashPassword(tempPassword);
    await updateUser(user.id, { passwordHash, mustChangePassword: true });

    const appUrl = process.env.APP_URL || `https://${req.headers.get("host")}`;
    const message =
      `Your password has been reset.\n\nLog in here:\n${appUrl}/login\n\n` +
      `Email: ${email}\nTemporary password: ${tempPassword}\n\n` +
      `You'll be asked to set your own password the first time you log in.\n`;

    let emailSent = false;
    let emailError: string | undefined;
    try {
      await sendTransactionalEmail(email, "Your outreach agent password was reset", message);
      emailSent = true;
    } catch (err) {
      emailError = String(err);
    }

    return NextResponse.json({
      ok: true,
      emailSent,
      emailError,
      tempPassword: emailSent ? undefined : tempPassword,
    });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
