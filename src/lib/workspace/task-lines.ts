/** One short line per task ("title — people — due date — status") so the AI knows what already exists. */
import type { Task, WorkspaceConfig } from "../config/types";

export function taskLines(tasks: Task[], config: WorkspaceConfig, max = 60): string[] {
  const name = (id: string) => config.team.members.find((m) => m.id === id)?.name ?? id;
  const status = (id: string) => config.taskStatuses.find((s) => s.id === id)?.label ?? id;
  return tasks.slice(0, max).map((t) =>
    [t.title, t.assigneeIds.length ? t.assigneeIds.map(name).join(", ") : "unassigned", t.dueDate ? `due ${t.dueDate}` : null, status(t.status)].filter(Boolean).join(" — ").slice(0, 300),
  );
}
