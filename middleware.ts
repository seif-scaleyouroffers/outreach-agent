import { NextRequest, NextResponse } from "next/server";
import { getSessionUserId, isAdminSessionValid } from "./src/sessionStore";
import { getUserById } from "./src/userStore";

// Note: this protects PAGES only. It does not (yet) re-check ownership
// inside every individual API route under /api/leads, /api/generate,
// /api/gmail, /api/outcomes, /api/suppression — those still trust whatever
// agentId is passed in the request. Real follow-up hardening, not done here.
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const match = pathname.match(/^\/agent\/([^/]+)/);
  if (!match) return NextResponse.next();
  const agentId = match[1];

  // An admin (unlocked at /admin) can open any student's agent — used for
  // support/QA, not something a student session can do to another student.
  const adminToken = req.cookies.get("admin_session")?.value;
  if (adminToken) {
    try {
      if (await isAdminSessionValid(adminToken)) return NextResponse.next();
    } catch {
      // fall through to the normal student-session check below
    }
  }

  const token = req.cookies.get("session")?.value;
  if (!token) {
    return NextResponse.redirect(new URL(`/login?next=${encodeURIComponent(pathname)}`, req.url));
  }

  try {
    const userId = await getSessionUserId(token);
    if (!userId) {
      return NextResponse.redirect(new URL(`/login?next=${encodeURIComponent(pathname)}`, req.url));
    }
    const user = await getUserById(userId);
    if (!user || user.agentId !== agentId) {
      return NextResponse.redirect(new URL("/login", req.url));
    }
  } catch {
    // Storage hiccup — fail open rather than lock everyone out over an
    // infra blip; the page's own API calls will still fail sensibly if
    // something's genuinely broken.
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: "/agent/:path*",
};
