"use client";
import type { WidgetOf } from "@/lib/config/types";
import { useEnv } from "@/components/dashboard/env";
import { WorklogComposer } from "@/components/worklog/worklog-composer";
import { Badge } from "@/components/ui/primitives";

export function WorklogWidget({ widget }: { widget: WidgetOf<"worklog"> }) {
  const { workspace, config, readOnly, t } = useEnv();
  const recent = workspace.data.worklogs.slice(0, widget.showRecent ?? 5);
  return (
    <div className="space-y-4">
      <WorklogComposer workspace={workspace} readOnly={readOnly} />
      {recent.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground">{t("recentEntries")}</p>
          <ul className="divide-y text-sm">
            {recent.map((w) => (
              <li key={w.id} className="flex items-start gap-2 py-1.5">
                <span className="w-20 shrink-0 text-xs text-muted-foreground">{w.date}</span>
                <span className="min-w-0 flex-1">{w.description}</span>
                <span className="shrink-0 text-xs text-muted-foreground">{config.team.members.find((m) => m.id === w.memberId)?.name}</span>
                {w.status === "in_progress" && <Badge color="blue">…</Badge>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
