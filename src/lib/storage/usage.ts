"use client";
/**
 * Local AI-spend ledger: running token/cost totals per workspace and overall.
 * Lives in LocalStorage next to the workspaces; clearing chat does not reset it.
 */
import type { UsageReport } from "../ai/pricing";

const KEY = "awp:v1:usage";
const EVENT = "awp-usage-changed";

export interface UsageTotals {
  calls: number;
  requests: number;
  promptTokens: number;
  completionTokens: number;
  cacheHitTokens: number;
  reasoningTokens: number;
  totalTokens: number;
  costUsd: number;
  /** true if some calls used a model without known pricing (cost is a lower bound) */
  partial: boolean;
}

interface Ledger {
  all: UsageTotals;
  byWorkspace: Record<string, UsageTotals>;
  /** usage of generations not yet attached to a workspace */
  pending: UsageTotals;
}

const zero = (): UsageTotals => ({ calls: 0, requests: 0, promptTokens: 0, completionTokens: 0, cacheHitTokens: 0, reasoningTokens: 0, totalTokens: 0, costUsd: 0, partial: false });

function load(): Ledger {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as Ledger;
  } catch {
    /* ignore */
  }
  return { all: zero(), byWorkspace: {}, pending: zero() };
}

function save(l: Ledger) {
  try {
    localStorage.setItem(KEY, JSON.stringify(l));
    window.dispatchEvent(new Event(EVENT));
  } catch {
    /* ignore quota */
  }
}

function add(t: UsageTotals, u: UsageReport | UsageTotals): UsageTotals {
  const isReport = "model" in u;
  return {
    calls: t.calls + u.calls,
    requests: t.requests + (isReport ? 1 : (u as UsageTotals).requests),
    promptTokens: t.promptTokens + u.promptTokens,
    completionTokens: t.completionTokens + u.completionTokens,
    cacheHitTokens: t.cacheHitTokens + (isReport ? (u as UsageReport).cacheHitTokens : (u as UsageTotals).cacheHitTokens),
    reasoningTokens: t.reasoningTokens + u.reasoningTokens,
    totalTokens: t.totalTokens + u.totalTokens,
    costUsd: t.costUsd + ((isReport ? (u as UsageReport).costUsd : (u as UsageTotals).costUsd) ?? 0),
    partial: t.partial || (isReport ? (u as UsageReport).costUsd === null : (u as UsageTotals).partial),
  };
}

/** Record one request's usage. `workspaceId` null = a generation not yet approved. */
export function recordUsage(workspaceId: string | null, u: UsageReport) {
  if (typeof window === "undefined") return;
  const l = load();
  l.all = add(l.all, u);
  if (workspaceId) l.byWorkspace[workspaceId] = add(l.byWorkspace[workspaceId] ?? zero(), u);
  else l.pending = add(l.pending, u);
  save(l);
}

/** When a generated workspace is approved, move its generation cost onto it. */
export function attachPendingUsage(workspaceId: string) {
  const l = load();
  if (!l.pending.calls) return;
  l.byWorkspace[workspaceId] = add(l.byWorkspace[workspaceId] ?? zero(), l.pending);
  l.pending = zero();
  save(l);
}

export function getUsage(): Ledger {
  if (typeof window === "undefined") return { all: zero(), byWorkspace: {}, pending: zero() };
  return load();
}

export function resetUsage() {
  save({ all: zero(), byWorkspace: {}, pending: zero() });
}

export function onUsageChange(cb: () => void): () => void {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}
