"use client";
import { useMemo } from "react";
import { ListChecks, Plus } from "lucide-react";
import type { WidgetOf } from "@/lib/config/types";
import { useEnv } from "@/components/dashboard/env";
import { applyFilter } from "@/lib/engine/query";
import { getRows } from "@/lib/engine/sources";
import { useWorkspaceActions } from "@/lib/workspace/store";
import { AssigneeStack, DueDate, StatusBadge } from "@/components/tasks/task-bits";
import { Checkbox, EmptyState } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const PRIORITY_RANK = { urgent: 0, high: 1, medium: 2, low: 3 } as const;

export function TaskListWidget({ widget }: { widget: WidgetOf<"taskList"> }) {
  const { workspace, config, readOnly, openTask, newTask, t } = useEnv();
  const actions = useWorkspaceActions(workspace.id);
  const doneIds = new Set(config.taskStatuses.filter((s) => s.isDone).map((s) => s.id));
  const firstOpen = config.taskStatuses.find((s) => !s.isDone)?.id ?? config.taskStatuses[0].id;
  const doneId = config.taskStatuses.find((s) => s.isDone)?.id;

  const tasks = useMemo(() => {
    const allowed = new Set(applyFilter(getRows(workspace, "tasks"), widget.filter).map((r) => r.id));
    return workspace.data.tasks
      .filter((x) => allowed.has(x.id) && (widget.showCompleted || !doneIds.has(x.status)))
      .sort((a, b) => (doneIds.has(a.status) ? 1 : 0) - (doneIds.has(b.status) ? 1 : 0) || PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || String(a.dueDate ?? "9").localeCompare(String(b.dueDate ?? "9")))
      .slice(0, widget.limit ?? 10);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspace, widget.filter, widget.showCompleted, widget.limit]);

  return (
    <div className="flex h-full flex-col">
      {tasks.length === 0 ? (
        <EmptyState icon={<ListChecks />} title={t("noTasks")} className="py-6" />
      ) : (
        <ul className="divide-y">
          {tasks.map((task) => {
            const done = doneIds.has(task.status);
            return (
              <li key={task.id} className="flex items-center gap-2.5 py-2">
                <Checkbox checked={done} disabled={readOnly || !doneId} onChange={() => actions.updateTask(task.id, { status: done ? firstOpen : doneId! })} aria-label="Toggle complete" />
                <button className={cn("min-w-0 flex-1 truncate text-left text-sm hover:underline", done && "text-muted-foreground line-through")} onClick={() => openTask(task.id)}>
                  {task.title}
                </button>
                <DueDate date={task.dueDate} done={done} />
                <StatusBadge config={config} status={task.status} />
                <AssigneeStack config={config} ids={task.assigneeIds} max={2} />
              </li>
            );
          })}
        </ul>
      )}
      {!readOnly && (
        <Button variant="ghost" size="sm" className="mt-1 self-start text-muted-foreground" onClick={() => newTask()}>
          <Plus /> {t("addTask")}
        </Button>
      )}
    </div>
  );
}
