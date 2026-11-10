"use client";
import { useState } from "react";
import { CalendarDays, Eye, ListTree, Minus, Pencil, Plus, ShieldCheck, SquareCheck } from "lucide-react";
import type { SeedTask, Unsupported, Workspace, WorkspaceConfig } from "@/lib/config/types";
import { UnsupportedNotice } from "./capability-notice";
import type { Change } from "@/lib/workspace/diff";
import { isSignificant } from "@/lib/workspace/diff";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/primitives";
import { DashboardCanvas } from "@/components/dashboard/dashboard-canvas";
import { WorkspaceEnv } from "@/components/tasks/task-dialog-host";
import { cn } from "@/lib/utils";

const KIND = {
  added: { icon: Plus, color: "green" as const, label: "Added" },
  removed: { icon: Minus, color: "red" as const, label: "Removed" },
  modified: { icon: Pencil, color: "blue" as const, label: "Changed" },
};

export function ChangePreviewDialog({
  open,
  onOpenChange,
  workspace,
  next,
  changes,
  summary,
  warnings,
  unsupported = [],
  newTasks = [],
  onApply,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  workspace: Workspace;
  next: WorkspaceConfig | null;
  changes: Change[];
  summary: string[];
  warnings: string[];
  unsupported?: Unsupported[];
  newTasks?: SeedTask[];
  onApply: () => void;
}) {
  const [tab, setTab] = useState<"changes" | "preview">("changes");
  if (!next) return null;
  const significant = isSignificant(changes);
  const previewWs: Workspace = { ...workspace, config: next };
  const changedPage = next.pages.find((p) => changes.some((c) => c.area === "widget" && c.kind !== "removed" && p.widgets.some((w) => w.title === c.label)))?.id;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size={tab === "preview" ? "xl" : "lg"}>
        <DialogHeader
          title={
            <span className="flex items-center gap-2">
              Review AI changes {significant && <Badge color="amber">significant</Badge>}
            </span>
          }
          description="Nothing is applied until you approve. Your tasks, records and work logs are preserved."
        />
        <div className="flex gap-1 rounded-lg bg-muted p-1 text-sm">
          {(["changes", "preview"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)} className={cn("flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5", tab === t ? "bg-card font-medium shadow-xs" : "text-muted-foreground")}>
              {t === "changes" ? <ListTree className="size-4" /> : <Eye className="size-4" />}
              {t === "changes" ? `Changes (${changes.length + newTasks.length})` : "Live preview"}
            </button>
          ))}
        </div>
        <DialogBody>
          {tab === "changes" ? (
            <div className="space-y-4">
              {summary.length > 0 && (
                <ul className="list-disc space-y-1 pl-5 text-sm">
                  {summary.map((s, i) => <li key={i}>{s}</li>)}
                </ul>
              )}
              {newTasks.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">New tasks ({newTasks.length})</p>
                  <ul className="divide-y rounded-lg border">
                    {newTasks.map((t, i) => (
                      <li key={i} className="flex items-start gap-3 px-3 py-2 text-sm">
                        <SquareCheck className="mt-0.5 size-4 shrink-0 text-primary" />
                        <div className="min-w-0 flex-1">
                          <p className="font-medium">{t.title}</p>
                          {t.description && <p className="text-xs text-muted-foreground">{t.description}</p>}
                          <p className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                            <span>{(t.assigneeIds ?? []).map((id) => next.team.members.find((m) => m.id === id)?.name ?? id).join(", ") || "Unassigned"}</span>
                            {t.dueDate && <span className="inline-flex items-center gap-1"><CalendarDays className="size-3" />{t.dueDate}</span>}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {changes.length === 0 ? (
                newTasks.length === 0 && <p className="text-sm text-muted-foreground">No structural differences detected.</p>
              ) : (
                <ul className="divide-y rounded-lg border">
                  {changes.map((c, i) => {
                    const K = KIND[c.kind];
                    return (
                      <li key={i} className="flex items-start gap-3 px-3 py-2 text-sm">
                        <Badge color={K.color} className="mt-0.5"><K.icon className="size-3" />{K.label}</Badge>
                        <div className="min-w-0">
                          <p><span className="text-muted-foreground">{c.area}:</span> {c.label}</p>
                          {c.detail && <p className="text-xs text-muted-foreground">{c.detail}</p>}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
              <UnsupportedNotice items={unsupported} lang={workspace.config.language} />
              {warnings.length > 0 && (
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs">
                  <p className="mb-1 font-medium">Auto-fixed by the registry validator</p>
                  <ul className="list-disc pl-4 text-muted-foreground">{warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>
                </div>
              )}
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><ShieldCheck className="size-3.5" /> Validated with Zod and the component registry — no executable code.</p>
            </div>
          ) : (
            <div className="rounded-lg bg-background p-3">
              <WorkspaceEnv workspace={previewWs} readOnly>
                <DashboardCanvas workspace={previewWs} readOnly initialPageId={changedPage} />
              </WorkspaceEnv>
            </div>
          )}
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Discard</Button>
          <Button size="sm" onClick={onApply}>Apply changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
