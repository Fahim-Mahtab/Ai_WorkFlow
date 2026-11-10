import "server-only";
import { AIProviderError, type AIProvider, type CompletionOptions, type CompletionResult } from "./types";
import type { TokenUsage } from "../pricing";

export type ReasoningEffort = "none" | "low" | "high" | "max";

interface DeepSeekUsage {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
  prompt_cache_hit_tokens?: number;
  prompt_cache_miss_tokens?: number;
  completion_tokens_details?: { reasoning_tokens?: number };
}

function toUsage(u: DeepSeekUsage | undefined): TokenUsage | null {
  if (!u) return null;
  const prompt = u.prompt_tokens ?? 0;
  const hit = u.prompt_cache_hit_tokens ?? 0;
  return {
    promptTokens: prompt,
    completionTokens: u.completion_tokens ?? 0,
    cacheHitTokens: hit,
    cacheMissTokens: u.prompt_cache_miss_tokens ?? Math.max(0, prompt - hit),
    reasoningTokens: u.completion_tokens_details?.reasoning_tokens ?? 0,
    totalTokens: u.total_tokens ?? prompt + (u.completion_tokens ?? 0),
  };
}

/**
 * DeepSeek uses an OpenAI-compatible chat completions API.
 * Current models: `deepseek-flash` (cheap/fast) and `deepseek-v4-pro`. Both default to
 * "thinking" mode; we disable it by default because structured JSON generation does
 * not need visible reasoning and thinking tokens are billed as output.
 */
export class DeepSeekProvider implements AIProvider {
  readonly id = "deepseek" as const;
  readonly model: string;
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly effort: ReasoningEffort;

  constructor(apiKey: string, model = "deepseek-chat", baseUrl = "https://api.deepseek.com", effort: ReasoningEffort = "none") {
    this.apiKey = apiKey;
    this.model = model;
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.effort = effort;
  }

  async complete({ messages, json, temperature = 0.4, maxTokens = 16000, timeoutMs = 180_000 }: CompletionOptions): Promise<CompletionResult> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const thinking = this.effort !== "none";
    let res: Response;
    try {
      res = await fetch(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${this.apiKey}` },
        body: JSON.stringify({
          model: this.model,
          messages,
          max_tokens: maxTokens,
          ...(thinking ? { reasoning_effort: this.effort } : { thinking: { type: "disabled" }, temperature }),
          ...(json ? { response_format: { type: "json_object" } } : {}),
        }),
        signal: controller.signal,
        cache: "no-store",
      });
    } catch (err) {
      if ((err as Error).name === "AbortError") throw new AIProviderError(`DeepSeek timed out after ${Math.round(timeoutMs / 1000)}s`, "timeout");
      throw new AIProviderError(`Could not reach DeepSeek: ${(err as Error).message}`, "network");
    } finally {
      clearTimeout(timer);
    }
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      const hint =
        res.status === 401 ? " (check DEEPSEEK_API_KEY)" : res.status === 402 ? " (insufficient DeepSeek balance)" : res.status === 400 && /model/i.test(body) ? ` (model "${this.model}" not available — try DEEPSEEK_MODEL=deepseek-flash)` : "";
      throw new AIProviderError(`DeepSeek API error ${res.status}${hint}: ${body.slice(0, 200)}`, "http", res.status);
    }
    const data = (await res.json()) as { model?: string; usage?: DeepSeekUsage; choices?: { message?: { content?: string } }[] };
    const usage = toUsage(data.usage);
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new AIProviderError("DeepSeek returned an empty response", "empty", undefined, usage);
    return { content, usage, model: data.model ?? this.model };
  }
}
