// Researches what's publicly available about a lead's company (site + public
// social presence, via web search) and surfaces likely operational gaps —
// the same shape as "funnel breakdown / where the money leaks / likely tech
// stack gap" from the reference take-home task: a stranger wouldn't notice
// these, an operator would.
//
// Deliberately scoped to public information only — no scraping behind
// logins, no paid enrichment APIs. Good enough to inform an outreach angle,
// not a full audit.

import type { LeadInput, GapAnalysis } from "../types";
import { getLlmProvider } from "../llmProvider";

export async function runGapAnalysis(lead: LeadInput): Promise<GapAnalysis> {
  const linksSection = lead.socialLinks
    ? `Public social/company links to consider:\n${lead.socialLinks}`
    : "";

  const prompt = `Research this company using web search, using only publicly available information (their website, public social posts, public reviews/press) — no guessing beyond what you can find or reasonably infer from what's public.

Company: ${lead.company}
Contact: ${lead.name}${lead.email ? ` (${lead.email})` : ""}
${lead.companyWebsite ? `Website: ${lead.companyWebsite}` : ""}
${linksSection}

Produce, in the voice of an operator sizing up where they could help (not a generic marketing report):
1. A one-paragraph summary of what this company does and how they likely acquire customers (their probable funnel, top to bottom).
2. 2-4 specific, likely operational gaps — things a stranger browsing their site wouldn't notice but an experienced operator would (e.g. funnel steps that look manual, a tech-stack tell, a probable follow-up gap, an outdated or thin piece of their online presence). Be concrete and specific to this company, not generic advice that could apply to anyone.
3. The URLs you actually found and used.

Respond ONLY with JSON, no markdown fences, no preamble:
{"summary": "...", "likelyGaps": ["...", "..."], "sources": ["...", "..."]}`;

  const provider = await getLlmProvider();
  const text = await provider.generateText({ prompt, maxTokens: 1500, useWebSearch: true });

  const cleaned = text.replace(/```json|```/g, "").trim();
  try {
    const parsed = JSON.parse(cleaned);
    return {
      summary: parsed.summary ?? "",
      likelyGaps: Array.isArray(parsed.likelyGaps) ? parsed.likelyGaps : [],
      sources: Array.isArray(parsed.sources) ? parsed.sources : [],
    };
  } catch {
    // Model didn't return clean JSON (rare, but web-search-tool responses can
    // interleave text/tool blocks) — fall back to surfacing raw text rather
    // than silently failing.
    return { summary: text || "Couldn't complete research.", likelyGaps: [], sources: [] };
  }
}
