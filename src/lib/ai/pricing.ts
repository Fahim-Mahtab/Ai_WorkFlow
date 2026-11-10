/**
 * DeepSeek token pricing (USD per 1M tokens), from
 * https://api-docs.deepseek.com/quick_start/pricing/ as of 2026-11-09.
 * Peak hours: 01:00–04:00 and 06:00–10:00 UTC, Mon–Fri; off-peak is half price.
 * (Chinese public holidays are also off-peak — not modelled here, so costs on those
 * days are slightly over-estimated.) Prices can change: update this table if they do.
 */
export interface Rates {
  cacheHit: number;
  cacheMiss: number;
  output: number;
}

const PEAK_RATES: Record<string, Rates> = {
  "deepseek-chat": { cacheHit: 0.07, cacheMiss: 0.27, output: 1.1 },
  "deepseek-reasoner": { cacheHit: 0.14, cacheMiss: 0.55, output: 2.19 },
  "deepseek-flash": { cacheHit: 0.006, cacheMiss: 0.3, output: 1.2 },
  "deepseek-v4-pro": { cacheHit: 0.044, cacheMiss: 1.32, output: 3.96 },
};

export const PRICING_SOURCE = "api-docs.deepseek.com/quick_start/pricing (2026-11-09)";

export function isPeak(at: Date = new Date()): boolean {
  const day = at.getUTCDay(); // 0 Sun … 6 Sat
  if (day === 0 || day === 6) return false;
  const h = at.getUTCHours();
  return (h >= 1 && h < 4) || (h >= 6 && h < 10);
}

export function ratesFor(model: string, at: Date = new Date()): { rates: Rates; peak: boolean } | null {
  const base = PEAK_RATES[model];
  if (!base) return null;
  const peak = isPeak(at);
  const f = peak ? 1 : 0.5;
  return { peak, rates: { cacheHit: base.cacheHit * f, cacheMiss: base.cacheMiss * f, output: base.output * f } };
}

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number; // includes reasoning tokens (billed as output)
  cacheHitTokens: number;
  cacheMissTokens: number;
  reasoningTokens: number;
  totalTokens: number;
}

/** Aggregated usage for one user action (may span several API calls, e.g. a repair retry). */
export interface UsageReport extends TokenUsage {
  model: string;
  calls: number;
  costUsd: number | null; // null when the model has no known price
  peak: boolean;
  rates: Rates | null;
  ms: number;
}

export const emptyUsage = (): TokenUsage => ({ promptTokens: 0, completionTokens: 0, cacheHitTokens: 0, cacheMissTokens: 0, reasoningTokens: 0, totalTokens: 0 });

export function costOf(u: TokenUsage, rates: Rates): number {
  return (u.cacheHitTokens * rates.cacheHit + u.cacheMissTokens * rates.cacheMiss + u.completionTokens * rates.output) / 1_000_000;
}

export function formatUsd(v: number | null | undefined): string {
  if (v === null || v === undefined) return "—";
  if (v === 0) return "$0";
  if (v < 0.0001) return "<$0.0001";
  if (v < 0.01) return `$${v.toFixed(4)}`;
  return `$${v.toFixed(3)}`;
}
