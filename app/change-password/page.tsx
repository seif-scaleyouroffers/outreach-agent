"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function ChangePasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const agentId = searchParams.get("agentId");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function save() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPassword }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error);
      router.push(agentId ? `/agent/${agentId}/email` : "/login");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card">
      <div style={{ display: "grid", gap: 14 }}>
        <div>
          <label>New password (min. 8 characters)</label>
          <input value={newPassword} onChange={(e) => setNewPassword(e.target.value)} type="password" />
        </div>
        {error && <div style={{ color: "#a33", fontSize: 13 }}>{error}</div>}
        <button className="btn-primary" disabled={loading || newPassword.length < 8} onClick={save}>
          {loading ? "Saving…" : "Save and continue"}
        </button>
      </div>
    </div>
  );
}

export default function ChangePasswordPage() {
  return (
    <main style={{ maxWidth: 420, margin: "100px auto", padding: 24 }}>
      <div className="eyebrow">First login</div>
      <h1 style={{ fontSize: 30, margin: "8px 0 24px" }}>Set your password</h1>
      <Suspense fallback={<div className="card" />}>
        <ChangePasswordForm />
      </Suspense>
    </main>
  );
}
