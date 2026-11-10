"use client";
/**
 * One-click manager briefing. The browser works out the facts (late work, at-risk deadlines,
 * workload, missing work logs); the AI writes them up in the workspace language and suggests
 * next steps. The last briefing is kept, so reopening it costs nothing.
 */
import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, ClipboardCheck, Info, Loader2, OctagonAlert, RefreshCw } from "lucide-react";
import { aiClient, ApiError } from "@/lib/ai/client";
import { buildFacts, type Briefing } from "@/lib/insights/briefing";
import type { Workspace } from "@/lib/config/types";
import type { UsageReport } from "@/lib/ai/pricing";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/primitives";
import { UsageBadge } from "./usage-badge";
import { cn, relativeTime } from "@/lib/utils";

interface Saved {
  at: string;
  mode: "live" | "demo";
  briefing: Briefing;
  usage: UsageReport | null;
}
const key = (id: string) => `awp:v1:briefing:${id}`;

const TONE = {
  risk: { icon: OctagonAlert, cls: "text-red-600 dark:text-red-400", label: "Late" },
  warn: { icon: AlertTriangle, cls: "text-amber-600 dark:text-amber-400", label: "Watch" },
  good: { icon: CheckCircle2, cls: "text-emerald-600 dark:text-emerald-400", label: "Good" },
  info: { icon: Info, cls: "text-blue-600 dark:text-blue-400", label: "Note" },
};

export function BriefingDialog({ workspace, open, onOpenChange }: { workspace: Workspace; open: boolean; onOpenChange: (o: boolean) => void }) {
  const [saved, setSaved] = useState<Saved | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(key(workspace.id));
      setSaved(raw ? (JSON.parse(raw) as Saved) : null);
    } catch {
      setSaved(null);
    }
  }, [workspace.id]);

  const run = async (forceDemo = false) => {
    setBusy(true);
    setError(null);
    try {
      const r = await aiClient.briefing({ facts: buildFacts(workspace), forceDemo }, workspace.id);
      const s: Saved = { at: new Date().toISOString(), mode: r.mode, briefing: r.briefing, usage: r.usage };
      setSaved(s);
      try {
        localStorage.setItem(key(workspace.id), JSON.stringify(s));
      } catch {
        /* ignore */
      }
    } catch (e) {
      setError(e instanceof ApiError ? e : new ApiError(String(e), "unknown"));
    } finally {
      setBusy(false);
    }
  };

  // first open with nothing saved: make one straight away
  useEffect(() => {
    if (open && !saved && !busy && !error) run();
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const b = saved?.briefing;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader
          title={<span className="flex items-center gap-2"><ClipboardCheck className="size-5 text-primary" /> Manager briefing</span>}
          description={saved ? `Made ${relativeTime(saved.at)} from your tasks, deadlines and work logs.` : "Late work, risky deadlines, workload and next steps."}
        />
        <DialogBody className="space-y-4">
          {busy && !b && <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Reading your tasks and work logs…</p>}
          {error && (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 p-2.5 text-xs text-destructive">
              {error.message}
              {error.canFallback && <Button variant="link" size="sm" className="h-auto px-1 text-xs" onClick={() => run(true)}>Make it without AI</Button>}
            </div>
          )}
          {b && (
            <div className={cn("space-y-4", busy && "opacity-50")}>
              <p className="text-base font-medium">{b.headline}</p>
              <ul className="space-y-2">
                {b.items.map((it, i) => {
                  const T = TONE[it.tone];
                  return (
                    <li key={i} className="flex items-start gap-2.5 text-sm">
                      <T.icon className={cn("mt-0.5 size-4 shrink-0", T.cls)} aria-label={T.label} />
                      <span>{it.text}</span>
                    </li>
                  );
                })}
              </ul>
              {b.actions.length > 0 && (
                <div className="rounded-xl border bg-accent/40 p-3">
                  <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Next steps</p>
                  <ol className="list-decimal space-y-1 pl-5 text-sm">{b.actions.map((a, i) => <li key={i}>{a}</li>)}</ol>
                </div>
              )}
              <div className="flex flex-wrap items-center gap-2">
                <Badge color={saved?.mode === "live" ? "green" : "amber"}>{saved?.mode === "live" ? "AI" : "No AI (from your data)"}</Badge>
                <UsageBadge usage={saved?.usage} />
              </div>
            </div>
          )}
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Close</Button>
          <Button size="sm" onClick={() => run()} disabled={busy}>{busy ? <Loader2 className="animate-spin" /> : <RefreshCw />} Refresh</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
