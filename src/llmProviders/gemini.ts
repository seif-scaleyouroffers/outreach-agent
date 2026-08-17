// Gemini's free tier (get a key instantly at aistudio.google.com, no
// waiting/approval needed) — used as a drop-in stand-in for Anthropic while
// testing the concept, swappable back via LLM_PROVIDER=anthropic once a
// real Anthropic key is available. No new SDK dependency; plain REST.

import type { LlmProvider, GenerateOptions } from "../llmProvider";

const MODEL = "gemini-3.6-flash";

function env(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

export const geminiProvider: LlmProvider = {
  async generateText({ system, prompt, useWebSearch }: GenerateOptions): Promise<string> {
    const apiKey = env("GEMINI_API_KEY");
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`;

    const body: Record<string, unknown> = {
      contents: [{ role: "user", parts: [{ text: prompt }] }],
    };
    if (system) {
      body.systemInstruction = { parts: [{ text: system }] };
    }
    if (useWebSearch) {
      // Google Search grounding — Gemini's equivalent of Anthropic's
      // web_search tool. This exact shape (tool name/casing) has shifted
      // across Gemini API versions before; if grounding stops returning
      // results, check Google AI Studio's current docs for the tool's
      // current syntax rather than assuming this is still accurate.
      body.tools = [{ googleSearch: {} }];
    }

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`Gemini request failed: ${await res.text()}`);

    const data = await res.json();
    const parts: { text?: string }[] = data?.candidates?.[0]?.content?.parts ?? [];
    return parts.map((p) => p.text ?? "").join("\n");
  },
};
