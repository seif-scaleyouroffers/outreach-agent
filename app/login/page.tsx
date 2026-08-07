"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function login() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error);
      if (data.mustChangePassword) {
        router.push(`/change-password?agentId=${data.agentId}`);
      } else {
        const next = searchParams.get("next") || `/agent/${data.agentId}/email`;
        router.push(next);
      }
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
          <label>Email</label>
          <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" />
        </div>
        <div>
          <label>Password</label>
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            onKeyDown={(e) => e.key === "Enter" && login()}
          />
        </div>
        {error && <div style={{ color: "#a33", fontSize: 13 }}>{error}</div>}
        <button className="btn-primary" disabled={loading || !email || !password} onClick={login}>
          {loading ? "Logging in…" : "Log in"}
        </button>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <main style={{ maxWidth: 420, margin: "100px auto", padding: 24 }}>
      <div className="eyebrow">Scale Your Offers</div>
      <h1 style={{ fontSize: 30, margin: "8px 0 24px" }}>Log in</h1>
      <Suspense fallback={<div className="card" />}>
        <LoginForm />
      </Suspense>
    </main>
  );
}
