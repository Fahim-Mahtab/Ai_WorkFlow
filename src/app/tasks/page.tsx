"use client";
/** Task management + self-reported work. Views reuse registry widgets (kanban/list/table/calendar). */
import { useState } from "react";
import { CalendarDays, ClipboardList, Gauge, KanbanSquare, ListChecks, Plus, Table2 } from "lucide-react";
import { SavedViews } from "@/components/tasks/saved-views";
import { describeQuery, filterTasks, type SavedView } from "@/lib/views/views";
import { PageHeader, RequireWorkspace } from "@/components/layout/page-header";
import { WorkspaceEnv } from "@/components/tasks/task-dialog-host";
import { useEnv } from "@/components/dashboard/env";
import { RenderWidget } from "@/components/dashboard/widget-registry";
import { WorklogComposer } from "@/components/worklog/worklog-composer";
import { Button } from "@/components/ui/button";
import { Card, NativeSelect } from "@/components/ui/primitives";
import type { Filter, Widget, Workspace } from "@/lib/config/types";
import { cn } from "@/lib/utils";

type View = "board" | "list" | "table" | "calendar" | "workload" | "worklog";

function TasksInner() {
  const { workspace, config, newTask } = useEnv();
  const [view, setView] = useState<View>("board");
  const [scope, setScope] = useState("all");
  const [saved, setSaved] = useState<SavedView | null>(null);
  // a saved view narrows the tasks every view below shows
  const current = saved ? (workspace.views ?? []).find((v) => v.id === saved.id) ?? null : null;
  const viewWs: Workspace = current ? { ...workspace, data: { ...workspace.data, tasks: filterTasks(workspace.data.tasks, current.query, config) } } : workspace;
  const filter: Filter | undefined = scope === "all" ? undefined : scope === "self" ? { field: "kind", op: "eq", value: "self" } : scope === "assigned" ? { field: "kind", op: "eq", value: "assigned" } : scope === "unassigned" ? { field: "assignees", op: "empty" } : { field: "assignees", op: "eq", value: scope };

  const widgets: Record<Exclude<View, "worklog">, Widget> = {
    workload: { id: "tasks_workload", type: "workload", title: "Workload", width: 4 },
    board: { id: "tasks_board", type: "kanban", title: "Board", width: 4, filter },
    list: { id: "tasks_list", type: "taskList", title: "List", width: 4, filter, showCompleted: true, limit: 50 },
    table: { id: "tasks_table", type: "table", title: "Table", width: 4, source: "tasks", columns: ["title", "status", "priority", "assignees", "dueDate", "kind", ...config.taskFields.map((f) => f.id)].slice(0, 10), pageSize: 15, filter },
    calendar: { id: "tasks_cal", type: "calendar", title: "Calendar", width: 4, source: "tasks", dateField: "dueDate", titleField: "title" },
  };
  const tabs: { id: View; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: "board", label: "Board", icon: KanbanSquare },
    { id: "list", label: "List", icon: ListChecks },
    { id: "table", label: "Table", icon: Table2 },
    { id: "calendar", label: "Calendar", icon: CalendarDays },
    { id: "workload", label: "Workload", icon: Gauge },
    { id: "worklog", label: "Self-reported work", icon: ClipboardList },
  ];
  const doneIds = new Set(config.taskStatuses.filter((s) => s.isDone).map((s) => s.id));
  const done = workspace.data.tasks.filter((t) => doneIds.has(t.status)).length;
  const total = workspace.data.tasks.length;

  return (
    <div className="mx-auto max-w-[1600px] space-y-5 px-4 py-6 sm:px-6">
      <PageHeader
        title="Tasks & work log"
        description={`${total} tasks · ${done} completed (${total ? Math.round((done / total) * 100) : 0}%) · ${workspace.data.worklogs.length} work-log entries`}
        actions={<Button size="sm" onClick={() => newTask()}><Plus /> New task</Button>}
      />
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1 overflow-x-auto rounded-lg bg-muted p-1 scrollbar-thin">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setView(id)} className={cn("flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-sm", view === id ? "bg-card font-medium shadow-xs" : "text-muted-foreground hover:text-foreground")}>
              <Icon className="size-4" /> {label}
            </button>
          ))}
        </div>
        {view !== "worklog" && view !== "calendar" && view !== "workload" && (
          <NativeSelect value={scope} onChange={(e) => setScope(e.target.value)} className="ml-auto w-56" aria-label="Filter tasks">
            <option value="all">All tasks</option>
            <option value="assigned">Assigned work</option>
            <option value="self">Self-reported work</option>
            <option value="unassigned">Unassigned</option>
            <optgroup label="Assignee">
              {config.team.members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </optgroup>
          </NativeSelect>
        )}
      </div>
      {view !== "worklog" && (
        <SavedViews workspace={workspace} activeId={current?.id ?? null} onSelect={setSaved} />
      )}
      {current && view !== "worklog" && (
        <p className="text-xs text-muted-foreground">
          Showing {viewWs.data.tasks.length} of {workspace.data.tasks.length} tasks · {describeQuery(current.query, config).join(" · ")}
        </p>
      )}
      {view === "worklog" ? (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
          <Card className="min-w-0 space-y-3 p-4">
            <div>
              <h3 className="text-sm font-semibold">Tell the AI what you did today</h3>
              <p className="text-xs text-muted-foreground">Write naturally in any language — AI splits it into separate entries you can review before saving.</p>
            </div>
            <WorklogComposer workspace={workspace} showSamples />
          </Card>
          <Card className="min-w-0 p-4">
            <h3 className="mb-3 text-sm font-semibold">Work log</h3>
            <RenderWidget widget={{ id: "wl_table", type: "table", title: "Work log", width: 4, source: "worklogs", columns: ["date", "memberId", "description", "category", "hours", "status"], pageSize: 12 }} />
          </Card>
        </div>
      ) : (
        <Card className="min-w-0 p-4">
          <WorkspaceEnv workspace={viewWs}>
            <RenderWidget widget={widgets[view]} />
          </WorkspaceEnv>
        </Card>
      )}
    </div>
  );
}

export default function TasksPage() {
  return (
    <RequireWorkspace>
      {(ws: Workspace) => (
        <WorkspaceEnv key={ws.id} workspace={ws}>
          <TasksInner />
        </WorkspaceEnv>
      )}
    </RequireWorkspace>
  );
}
