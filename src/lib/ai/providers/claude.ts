import "server-only";
import { AIProviderError, type AIProvider, type CompletionOptions, type CompletionResult } from "./types";

/**
 * Placeholder for a future Claude integration. It satisfies the same
 * `AIProvider` interface, so enabling it later only requires implementing
 * `complete()` (returning content + token usage) and setting
 * AI_PROVIDER=claude + ANTHROPIC_API_KEY.
 */
export class ClaudeProvider implements AIProvider {
  readonly id = "claude" as const;
  constructor(
    private readonly apiKey: string,
    readonly model: string,
  ) {}

  async complete(_opts: CompletionOptions): Promise<CompletionResult> {
    void _opts;
    void this.apiKey;
    throw new AIProviderError("Claude provider is not implemented in this PoC yet", "config");
  }
}
