"use client";

import { useState } from "react";

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
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setInviting(false);
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

  return (
    <main style={{ maxWidth: 480, margin: "60px auto", padding: 24 }}>
      <h1 style={{ fontSize: 28 }}>Invite a student</h1>
      <div className="card">
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
    </main>
  );
}
