"use client";

import { useEffect, useState } from "react";

interface AgentSummary {
  id: string;
  studentName: string;
  updatedAt: number;
}

export default function HomePage() {
  const [agents, setAgents] = useState<AgentSummary[]>([]);
  const [studentName, setStudentName] = useState("");
  const [niche, setNiche] = useState("");
  const [toneReference, setToneReference] = useState("");
  const [materials, setMaterials] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadAgents() {
    try {
      const res = await fetch("/api/agents");
      const data = await res.json();
      if (data.ok) setAgents(data.agents);
    } catch {
      // storage may not be configured yet — fine, list just stays empty
    }
  }

  useEffect(() => {
    loadAgents();
  }, []);

  async function createAgent() {
    if (!studentName.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentName, niche, toneReference, materials }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error);
      setStudentName("");
      setNiche("");
      setToneReference("");
      setMaterials("");
      await loadAgents();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setCreating(false);
    }
  }

  return (
    <main style={{ maxWidth: 880, margin: "0 auto", padding: "48px 24px" }}>
      <div className="eyebrow">Scale Your Offers</div>
      <h1 style={{ fontSize: 40, margin: "8px 0 6px" }}>Outreach Agent</h1>
      <p style={{ color: "var(--text-muted)", maxWidth: 560, marginBottom: 40 }}>
        Create a student&apos;s outreach agent below, then share their link. Each agent drafts
        outreach in that student&apos;s own voice, informed by what&apos;s actually worked for them
        before.
      </p>

      <div className="card" style={{ marginBottom: 40 }}>
        <h2 style={{ marginTop: 0, fontSize: 20 }}>New student agent</h2>
        <div style={{ display: "grid", gap: 16 }}>
          <div>
            <label>Student name</label>
            <input value={studentName} onChange={(e) => setStudentName(e.target.value)} placeholder="Jordan Lee" />
          </div>
          <div>
            <label>Niche / who they serve</label>
            <input
              value={niche}
              onChange={(e) => setNiche(e.target.value)}
              placeholder="e.g. business coaching for creative agency owners"
            />
          </div>
          <div>
            <label>Tone reference (sample of their own writing)</label>
            <textarea
              rows={4}
              value={toneReference}
              onChange={(e) => setToneReference(e.target.value)}
              placeholder="Paste an email, DM, or post they've written before"
            />
          </div>
          <div>
            <label>Materials (offer details, positioning, anything worth knowing)</label>
            <textarea rows={4} value={materials} onChange={(e) => setMaterials(e.target.value)} />
          </div>
          {error && <div style={{ color: "#a33" }}>{error}</div>}
          <div>
            <button className="btn-primary" disabled={creating || !studentName.trim()} onClick={createAgent}>
              {creating ? "Creating…" : "Create agent"}
            </button>
          </div>
        </div>
      </div>

      <h2 style={{ fontSize: 20 }}>Saved agents</h2>
      {agents.length === 0 && <p style={{ color: "var(--text-muted)" }}>No agents yet.</p>}
      <div style={{ display: "grid", gap: 12 }}>
        {agents.map((a) => (
          <a
            key={a.id}
            href={`/agent/${a.id}`}
            className="card"
            style={{ display: "flex", justifyContent: "space-between", textDecoration: "none" }}
          >
            <span style={{ fontWeight: 600 }}>{a.studentName}</span>
            <span style={{ color: "var(--text-muted)", fontSize: 13 }}>
              updated {new Date(a.updatedAt).toLocaleDateString()}
            </span>
          </a>
        ))}
      </div>
    </main>
  );
}
