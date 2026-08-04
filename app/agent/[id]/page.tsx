"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

type Channel = "email" | "linkedin" | "meta" | "whatsapp";
const CHANNELS: { id: Channel; label: string }[] = [
  { id: "email", label: "Email" },
  { id: "linkedin", label: "LinkedIn" },
  { id: "meta", label: "Meta DM" },
  { id: "whatsapp", label: "WhatsApp" },
];

interface DraftOption {
  label: string;
  text: string;
  subject?: string;
}
interface GapAnalysis {
  summary: string;
  likelyGaps: string[];
  sources: string[];
}
interface StudentAgent {
  id: string;
  studentName: string;
  niche: string;
}

export default function AgentPage() {
  const params = useParams();
  const id = params.id as string;

  const [agent, setAgent] = useState<StudentAgent | null>(null);
  const [channel, setChannel] = useState<Channel>("email");
  const [leadName, setLeadName] = useState("");
  const [leadEmail, setLeadEmail] = useState("");
  const [leadCompany, setLeadCompany] = useState("");
  const [leadWebsite, setLeadWebsite] = useState("");
  const [leadSocials, setLeadSocials] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [gapAnalysis, setGapAnalysis] = useState<GapAnalysis | null>(null);
  const [drafts, setDrafts] = useState<DraftOption[]>([]);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  useEffect(() => {
    fetch(`/api/agents/${id}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) setAgent(d.agent);
      });
  }, [id]);

  async function generate() {
    if (!leadName.trim() || !leadCompany.trim()) return;
    setLoading(true);
    setError(null);
    setDrafts([]);
    setGapAnalysis(null);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId: id,
          channel,
          lead: {
            name: leadName,
            email: leadEmail || undefined,
            company: leadCompany,
            companyWebsite: leadWebsite || undefined,
            socialLinks: leadSocials || undefined,
          },
        }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error);
      setGapAnalysis(data.gapAnalysis);
      setDrafts(data.drafts);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  async function copyAndLog(draft: DraftOption, index: number) {
    const fullText = draft.subject ? `Subject: ${draft.subject}\n\n${draft.text}` : draft.text;
    await navigator.clipboard.writeText(fullText);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);

    // Log it so future drafts can learn from what happens to this message.
    fetch("/api/outcomes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "log", agentId: id, channel, leadCompany, messageText: draft.text }),
    }).catch(() => {});
  }

  if (!agent) {
    return (
      <main style={{ maxWidth: 720, margin: "0 auto", padding: 48 }}>
        <p style={{ color: "var(--text-muted)" }}>Loading agent…</p>
      </main>
    );
  }

  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: "48px 24px" }}>
      <div className="eyebrow">{agent.niche || "Outreach agent"}</div>
      <h1 style={{ fontSize: 34, margin: "8px 0 32px" }}>{agent.studentName}&apos;s outreach agent</h1>

      <div className="card" style={{ marginBottom: 24 }}>
        <h2 style={{ marginTop: 0, fontSize: 18 }}>Lead</h2>
        <div style={{ display: "grid", gap: 14 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <div>
              <label>Name</label>
              <input value={leadName} onChange={(e) => setLeadName(e.target.value)} placeholder="Alex Rivera" />
            </div>
            <div>
              <label>Email (optional)</label>
              <input value={leadEmail} onChange={(e) => setLeadEmail(e.target.value)} placeholder="alex@company.com" />
            </div>
          </div>
          <div>
            <label>Company</label>
            <input value={leadCompany} onChange={(e) => setLeadCompany(e.target.value)} placeholder="Company name" />
          </div>
          <div>
            <label>Company website (optional)</label>
            <input value={leadWebsite} onChange={(e) => setLeadWebsite(e.target.value)} placeholder="https://…" />
          </div>
          <div>
            <label>Social links (optional, one per line)</label>
            <textarea rows={2} value={leadSocials} onChange={(e) => setLeadSocials(e.target.value)} />
          </div>
          <div>
            <label>Channel</label>
            <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
              {CHANNELS.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setChannel(c.id)}
                  className={channel === c.id ? "btn-primary" : "btn-secondary"}
                  style={{ padding: "8px 14px", fontSize: 13 }}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>
          {error && <div style={{ color: "#a33" }}>{error}</div>}
          <div>
            <button
              className="btn-primary"
              disabled={loading || !leadName.trim() || !leadCompany.trim()}
              onClick={generate}
            >
              {loading ? "Researching + drafting…" : "Generate drafts"}
            </button>
          </div>
        </div>
      </div>

      {gapAnalysis && (
        <div className="card" style={{ marginBottom: 24 }}>
          <h2 style={{ marginTop: 0, fontSize: 16 }}>What we found on {leadCompany}</h2>
          <p style={{ fontSize: 14, color: "var(--text-muted)" }}>{gapAnalysis.summary}</p>
          {gapAnalysis.likelyGaps.length > 0 && (
            <ul style={{ fontSize: 14, paddingLeft: 20 }}>
              {gapAnalysis.likelyGaps.map((g, i) => (
                <li key={i}>{g}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {drafts.length > 0 && (
        <div style={{ display: "grid", gap: 16 }}>
          {drafts.map((d, i) => (
            <div key={i} className="card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <span className="eyebrow">{d.label}</span>
                <button className="btn-secondary" style={{ padding: "6px 14px", fontSize: 13 }} onClick={() => copyAndLog(d, i)}>
                  {copiedIndex === i ? "Copied ✓" : "Copy"}
                </button>
              </div>
              {d.subject && <p style={{ fontWeight: 600, marginBottom: 4 }}>Subject: {d.subject}</p>}
              <p style={{ whiteSpace: "pre-wrap", fontSize: 15, lineHeight: 1.5 }}>{d.text}</p>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
