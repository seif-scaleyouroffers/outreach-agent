"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

export default function EditAgentPage() {
  const params = useParams();
  const router = useRouter();
  const agentId = params.id as string;

  const [studentName, setStudentName] = useState("");
  const [niche, setNiche] = useState("");
  const [toneReference, setToneReference] = useState("");
  const [materials, setMaterials] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch(`/api/agents/${agentId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.ok) {
          setStudentName(data.agent.studentName);
          setNiche(data.agent.niche ?? "");
          setToneReference(data.agent.toneReference ?? "");
          setMaterials(data.agent.materials ?? "");
        } else {
          setError(data.error);
        }
      })
      .finally(() => setLoading(false));
  }, [agentId]);

  async function save() {
    if (!studentName.trim()) return;
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch(`/api/agents/${agentId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentName, niche, toneReference, materials }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error);
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main style={{ maxWidth: 640, margin: "0 auto", padding: 48 }}>
        <p style={{ color: "var(--text-muted)" }}>Loading…</p>
      </main>
    );
  }

  return (
    <main style={{ maxWidth: 640, margin: "0 auto", padding: "40px 32px" }}>
      <div className="eyebrow">Edit agent</div>
      <h1 style={{ fontSize: 30, margin: "8px 0 24px" }}>Update your agent</h1>

      <div className="card">
        <div style={{ display: "grid", gap: 16 }}>
          <div>
            <label>Your name</label>
            <input value={studentName} onChange={(e) => setStudentName(e.target.value)} />
          </div>
          <div>
            <label>Niche / who you serve</label>
            <input value={niche} onChange={(e) => setNiche(e.target.value)} />
          </div>
          <div>
            <label>Tone reference (sample of your own writing)</label>
            <textarea rows={5} value={toneReference} onChange={(e) => setToneReference(e.target.value)} />
          </div>
          <div>
            <label>Materials (offer details, positioning, anything worth knowing)</label>
            <textarea rows={5} value={materials} onChange={(e) => setMaterials(e.target.value)} />
          </div>

          {error && <div style={{ color: "#a33", fontSize: 13 }}>{error}</div>}
          {saved && <div style={{ color: "#1a6e3c", fontSize: 13 }}>Saved.</div>}

          <div style={{ display: "flex", gap: 10 }}>
            <button className="btn-primary" disabled={saving || !studentName.trim()} onClick={save}>
              {saving ? "Saving…" : "Save changes"}
            </button>
            <button className="btn-secondary" onClick={() => router.push(`/agent/${agentId}/email`)}>
              Back to agent
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
