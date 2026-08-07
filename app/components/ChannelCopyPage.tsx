"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Papa from "papaparse";

type Channel = "whatsapp" | "linkedin" | "meta";
type LeadStatus = "pending" | "researching" | "drafted" | "approved" | "sent" | "rejected" | "failed";

interface DraftOption {
  label: string;
  text: string;
}
interface LeadRecord {
  id: string;
  name: string;
  email?: string;
  company: string;
  companyWebsite?: string;
  socialLinks?: string;
  status: LeadStatus;
  drafts?: DraftOption[];
  approvedDraftIndex?: number;
  error?: string;
}
interface Summary {
  overall: { total: number; replyRate: number; bookedRate: number };
  byChannel: Record<string, { total: number; replyRate: number; bookedRate: number }>;
}

const STATUS_LABEL: Record<LeadStatus, string> = {
  pending: "Not yet drafted",
  researching: "Researching…",
  drafted: "Ready to review",
  approved: "Approved — ready to copy",
  sent: "Sent",
  rejected: "Rejected",
  failed: "Failed",
};

const STATUS_COLOR: Record<LeadStatus, string> = {
  pending: "#8a8a86",
  researching: "#8a8a86",
  drafted: "#a67c00",
  approved: "#1a6e3c",
  sent: "#1a6e3c",
  rejected: "#a33",
  failed: "#a33",
};

export default function ChannelCopyPage({ channel, label }: { channel: Channel; label: string }) {
  const params = useParams();
  const agentId = params.id as string;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [summary, setSummary] = useState<Summary | null>(null);
  const [leads, setLeads] = useState<LeadRecord[]>([]);
  const [uploading, setUploading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [singleLead, setSingleLead] = useState({ name: "", email: "", company: "", companyWebsite: "", socialLinks: "" });
  const [addingLead, setAddingLead] = useState(false);

  async function refresh() {
    const [summaryRes, leadsRes] = await Promise.all([
      fetch(`/api/outcomes?agentId=${agentId}`).then((r) => r.json()),
      fetch(`/api/leads?agentId=${agentId}&channel=${channel}`).then((r) => r.json()),
    ]);
    if (summaryRes.ok) setSummary(summaryRes.summary);
    if (leadsRes.ok) setLeads(leadsRes.leads);
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentId]);

  async function addSingleLead() {
    if (!singleLead.name.trim() || !singleLead.company.trim()) return;
    setAddingLead(true);
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId,
          channel,
          leads: [
            {
              name: singleLead.name,
              email: singleLead.email || undefined,
              company: singleLead.company,
              companyWebsite: singleLead.companyWebsite || undefined,
              socialLinks: singleLead.socialLinks || undefined,
            },
          ],
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setSingleLead({ name: "", email: "", company: "", companyWebsite: "", socialLinks: "" });
        setNotice("Lead added.");
        await refresh();
      }
    } finally {
      setAddingLead(false);
    }
  }

  function handleCsvUpload(file: File) {
    setUploading(true);
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const rows = results.data.map((row) => ({
          name: row.name?.trim() ?? "",
          email: row.email?.trim() || undefined,
          company: row.company?.trim() ?? "",
          companyWebsite: row.companyWebsite?.trim() || row.website?.trim() || undefined,
          socialLinks: row.socialLinks?.trim() || row.socials?.trim() || undefined,
        }));
        try {
          const res = await fetch("/api/leads", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ agentId, channel, leads: rows }),
          });
          const data = await res.json();
          if (data.ok) {
            setNotice(`Uploaded ${data.leads.length} lead(s)${data.skipped ? `, skipped ${data.skipped} incomplete row(s)` : ""}.`);
            await refresh();
          }
        } finally {
          setUploading(false);
          if (fileInputRef.current) fileInputRef.current.value = "";
        }
      },
    });
  }

  async function generateDrafts() {
    setGenerating(true);
    try {
      const res = await fetch("/api/leads/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId, channel }),
      });
      const data = await res.json();
      if (data.ok) await refresh();
    } finally {
      setGenerating(false);
    }
  }

  async function approve(leadId: string, draftIndex: number) {
    await fetch(`/api/leads/${leadId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agentId, action: "approve", draftIndex }),
    });
    await refresh();
  }

  async function reject(leadId: string) {
    await fetch(`/api/leads/${leadId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agentId, action: "reject" }),
    });
    await refresh();
  }

  async function copyAndMarkSent(leadId: string, text: string) {
    await navigator.clipboard.writeText(text);
    setCopiedKey(leadId);
    setTimeout(() => setCopiedKey(null), 2000);
    await fetch(`/api/leads/${leadId}/mark-sent`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agentId }),
    });
    await refresh();
  }

  const pendingCount = leads.filter((l) => l.status === "pending").length;
  const overall = summary?.byChannel?.[channel];

  return (
    <main style={{ maxWidth: 980, margin: "0 auto", padding: "40px 32px" }}>
      <div className="eyebrow">{label}</div>
      <h1 style={{ fontSize: 32, margin: "8px 0 8px" }}>{label} outreach</h1>
      <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 20 }}>
        No auto-send here yet — approve a draft, then copy it and send it yourself.
      </p>

      {notice && (
        <div className="card" style={{ marginBottom: 20, fontSize: 14 }}>
          {notice}
          <button className="btn-secondary" style={{ marginLeft: 12, padding: "4px 10px", fontSize: 12 }} onClick={() => setNotice(null)}>
            Dismiss
          </button>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 24 }}>
        <div className="card">
          <div className="eyebrow">Sent</div>
          <div style={{ fontSize: 28, fontWeight: 700, marginTop: 6 }}>{overall?.total ?? 0}</div>
        </div>
        <div className="card">
          <div className="eyebrow">Reply rate</div>
          <div style={{ fontSize: 28, fontWeight: 700, marginTop: 6 }}>
            {overall ? Math.round(overall.replyRate * 100) : 0}%
          </div>
        </div>
        <div className="card">
          <div className="eyebrow">Booked rate</div>
          <div style={{ fontSize: 28, fontWeight: 700, marginTop: 6 }}>
            {overall ? Math.round(overall.bookedRate * 100) : 0}%
          </div>
        </div>
      </div>
      {!overall && (
        <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: -18, marginBottom: 22 }}>
          Rates show up once you've sent a few on this channel.
        </p>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
        <div className="card">
          <h2 style={{ marginTop: 0, fontSize: 16 }}>Add a lead</h2>
          <div style={{ display: "grid", gap: 12 }}>
            <div>
              <label>Name</label>
              <input value={singleLead.name} onChange={(e) => setSingleLead({ ...singleLead, name: e.target.value })} placeholder="Alex Rivera" />
            </div>
            <div>
              <label>Email (optional)</label>
              <input value={singleLead.email} onChange={(e) => setSingleLead({ ...singleLead, email: e.target.value })} placeholder="alex@company.com" />
            </div>
            <div>
              <label>Company</label>
              <input value={singleLead.company} onChange={(e) => setSingleLead({ ...singleLead, company: e.target.value })} placeholder="Company name" />
            </div>
            <div>
              <label>Company website (optional)</label>
              <input value={singleLead.companyWebsite} onChange={(e) => setSingleLead({ ...singleLead, companyWebsite: e.target.value })} placeholder="https://…" />
            </div>
            <div>
              <label>Social links (optional, one per line)</label>
              <textarea rows={2} value={singleLead.socialLinks} onChange={(e) => setSingleLead({ ...singleLead, socialLinks: e.target.value })} />
            </div>
            <div>
              <button className="btn-primary" disabled={addingLead || !singleLead.name.trim() || !singleLead.company.trim()} onClick={addSingleLead}>
                {addingLead ? "Adding…" : "Add lead"}
              </button>
            </div>
          </div>
        </div>

        <div className="card">
          <h2 style={{ marginTop: 0, fontSize: 16 }}>Or upload a list</h2>
          <p style={{ fontSize: 13, color: "var(--text-muted)" }}>
            CSV with columns: <code>name, email, company, companyWebsite, socialLinks</code> (website/socials optional).
          </p>
          <input ref={fileInputRef} type="file" accept=".csv" disabled={uploading} onChange={(e) => e.target.files?.[0] && handleCsvUpload(e.target.files[0])} />
        </div>
      </div>

      {pendingCount > 0 && (
        <div className="card" style={{ marginBottom: 24 }}>
          <button className="btn-primary" disabled={generating} onClick={generateDrafts}>
            {generating ? "Researching + drafting…" : `Generate drafts for ${pendingCount} lead(s)`}
          </button>
        </div>
      )}

      {leads.length > 0 && (
        <div className="card">
          <h2 style={{ marginTop: 0, fontSize: 16 }}>Leads ({leads.length})</h2>
          <div style={{ display: "grid", gap: 8 }}>
            {leads.map((lead) => (
              <div key={lead.id} className="lead-row" style={{ borderBottom: "1px solid var(--border)", paddingBottom: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <strong>{lead.name}</strong>
                    <span style={{ color: "var(--text-muted)", marginLeft: 8, fontSize: 13 }}>{lead.company}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: STATUS_COLOR[lead.status] }}>{STATUS_LABEL[lead.status]}</span>
                    {(lead.status === "drafted" || lead.status === "approved") && (
                      <button
                        className="btn-secondary"
                        style={{ fontSize: 12, padding: "6px 12px" }}
                        onClick={() => setExpandedId(expandedId === lead.id ? null : lead.id)}
                      >
                        {expandedId === lead.id ? "Close" : "Review"}
                      </button>
                    )}
                  </div>
                </div>

                {lead.status === "failed" && lead.error && <p style={{ fontSize: 12, color: "#a33", marginTop: 4 }}>{lead.error}</p>}

                {expandedId === lead.id && lead.drafts && (
                  <div style={{ display: "grid", gap: 12, marginTop: 12 }}>
                    {lead.drafts.map((d, i) => {
                      const isApproved = lead.status === "approved" && lead.approvedDraftIndex === i;
                      return (
                        <div key={i} style={{ background: "var(--bg)", borderRadius: 8, padding: 14 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                            <span className="eyebrow">{d.label}</span>
                            {isApproved ? (
                              <button
                                className="btn-primary"
                                style={{ fontSize: 12, padding: "5px 12px" }}
                                onClick={() => copyAndMarkSent(lead.id, d.text)}
                              >
                                {copiedKey === lead.id ? "Copied ✓" : "Copy"}
                              </button>
                            ) : (
                              lead.status === "drafted" && (
                                <button className="btn-primary" style={{ fontSize: 12, padding: "5px 12px" }} onClick={() => approve(lead.id, i)}>
                                  Approve this one
                                </button>
                              )
                            )}
                          </div>
                          <p style={{ whiteSpace: "pre-wrap", fontSize: 14 }}>{d.text}</p>
                        </div>
                      );
                    })}
                    {lead.status === "drafted" && (
                      <div>
                        <button className="btn-secondary" style={{ fontSize: 12, padding: "6px 12px" }} onClick={() => reject(lead.id)}>
                          Reject both
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}
