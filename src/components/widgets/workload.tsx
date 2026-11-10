"use client";
/**
 * Workload: each person's open work split by status, with late / at-risk deadlines,
 * this week's deadlines and logged hours. Worked out in the browser (no AI).
 */
import { AlertTriangle, CalendarClock, OctagonAlert, Users } from "lucide-react";
import type { WidgetOf } from "@/lib/config/types";
import { useEnv } from "@/components/dashboard/env";
import { workload } from "@/lib/views/views";
import { Avatar } from "@/components/tasks/task-bits";
import { DOT_COLORS, EmptyState } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

export function WorkloadWidget({ widget }: { widget: WidgetOf<"workload"> }) {
  const { workspace, config } = useEnv();
  const rows = workload(workspace);
  if (!rows.length) return <EmptyState icon={<Users />} title="No people yet" description="Add your team to see who has how much work." className="py-6" />;
  const max = Math.max(1, ...rows.map((r) => r.open));
  const avg = rows.reduce((s, r) => s + r.open, 0) / rows.length;
  const statuses = config.taskStatuses.filter((s) => !s.isDone);
  const member = (id: string) => config.team.members.find((m) => m.id === id);
  void widget;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
        {statuses.map((s) => (
          <span key={s.id} className="inline-flex items-center gap-1"><span className={cn("size-2 rounded-sm", DOT_COLORS[s.color])} />{s.label}</span>
        ))}
      </div>
      <ul className="space-y-3">
        {rows.map((r) => {
          const heavy = r.open >= 3 && r.open > avg * 1.5;
          return (
            <li key={r.memberId} className="space-y-1.5">
              <div className="flex items-center gap-2 text-sm">
                {member(r.memberId) && <Avatar member={member(r.memberId)!} />}
                <span className="min-w-0 flex-1 truncate">
                  <span className="font-medium">{r.name}</span>
                  {r.role && <span className="text-xs text-muted-foreground"> · {r.role}</span>}
                </span>
                {r.late > 0 && <span className="inline-flex items-center gap-1 text-xs text-red-600 dark:text-red-400" title="Past the deadline"><OctagonAlert className="size-3.5" />{r.late} late</span>}
                {r.atRisk > 0 && <span className="inline-flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400" title="Due within 2 days, not started"><AlertTriangle className="size-3.5" />{r.atRisk} at risk</span>}
                <span className={cn("w-16 text-right text-xs tabular-nums", heavy ? "font-semibold text-amber-600 dark:text-amber-400" : "text-muted-foreground")}>{r.open} open</span>
              </div>
              <div className="flex h-2.5 gap-0.5 overflow-hidden rounded-full bg-muted" role="img" aria-label={`${r.name}: ${r.byStatus.map((b) => `${b.count} ${config.taskStatuses.find((s) => s.id === b.statusId)?.label}`).join(", ")}`}>
                {r.byStatus.filter((b) => b.count).map((b) => {
                  const s = config.taskStatuses.find((x) => x.id === b.statusId)!;
                  return <div key={b.statusId} className={cn("h-full first:rounded-l-full last:rounded-r-full", DOT_COLORS[s.color])} style={{ width: `${(b.count / max) * 100}%` }} title={`${s.label}: ${b.count}`} />;
                })}
              </div>
              <p className="flex flex-wrap gap-x-3 text-[11px] text-muted-foreground">
                <span>{r.dueThisWeek} due in 7 days</span>
                <span>{r.doneThisWeek} done this week</span>
                <span>{r.hours7d ? `${r.hours7d}h logged` : `${r.logs7d} log entries`} (7 days)</span>
                {r.nextDeadline && <span className="inline-flex items-center gap-1"><CalendarClock className="size-3" />next: {r.nextDeadline.title} · {r.nextDeadline.date}</span>}
              </p>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
