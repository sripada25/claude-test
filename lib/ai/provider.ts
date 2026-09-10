import { geminiAdapter, MODEL, PROVIDER_NAME } from "./gemini.ts";
import type { AIProvider } from "./types.ts";

// AI-RULES.md §1: services import the interface, never a concrete adapter
// directly. One env var selects which one - swapping providers is one new
// file plus a branch here, per L060.
export function getAIProvider(): AIProvider {
  const provider = process.env.AI_PROVIDER ?? "gemini";

  switch (provider) {
    case "gemini":
      return geminiAdapter;
    default:
      throw new Error(`Unknown AI_PROVIDER: ${provider}`);
  }
}

// For callers that persist which provider/model actually ran (e.g.
// documents.provider/model) without hardcoding "gemini" themselves.
export function getAIProviderMetadata(): { provider: string; model: string } {
  const provider = process.env.AI_PROVIDER ?? "gemini";

  switch (provider) {
    case "gemini":
      return { provider: PROVIDER_NAME, model: MODEL };
    default:
      throw new Error(`Unknown AI_PROVIDER: ${provider}`);
  }
}
