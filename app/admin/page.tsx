"use client";

import { useEffect, useState } from "react";

interface AgentSummary {
  id: string;
  studentName: string;
  updatedAt: number;
}

interface UserSummary {
  id: string;
  email: string;
  agentId: string;
}

export default function AdminPage() {
  const [secret, setSecret] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [unlockError, setUnlockError] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [studentName, setStudentName] = useState("");
  const [niche, setNiche] = useState("");
  const [inviting, setInviting] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [agents, setAgents] = useState<AgentSummary[]>([]);
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [repairing, setRepairing] = useState(false);
  const [repairMessage, setRepairMessage] = useState<string | null>(null);

  async function repairIndex() {
    setRepairing(true);
    setRepairMessage(null);
    try {
      const res = await fetch("/api/admin/repair-users-index", { method: "POST" });
      const data = await res.json();
      if (data.ok) {
        setRepairMessage(`Found and re-indexed ${data.count} account(s).`);
        await loadData();
      } else {
        setRepairMessage(`Error: ${data.error}`);
      }
    } finally {
      setRepairing(false);
    }
  }

  const [resetEmail, setResetEmail] = useState("");
  const [resetting, setResetting] = useState(false);
  const [resetResult, setResetResult] = useState<string | null>(null);
  const [resetError, setResetError] = useState<string | null>(null);

  async function loadData() {
    const [agentsRes, usersRes] = await Promise.all([
      fetch("/api/admin/agents").then((r) => r.json()),
      fetch("/api/admin/users").then((r) => r.json()),
    ]);
    if (agentsRes.ok) setAgents(agentsRes.agents);
    if (usersRes.ok) setUsers(usersRes.users);
  }

  useEffect(() => {
    if (unlocked) loadData();
  }, [unlocked]);

  async function unlock() {
    setUnlockError(null);
    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ secret }),
    });
    const data = await res.json();
    if (data.ok) setUnlocked(true);
    else setUnlockError("Incorrect password.");
  }

  async function invite() {
    setInviting(true);
    setResult(null);
    setError(null);
    try {
      const res = await fetch("/api/admin/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, studentName, niche }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error);
      if (data.emailSent) {
        setResult(`Invited ${studentName} — they'll get an email at ${email} with their login.`);
      } else {
        setResult(
          `Invited ${studentName}, but the invite email didn't send (${data.emailError ?? "no email provider configured yet"}). ` +
            `Share this with them manually — Email: ${email} / Temporary password: ${data.tempPassword}`
        );
      }
      setEmail("");
      setStudentName("");
      setNiche("");
      await loadData();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setInviting(false);
    }
  }

  async function resetPassword() {
    if (!resetEmail.trim()) return;
    setResetting(true);
    setResetResult(null);
    setResetError(null);
    try {
      const res = await fetch("/api/admin/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: resetEmail }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error);
      if (data.emailSent) {
        setResetResult(`Password reset — they'll get an email at ${resetEmail} with the new temporary password.`);
      } else {
        setResetResult(
          `Password reset, but the email didn't send (${data.emailError ?? "no email provider configured"}). ` +
            `New temporary password: ${data.tempPassword}`
        );
      }
      setResetEmail("");
    } catch (e) {
      setResetError(e instanceof Error ? e.message : String(e));
    } finally {
      setResetting(false);
    }
  }

  async function removeAccess(userId: string) {
    if (!confirm("Revoke this student's login? Their agent, leads, and history stay intact — this only removes their ability to log in.")) {
      return;
    }
    setRemovingId(userId);
    try {
      await fetch(`/api/admin/users?userId=${userId}`, { method: "DELETE" });
      await loadData();
    } finally {
      setRemovingId(null);
    }
  }

  if (!unlocked) {
    return (
      <main style={{ maxWidth: 420, margin: "100px auto", padding: 24 }}>
        <h1 style={{ fontSize: 28 }}>Admin</h1>
        <div className="card">
          <label>Admin password</label>
          <input
            type="password"
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && unlock()}
          />
          {unlockError && <div style={{ color: "#a33", fontSize: 13, marginTop: 8 }}>{unlockError}</div>}
          <button className="btn-primary" style={{ marginTop: 12 }} onClick={unlock}>
            Unlock
          </button>
        </div>
      </main>
    );
  }

  const agentById = new Map(agents.map((a) => [a.id, a]));

  return (
    <main style={{ maxWidth: 680, margin: "60px auto", padding: 24 }}>
      <h1 style={{ fontSize: 28 }}>Invite a student</h1>
      <div className="card" style={{ marginBottom: 32 }}>
        <div style={{ display: "grid", gap: 14 }}>
          <div>
            <label>Student name</label>
            <input value={studentName} onChange={(e) => setStudentName(e.target.value)} />
          </div>
          <div>
            <label>Email</label>
            <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" />
          </div>
          <div>
            <label>Niche (optional)</label>
            <input value={niche} onChange={(e) => setNiche(e.target.value)} />
          </div>
          {error && <div style={{ color: "#a33", fontSize: 13 }}>{error}</div>}
          {result && <div style={{ color: "#1a6e3c", fontSize: 13 }}>{result}</div>}
          <button className="btn-primary" disabled={inviting || !email.trim() || !studentName.trim()} onClick={invite}>
            {inviting ? "Sending invite…" : "Send invite"}
          </button>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 32 }}>
        <h2 style={{ marginTop: 0, fontSize: 16 }}>Reset a student&apos;s password</h2>
        <p style={{ fontSize: 13, color: "var(--text-muted)" }}>
          If they lost their temp password before logging in, or just need a fresh one.
        </p>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            value={resetEmail}
            onChange={(e) => setResetEmail(e.target.value)}
            type="email"
            placeholder="student@example.com"
          />
          <button className="btn-secondary" disabled={resetting || !resetEmail.trim()} onClick={resetPassword}>
            {resetting ? "Resetting…" : "Reset"}
          </button>
        </div>
        {resetError && <div style={{ color: "#a33", fontSize: 13, marginTop: 8 }}>{resetError}</div>}
        {resetResult && <div style={{ color: "#1a6e3c", fontSize: 13, marginTop: 8 }}>{resetResult}</div>}
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <h2 style={{ fontSize: 20 }}>Students ({users.length})</h2>
        <button className="btn-secondary" style={{ fontSize: 12, padding: "6px 12px" }} disabled={repairing} onClick={repairIndex}>
          {repairing ? "Checking…" : "Not seeing everyone? Rebuild list"}
        </button>
      </div>
      {repairMessage && <p style={{ fontSize: 13, color: "var(--text-muted)" }}>{repairMessage}</p>}
      <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 16 }}>
        Opening an agent shows exactly what that student sees on their own account. &quot;Remove access&quot; only
        revokes their login — their agent, leads, and history stay intact.
      </p>
      {users.length === 0 && <p style={{ color: "var(--text-muted)" }}>No students yet.</p>}
      <div style={{ display: "grid", gap: 10 }}>
        {users.map((u) => {
          const agent = agentById.get(u.agentId);
          return (
            <div
              key={u.id}
              className="card"
              style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 18px" }}
            >
              <div>
                <div style={{ fontWeight: 600 }}>{agent?.studentName ?? "(agent not found)"}</div>
                <div style={{ color: "var(--text-muted)", fontSize: 13 }}>{u.email}</div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <a href={`/agent/${u.agentId}/email`}>
                  <button className="btn-secondary" style={{ fontSize: 13, padding: "8px 14px" }}>
                    Open
                  </button>
                </a>
                <button
                  className="btn-secondary"
                  style={{ fontSize: 13, padding: "8px 14px", color: "#a33" }}
                  disabled={removingId === u.id}
                  onClick={() => removeAccess(u.id)}
                >
                  {removingId === u.id ? "Removing…" : "Remove access"}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </main>
  );
}
