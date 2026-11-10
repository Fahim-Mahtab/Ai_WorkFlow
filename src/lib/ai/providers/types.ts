/**
 * Provider-agnostic interface. Add a new provider (e.g. Claude) by
 * implementing `AIProvider` and registering it in `providers/index.ts`.
 */
import type { TokenUsage } from "../pricing";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface CompletionOptions {
  messages: ChatMessage[];
  /** Ask the provider for a JSON object response. */
  json?: boolean;
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
}

export interface CompletionResult {
  content: string;
  /** Token usage reported by the provider for this single call. */
  usage: TokenUsage | null;
  model: string;
}

export interface AIProvider {
  readonly id: "deepseek" | "claude";
  readonly model: string;
  complete(opts: CompletionOptions): Promise<CompletionResult>;
}

export class AIProviderError extends Error {
  constructor(
    message: string,
    public readonly code: "timeout" | "http" | "network" | "empty" | "config",
    public readonly status?: number,
    /** Tokens may have been billed even when the call failed downstream. */
    public readonly usage: TokenUsage | null = null,
  ) {
    super(message);
    this.name = "AIProviderError";
  }
}
