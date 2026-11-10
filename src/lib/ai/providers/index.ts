import "server-only";
import type { AIProvider } from "./types";
import { DeepSeekProvider, type ReasoningEffort } from "./deepseek";
import { ClaudeProvider } from "./claude";
import { ratesFor, PRICING_SOURCE, type Rates } from "../pricing";

export interface ProviderStatus {
  mode: "live" | "demo";
  provider: "deepseek" | "claude" | "mock";
  model: string;
  reasoning?: ReasoningEffort;
  pricing?: { peak: boolean; rates: Rates; source: string } | null;
}

/** DeepSeek model aliases / fallbacks. */
const MODEL_ALIASES: Record<string, string> = {
  "deepseek-flash": "deepseek-chat",
  "deepseek-v4-flash": "deepseek-chat",
};

function effort(): ReasoningEffort {
  const e = (process.env.DEEPSEEK_REASONING_EFFORT ?? "none").toLowerCase();
  return (["none", "low", "high", "max"].includes(e) ? e : "none") as ReasoningEffort;
}

/**
 * Resolve the configured provider from server-side env vars.
 * Returns null when no key is configured → the pipeline uses demo (mock) mode.
 */
export function getProvider(): AIProvider | null {
  const which = (process.env.AI_PROVIDER ?? "deepseek").toLowerCase();
  if (which === "claude" && process.env.ANTHROPIC_API_KEY) {
    return new ClaudeProvider(process.env.ANTHROPIC_API_KEY, process.env.CLAUDE_MODEL ?? "claude-sonnet-5-5");
  }
  const key = process.env.DEEPSEEK_API_KEY?.trim();
  if (!key) return null;
  const requested = process.env.DEEPSEEK_MODEL?.trim() || "deepseek-chat";
  return new DeepSeekProvider(key, MODEL_ALIASES[requested] ?? requested, process.env.DEEPSEEK_BASE_URL || undefined, effort());
}

export function providerStatus(): ProviderStatus {
  const p = getProvider();
  if (!p) return { mode: "demo", provider: "mock", model: "rule-based demo generator" };
  const r = ratesFor(p.model);
  return { mode: "live", provider: p.id, model: p.model, reasoning: effort(), pricing: r ? { ...r, source: PRICING_SOURCE } : null };
}
