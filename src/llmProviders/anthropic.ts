import Anthropic from "@anthropic-ai/sdk";
import type { LlmProvider, GenerateOptions } from "../llmProvider";

const anthropic = new Anthropic();

export const anthropicProvider: LlmProvider = {
  async generateText({ system, prompt, maxTokens = 1500, useWebSearch }: GenerateOptions): Promise<string> {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-5",
      max_tokens: maxTokens,
      system,
      messages: [{ role: "user", content: prompt }],
      ...(useWebSearch
        ? { tools: [{ type: "web_search_20250305", name: "web_search" } as unknown as Anthropic.Tool] }
        : {}),
    } as Anthropic.MessageCreateParamsNonStreaming);

    return response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n");
  },
};
