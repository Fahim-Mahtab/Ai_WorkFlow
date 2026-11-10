"use client";
/** Token usage + cost display for AI calls (per reply, and running totals). */
import { useEffect, useState } from "react";
import { Coins } from "lucide-react";
import { formatUsd, type UsageReport } from "@/lib/ai/pricing";
import { getUsage, onUsageChange, type UsageTotals } from "@/lib/storage/usage";
import { cn } from "@/lib/utils";

export const fmtTokens = (n: number) => (n >= 1_000_000 ? `${(n / 1_000_000).toFixed(2)}M` : n >= 10_000 ? `${(n / 1000).toFixed(1)}k` : n.toLocaleString("en-US"));
const perM = (v: number) => `$${v < 0.01 ? v.toFixed(4) : v.toFixed(3)}/M`;

/** One request's usage. Click to expand the breakdown. */
export function UsageBadge({ usage, label, className }: { usage: UsageReport | null | undefined; label?: string; className?: string }) {
  const [open, setOpen] = useState(false);
  if (!usage) return null;
  return (
    <div className={cn("text-[11px] text-muted-foreground", className)}>
      <button type="button" onClick={() => setOpen((o) => !o)} className="inline-flex items-center gap-1 rounded-md px-1 py-0.5 hover:bg-muted hover:text-foreground" title="Token usage & cost — click for details" aria-expanded={open}>
        <Coins className="size-3" />
        {label && <span>{label}</span>}
        <span className="tabular-nums">{fmtTokens(usage.totalTokens)} tokens</span>
        <span>·</span>
        <span className="font-medium tabular-nums text-foreground">{formatUsd(usage.costUsd)}</span>
        {usage.calls > 1 && <span>· {usage.calls} calls</span>}
      </button>
      {open && (
        <div className="mt-1 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 rounded-md border bg-card px-2.5 py-2 tabular-nums">
          <span>Model</span><span className="text-foreground">{usage.model}</span>
          <span>Input</span>
          <span className="text-foreground">
            {usage.promptTokens.toLocaleString()} <span className="text-muted-foreground">({usage.cacheHitTokens.toLocaleString()} cached · {usage.cacheMissTokens.toLocaleString()} new)</span>
          </span>
          <span>Output</span>
          <span className="text-foreground">
            {usage.completionTokens.toLocaleString()}
            {usage.reasoningTokens > 0 && <span className="text-muted-foreground"> (incl. {usage.reasoningTokens.toLocaleString()} reasoning)</span>}
          </span>
          {usage.rates && (
            <>
              <span>Rate</span>
              <span className="text-foreground">
                {usage.peak ? "Peak" : "Off-peak"} · in {perM(usage.rates.cacheMiss)} · cached {perM(usage.rates.cacheHit)} · out {perM(usage.rates.output)}
              </span>
            </>
          )}
          <span>Cost</span><span className="font-medium text-foreground">{usage.costUsd === null ? "unknown (no price for this model)" : `$${usage.costUsd.toFixed(6)}`}</span>
          <span>Time</span><span className="text-foreground">{(usage.ms / 1000).toFixed(1)}s</span>
        </div>
      )}
    </div>
  );
}

/** Live running totals from the local usage ledger. */
export function useUsageTotals(workspaceId?: string | null): { workspace: UsageTotals | null; all: UsageTotals | null } {
  // start empty on both server and client; LocalStorage is read after mount (no hydration mismatch)
  const [state, setState] = useState<{ workspace: UsageTotals | null; all: UsageTotals | null }>({ workspace: null, all: null });
  useEffect(() => {
    const read = () => {
      const l = getUsage();
      setState({ workspace: workspaceId ? l.byWorkspace[workspaceId] ?? null : null, all: l.all });
    };
    read();
    return onUsageChange(read);
  }, [workspaceId]);
  return state;
}

export function UsageTotalPill({ totals, title }: { totals: UsageTotals | null; title: string }) {
  if (!totals || !totals.calls) return null;
  return (
    <span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] tabular-nums text-muted-foreground" title={`${title}: ${totals.requests} AI requests · ${totals.totalTokens.toLocaleString()} tokens · $${totals.costUsd.toFixed(6)}${totals.partial ? " (some calls unpriced)" : ""}`}>
      <Coins className="size-3" />
      {fmtTokens(totals.totalTokens)} · {formatUsd(totals.costUsd)}
      {totals.partial && "+"}
    </span>
  );
}
