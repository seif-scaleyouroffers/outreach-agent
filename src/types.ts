// Shared types for the Scale Your Offers outreach agent.
//
// This app is intentionally standalone: its own repo, its own deploy, its
// own Redis database. It doesn't import from or share a URL with any other
// internal tool.

export type Channel = "email" | "linkedin" | "meta" | "whatsapp";

export const CHANNELS: { id: Channel; label: string }[] = [
  { id: "email", label: "Email" },
  { id: "linkedin", label: "LinkedIn" },
  { id: "meta", label: "Meta (Instagram/FB DM)" },
  { id: "whatsapp", label: "WhatsApp" },
];

// A student's outreach agent: the persisted config that makes drafts sound
// like *them* specifically. One of these = one shareable agent link.
export interface StudentAgent {
  id: string;
  studentName: string;
  /** What the student sells / who they serve — grounds the gap analysis and drafting. */
  niche: string;
  /** Sample of the student's own writing — mimicked for voice, never treated as fact. */
  toneReference: string;
  /** Free-text extra context/materials the student gave (offer details, positioning, etc). */
  materials: string;
  createdAt: number;
  updatedAt: number;
}

export type StudentAgentFields = Omit<StudentAgent, "id" | "createdAt" | "updatedAt">;

// One outreach message, logged after it's sent, so future drafts can learn
// from what actually worked for this specific student.
export type Outcome = "pending" | "replied" | "booked" | "no_reply" | "not_interested";

export interface OutreachMessage {
  id: string;
  agentId: string;
  channel: Channel;
  leadCompany: string;
  messageText: string;
  outcome: Outcome;
  createdAt: number;
  updatedAt: number;
}

// Input describing a specific lead, used for the gap-analysis + drafting step.
export interface LeadInput {
  name: string;
  email?: string;
  company: string;
  companyWebsite?: string;
  socialLinks?: string; // newline-separated URLs
}

// Result of researching the lead's company — public info only.
export interface GapAnalysis {
  summary: string;
  likelyGaps: string[];
  sources: string[];
}

export interface DraftOption {
  label: string; // e.g. "Direct" / "Curiosity-led"
  text: string;
  subject?: string; // email only
}

export interface GenerateResult {
  gapAnalysis: GapAnalysis;
  drafts: DraftOption[];
}
