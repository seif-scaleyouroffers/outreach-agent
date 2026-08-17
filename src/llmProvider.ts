// Swappable LLM provider. Both the gap-analysis and drafting steps call
// through this interface instead of a specific SDK directly, so switching
// between providers (e.g. testing on Gemini's free tier while waiting on
// an Anthropic key, then switching back once it arrives) is a one-line env
// var change (LLM_PROVIDER), not a rewrite of either feature.
//
// Both providers support the same two things this app actually needs:
// plain text-in/text-out generation, and a web-search tool for the gap
// analysis step.

export interface GenerateOptions {
  system?: string;
  prompt: string;
  maxTokens?: number;
  /** Whether this call needs to search the web (only the gap-analysis step does). */
  useWebSearch?: boolean;
}

export interface LlmProvider {
  generateText(options: GenerateOptions): Promise<string>;
}

export async function getLlmProvider(): Promise<LlmProvider> {
  const provider = (process.env.LLM_PROVIDER || "anthropic").toLowerCase();
  if (provider === "gemini") {
    // Lazy import so the Anthropic SDK path (the default/production path)
    // never pulls in Gemini-specific code unless it's actually selected.
    const { geminiProvider } = await import("./llmProviders/gemini");
    return geminiProvider;
  }
  const { anthropicProvider } = await import("./llmProviders/anthropic");
  return anthropicProvider;
}
