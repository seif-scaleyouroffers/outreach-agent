"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Papa from "papaparse";

type LeadStatus = "pending" | "researching" | "drafted" | "approved" | "sent" | "rejected" | "bounced" | "unsubscribed" | "failed";

interface DraftOption {
  label: string;
  text: string;
  subject?: string;
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
interface GmailAccountInfo {
  email: string;
  signature: string;
}

const STATUS_LABEL: Record<LeadStatus, string> = {
  pending: "Not yet drafted",
  researching: "Researching…",
  drafted: "Ready to review",
  approved: "Approved — ready to send",
  sent: "Sent",
  rejected: "Rejected",
  bounced: "Bounced",
  unsubscribed: "Unsubscribed",
  failed: "Failed",
};

const STATUS_COLOR: Record<LeadStatus, string> = {
  pending: "#8a8a86",
  researching: "#8a8a86",
  drafted: "#a67c00",
  approved: "#1a6e3c",
  sent: "#1a6e3c",
  rejected: "#a33",
  bounced: "#a33",
  unsubscribed: "#a33",
  failed: "#a33",
};

export default function EmailChannelPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const agentId = params.id as string;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [gmail, setGmail] = useState<GmailAccountInfo | null>(null);
  const [gmailError, setGmailError] = useState<string | null>(null);
  const [signature, setSignature] = useState("");
  const [summary, setSummary] = useState<Summary | null>(null);
  const [leads, setLeads] = useState<LeadRecord[]>([]);
  const [suppressed, setSuppressed] = useState<{ email: string; reason: string }[]>([]);
  const [suppressEmailInput, setSuppressEmailInput] = useState("");
  const [testTo, setTestTo] = useState("");
  const [testSubject, setTestSubject] = useState("");
  const [testBody, setTestBody] = useState("This is a test — if you're reading this, sending works.");
  const [testSending, setTestSending] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function refresh() {
    const [gmailRes, summaryRes, leadsRes, suppressedRes] = await Promise.all([
      fetch(`/api/gmail/account?agentId=${agentId}`).then((r) => r.json()),
      fetch(`/api/outcomes?agentId=${agentId}`).then((r) => r.json()),
      fetch(`/api/leads?agentId=${agentId}&channel=email`).then((r) => r.json()),
      fetch(`/api/suppression?agentId=${agentId}`).then((r) => r.json()),
    ]);
    if (gmailRes.ok) {
      setGmail(gmailRes.account);
      setSignature(gmailRes.account?.signature ?? "");
    }
    if (summaryRes.ok) setSummary(summaryRes.summary);
    if (leadsRes.ok) setLeads(leadsRes.leads);
    if (suppressedRes.ok) setSuppressed(suppressedRes.suppressed);
  }

  useEffect(() => {
    refresh();
    const error = searchParams.get("error");
    if (error === "no_refresh_token") {
      setGmailError("Google didn't return a refresh token — try disconnecting and reconnecting.");
    } else if (error === "oauth_failed") {
      setGmailError("Connecting Gmail failed — try again.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentId]);

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
            body: JSON.stringify({ agentId, leads: rows }),
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
        body: JSON.stringify({ agentId }),
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

  async function send(leadId: string) {
    setSendingId(leadId);
    try {
      const res = await fetch(`/api/leads/${leadId}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId }),
      });
      const data = await res.json();
      if (!data.ok) setNotice(`Couldn't send: ${data.error}`);
      await refresh();
    } finally {
      setSendingId(null);
    }
  }

  async function markOutcome(leadId: string, outcome: string) {
    await fetch(`/api/leads/${leadId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agentId, action: "mark-outcome", outcome }),
    });
    await refresh();
  }

  async function sendTestEmail() {
    if (!testTo.trim()) return;
    setTestSending(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/gmail/test-send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId, to: testTo, subject: testSubject || undefined, text: testBody }),
      });
      const data = await res.json();
      if (data.ok) {
        setTestResult({ ok: true, message: `Sent from ${data.from} to ${testTo}.` });
      } else {
        setTestResult({ ok: false, message: data.error });
      }
    } catch (e) {
      setTestResult({ ok: false, message: e instanceof Error ? e.message : String(e) });
    } finally {
      setTestSending(false);
    }
  }

  async function addSuppressedEmail() {
    if (!suppressEmailInput.trim()) return;
    await fetch("/api/suppression", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agentId, email: suppressEmailInput, reason: "manual" }),
    });
    setSuppressEmailInput("");
    await refresh();
  }

  async function removeSuppressedEmail(email: string) {
    await fetch(`/api/suppression?agentId=${agentId}&email=${encodeURIComponent(email)}`, { method: "DELETE" });
    await refresh();
  }

  async function saveSignature() {
    await fetch("/api/gmail/account", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agentId, signature }),
    });
    setNotice("Signature saved.");
  }

  const [singleLead, setSingleLead] = useState({ name: "", email: "", company: "", companyWebsite: "", socialLinks: "" });
  const [addingLead, setAddingLead] = useState(false);

  async function addSingleLead() {
    if (!singleLead.name.trim() || !singleLead.company.trim()) return;
    setAddingLead(true);
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId,
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

  const pendingCount = leads.filter((l) => l.status === "pending").length;
  const overall = summary?.overall;

  return (
    <main style={{ maxWidth: 980, margin: "0 auto", padding: "40px 32px" }}>
      <div className="eyebrow">Email</div>
      <h1 style={{ fontSize: 32, margin: "8px 0 28px" }}>Email outreach</h1>

      {notice && (
        <div className="card" style={{ marginBottom: 20, fontSize: 14 }}>
          {notice}
          <button className="btn-secondary" style={{ marginLeft: 12, padding: "4px 10px", fontSize: 12 }} onClick={() => setNotice(null)}>
            Dismiss
          </button>
        </div>
      )}

      {/* Dashboard */}
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

      {/* Gmail connection */}
      <div className="card" style={{ marginBottom: 24 }}>
        <h2 style={{ marginTop: 0, fontSize: 16 }}>Sending account</h2>
        {gmailError && <p style={{ color: "#a33", fontSize: 13 }}>{gmailError}</p>}
        {gmail ? (
          <>
            <p style={{ fontSize: 14 }}>
              Connected as <strong>{gmail.email}</strong>
            </p>
            <label>Signature (appended to every email)</label>
            <textarea rows={3} value={signature} onChange={(e) => setSignature(e.target.value)} />
            <div style={{ marginTop: 10 }}>
              <button className="btn-secondary" style={{ fontSize: 13, padding: "8px 14px" }} onClick={saveSignature}>
                Save signature
              </button>
            </div>
          </>
        ) : (
          <>
            <p style={{ fontSize: 14, color: "var(--text-muted)" }}>
              Connect the Gmail account this agent should send from.
            </p>
            <a href={`/api/gmail/connect?agentId=${agentId}`}>
              <button className="btn-primary">Connect Gmail</button>
            </a>
          </>
        )}
      </div>

      {/* Test send — no AI involved, just confirms the Gmail connection itself works */}
      {gmail && (
        <div className="card" style={{ marginBottom: 24 }}>
          <h2 style={{ marginTop: 0, fontSize: 16 }}>Send a test email</h2>
          <p style={{ fontSize: 13, color: "var(--text-muted)" }}>
            Sends a plain email through the connected account — no drafting, no lead records, just checks the
            connection itself works.
          </p>
          <div style={{ display: "grid", gap: 10 }}>
            <div>
              <label>To</label>
              <input value={testTo} onChange={(e) => setTestTo(e.target.value)} placeholder="you@example.com" />
            </div>
            <div>
              <label>Subject (optional)</label>
              <input value={testSubject} onChange={(e) => setTestSubject(e.target.value)} placeholder="Test email from your outreach agent" />
            </div>
            <div>
              <label>Body</label>
              <textarea rows={3} value={testBody} onChange={(e) => setTestBody(e.target.value)} />
            </div>
            {testResult && (
              <div style={{ fontSize: 13, color: testResult.ok ? "#1a6e3c" : "#a33" }}>{testResult.message}</div>
            )}
            <div>
              <button className="btn-secondary" disabled={testSending || !testTo.trim()} onClick={sendTestEmail}>
                {testSending ? "Sending…" : "Send test"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Suppression list */}
      <div className="card" style={{ marginBottom: 24 }}>
        <h2 style={{ marginTop: 0, fontSize: 16 }}>Do-not-contact list</h2>
        <p style={{ fontSize: 13, color: "var(--text-muted)" }}>
          Bounced and unsubscribed addresses are added automatically. New leads on this list are skipped on upload.
        </p>
        <div style={{ display: "flex", gap: 8, marginBottom: suppressed.length > 0 ? 14 : 0 }}>
          <input
            value={suppressEmailInput}
            onChange={(e) => setSuppressEmailInput(e.target.value)}
            placeholder="add an email manually"
            style={{ flex: 1 }}
          />
          <button className="btn-secondary" style={{ fontSize: 13, padding: "8px 14px" }} onClick={addSuppressedEmail}>
            Add
          </button>
        </div>
        {suppressed.length > 0 && (
          <div style={{ display: "grid", gap: 6 }}>
            {suppressed.map((s) => (
              <div key={s.email} style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                <span>
                  {s.email} <span style={{ color: "var(--text-muted)" }}>({s.reason})</span>
                </span>
                <button
                  className="btn-secondary"
                  style={{ fontSize: 11, padding: "2px 8px" }}
                  onClick={() => removeSuppressedEmail(s.email)}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add leads: one at a time, or in bulk */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
        <div className="card">
          <h2 style={{ marginTop: 0, fontSize: 16 }}>Add a lead</h2>
          <div style={{ display: "grid", gap: 12 }}>
            <div>
              <label>Name</label>
              <input
                value={singleLead.name}
                onChange={(e) => setSingleLead({ ...singleLead, name: e.target.value })}
                placeholder="Alex Rivera"
              />
            </div>
            <div>
              <label>Email (optional)</label>
              <input
                value={singleLead.email}
                onChange={(e) => setSingleLead({ ...singleLead, email: e.target.value })}
                placeholder="alex@company.com"
              />
            </div>
            <div>
              <label>Company</label>
              <input
                value={singleLead.company}
                onChange={(e) => setSingleLead({ ...singleLead, company: e.target.value })}
                placeholder="Company name"
              />
            </div>
            <div>
              <label>Company website (optional)</label>
              <input
                value={singleLead.companyWebsite}
                onChange={(e) => setSingleLead({ ...singleLead, companyWebsite: e.target.value })}
                placeholder="https://…"
              />
            </div>
            <div>
              <label>Social links (optional, one per line)</label>
              <textarea
                rows={2}
                value={singleLead.socialLinks}
                onChange={(e) => setSingleLead({ ...singleLead, socialLinks: e.target.value })}
              />
            </div>
            <div>
              <button
                className="btn-primary"
                disabled={addingLead || !singleLead.name.trim() || !singleLead.company.trim()}
                onClick={addSingleLead}
              >
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
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            disabled={uploading}
            onChange={(e) => e.target.files?.[0] && handleCsvUpload(e.target.files[0])}
          />
        </div>
      </div>

      {pendingCount > 0 && (
        <div className="card" style={{ marginBottom: 24 }}>
          <button className="btn-primary" disabled={generating} onClick={generateDrafts}>
            {generating ? "Researching + drafting…" : `Generate drafts for ${pendingCount} lead(s)`}
          </button>
        </div>
      )}

      {/* Leads table */}
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
                    <span style={{ fontSize: 12, fontWeight: 600, color: STATUS_COLOR[lead.status] }}>
                      {STATUS_LABEL[lead.status]}
                    </span>
                    {lead.status === "drafted" && (
                      <button
                        className="btn-secondary"
                        style={{ fontSize: 12, padding: "6px 12px" }}
                        onClick={() => setExpandedId(expandedId === lead.id ? null : lead.id)}
                      >
                        {expandedId === lead.id ? "Close" : "Review"}
                      </button>
                    )}
                    {lead.status === "approved" && (
                      <button
                        className="btn-primary"
                        style={{ fontSize: 12, padding: "6px 12px" }}
                        disabled={sendingId === lead.id || !gmail}
                        onClick={() => send(lead.id)}
                        title={!gmail ? "Connect Gmail first" : undefined}
                      >
                        {sendingId === lead.id ? "Sending…" : "Send"}
                      </button>
                    )}
                    {lead.status === "sent" && (
                      <select
                        defaultValue=""
                        style={{ fontSize: 12, padding: "5px 8px", width: "auto" }}
                        onChange={(e) => {
                          if (e.target.value) markOutcome(lead.id, e.target.value);
                          e.target.value = "";
                        }}
                      >
                        <option value="" disabled>
                          Mark outcome…
                        </option>
                        <option value="replied">Replied</option>
                        <option value="booked">Booked a call</option>
                        <option value="no_reply">No reply</option>
                        <option value="not_interested">Not interested</option>
                        <option value="bounced">Bounced</option>
                        <option value="unsubscribed">Unsubscribed</option>
                      </select>
                    )}
                  </div>
                </div>

                {lead.status === "failed" && lead.error && (
                  <p style={{ fontSize: 12, color: "#a33", marginTop: 4 }}>{lead.error}</p>
                )}

                {expandedId === lead.id && lead.drafts && (
                  <div style={{ display: "grid", gap: 12, marginTop: 12 }}>
                    {lead.drafts.map((d, i) => (
                      <div key={i} style={{ background: "var(--bg)", borderRadius: 8, padding: 14 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                          <span className="eyebrow">{d.label}</span>
                          <button className="btn-primary" style={{ fontSize: 12, padding: "5px 12px" }} onClick={() => approve(lead.id, i)}>
                            Approve this one
                          </button>
                        </div>
                        {d.subject && <p style={{ fontWeight: 600, margin: "6px 0 2px" }}>Subject: {d.subject}</p>}
                        <p style={{ whiteSpace: "pre-wrap", fontSize: 14 }}>{d.text}</p>
                      </div>
                    ))}
                    <div>
                      <button className="btn-secondary" style={{ fontSize: 12, padding: "6px 12px" }} onClick={() => reject(lead.id)}>
                        Reject both
                      </button>
                    </div>
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
