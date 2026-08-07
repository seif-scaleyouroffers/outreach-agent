"use client";

import Link from "next/link";
import { useParams, usePathname, useRouter } from "next/navigation";

const CHANNELS: { id: string; label: string; enabled: boolean }[] = [
  { id: "email", label: "Email", enabled: true },
  { id: "whatsapp", label: "WhatsApp", enabled: true },
  { id: "linkedin", label: "LinkedIn", enabled: true },
  { id: "meta", label: "Meta DM", enabled: true },
];

export default function AgentLayout({ children }: { children: React.ReactNode }) {
  const params = useParams();
  const pathname = usePathname();
  const router = useRouter();
  const id = params.id as string;

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      <nav style={{ width: 220, borderRight: "1px solid var(--border)", padding: "32px 16px", flexShrink: 0, display: "flex", flexDirection: "column" }}>
        <div className="eyebrow" style={{ marginBottom: 24, paddingLeft: 8 }}>Scale Your Offers</div>
        <div className="eyebrow" style={{ marginBottom: 12, paddingLeft: 8 }}>Channels</div>
        <div style={{ display: "grid", gap: 4 }}>
          {CHANNELS.map((c) => {
            const href = `/agent/${id}/${c.id}`;
            const active = pathname?.startsWith(href);
            return (
              <Link
                key={c.id}
                href={c.enabled ? href : "#"}
                onClick={(e) => {
                  if (!c.enabled) e.preventDefault();
                }}
                className={`nav-link ${active ? "nav-link-active" : ""} ${!c.enabled ? "nav-link-disabled" : ""}`}
              >
                {c.label}
                {!c.enabled && <span style={{ fontSize: 11, marginLeft: 6 }}>· soon</span>}
              </Link>
            );
          })}
        </div>

        <div style={{ borderTop: "1px solid var(--border)", marginTop: 20, paddingTop: 16 }}>
          <Link
            href={`/agent/${id}/edit`}
            className={`nav-link ${pathname === `/agent/${id}/edit` ? "nav-link-active" : ""}`}
          >
            Edit agent
          </Link>
        </div>

        <div style={{ marginTop: "auto", paddingTop: 16 }}>
          <button
            onClick={logout}
            className="btn-secondary"
            style={{ width: "100%", fontSize: 13, padding: "8px 12px" }}
          >
            Log out
          </button>
        </div>
      </nav>
      <div style={{ flex: 1, minWidth: 0 }}>{children}</div>
    </div>
  );
}
