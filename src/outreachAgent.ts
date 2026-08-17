// Channel-aware drafting. Produces exactly two message options, grounded in:
//   - the student's own tone (toneReference, mimicked never quoted as fact)
//   - the student's own outreach history (outreachMemory's best-performing
//     past messages for this channel)
//   - the lead's company gap analysis (companyGapAnalysis)
//   - channel-specific writing rules, distilled from internal research on
//     what actually performs on each channel (subject-line length, LinkedIn
//     connection-note structure, WhatsApp's template-vs-freeform-window
//     split, etc.)

import type { Channel, DraftOption, GapAnalysis, LeadInput, OutreachMessage, StudentAgent } from "./types";
import { getLlmProvider } from "./llmProvider";

const CHANNEL_RULES: Record<Channel, string> = {
  email: `EMAIL rules:
- Subject: 2-4 words, front-loaded so the point lands in the first ~33 characters, no spam-trigger words/ALL CAPS/fake "RE:".
- Body: 50-125 words total, three sentences max: hook (proves you looked at THEM specifically) -> one sharp, concrete value/proof point (a real number or outcome, not a vague authority claim) -> one single, low-friction, yes/no-style ask.
- Never stack multiple asks or links. No attachments. Don't lead with credentials or a title/pitch line.`,

  linkedin: `LINKEDIN rules:
- This is a first-touch DM to someone not yet connected (or just connected) — not an email. Three-part structure: relevance hook (~80 chars) -> specific observation proving you looked at their profile/content (~120 chars) -> soft, low-pressure bridge. No pitch, no ask-for-anything in a cold connection note.
- Anchor on a real, content-based trigger (a recent post, a launch, a plateau/burnout comment) — never a generic title/pitch line like "I help coaches scale."
- Don't message on weekends if avoidable. Write in your own words — never a template that reads identical to what'd go out at scale.`,

  meta: `META (Instagram/FB DM) rules:
- Keep it under ~60 words, reference their actual recent content specifically, end with a genuine question (not a pitch).
- Tone is casual and about THEM, not a service pitch. "I noticed you just X, curious how you're thinking about Y" beats "I help people like you achieve Z."
- Don't send anything that reads as a generic opener — those get filtered/ignored. Never message a brand/team account, only a real person.`,

  whatsapp: `WHATSAPP rules — structurally different from the others:
- A first message to someone who hasn't messaged you before MUST be a short, honest, template-style opener (not a freeform pitch) — because on WhatsApp, freeform cold outreach isn't allowed until they reply. Keep it short, state plainly why you're reaching out, and end with a question that invites a reply (that's what unlocks real conversation). Include a low-key opt-out.
- Never write it like a mass blast or marketing email — WhatsApp is a personal space; anything that reads like an ad gets reported fast.
- Do not assume a 24-hour freeform window is already open for a first message to a new lead — draft the template-style opener, not a full pitch.`,
};

function buildSystemPrompt(
  agent: StudentAgent,
  channel: Channel,
  gapAnalysis: GapAnalysis,
  pastMessages: OutreachMessage[]
): string {
  const toneSection = agent.toneReference
    ? `Tone reference — sample of ${agent.studentName}'s own writing. Mimic this voice (word choice, rhythm, formality) but never quote or treat it as factual content:\n"""\n${agent.toneReference}\n"""`
    : "";

  const materialsSection = agent.materials
    ? `Background on ${agent.studentName}'s offer/business:\n"""\n${agent.materials}\n"""`
    : "";

  const historySection = pastMessages.length
    ? `${agent.studentName}'s best-performing past messages on this channel — use these as evidence of what this specific student's real voice and angle look like when it works, not as templates to copy verbatim:\n${pastMessages
        .map((m, i) => `${i + 1}. [outcome: ${m.outcome}] ${m.messageText}`)
        .join("\n")}`
    : "";

  const gapSection = `Research on the lead's company:\nSummary: ${gapAnalysis.summary}\nLikely gaps an operator would notice: ${gapAnalysis.likelyGaps.join(
    "; "
  )}`;

  return `You are drafting a single cold-outreach message on behalf of ${agent.studentName}, a course creator in the "${agent.niche}" space, reaching out to a lead on ${channel}.

${CHANNEL_RULES[channel]}

${toneSection}

${materialsSection}

${gapSection}

${historySection}

Write TWO distinct draft options — different angles or hooks, not just reworded versions of each other — following the channel rules above exactly. Ground the hook in something specific from the research, not a generic pain point. Respond ONLY with JSON, no markdown fences, no preamble:
{"drafts": [{"label": "short 2-4 word name for this angle", "subject": "(email only, omit otherwise)", "text": "..."}, {"label": "...", "text": "..."}]}`;
}

export async function generateDrafts(
  agent: StudentAgent,
  channel: Channel,
  gapAnalysis: GapAnalysis,
  pastMessages: OutreachMessage[],
  lead: LeadInput
): Promise<DraftOption[]> {
  const system = buildSystemPrompt(agent, channel, gapAnalysis, pastMessages);
  const userMessage = `Lead: ${lead.name} at ${lead.company}. Write the two drafts now.`;

  const provider = await getLlmProvider();
  const text = await provider.generateText({ system, prompt: userMessage, maxTokens: 1200 });

  const cleaned = text.replace(/```json|```/g, "").trim();
  try {
    const parsed = JSON.parse(cleaned);
    return Array.isArray(parsed.drafts) ? parsed.drafts : [];
  } catch {
    return [{ label: "Draft", text: text || "Couldn't generate a draft — try again." }];
  }
}
