/**
 * One short line per task ("#3 title — people — due date — status") so the AI knows what already
 * exists. The AI changes a task by its #number, which maps back to `tasks[number - 1]`.
 */
import type { Task, WorkspaceConfig } from "../config/types";

export const TASK_LINE_MAX = 60;

export function taskLines(tasks: Task[], config: WorkspaceConfig, max = TASK_LINE_MAX): string[] {
  const name = (id: string) => config.team.members.find((m) => m.id === id)?.name ?? id;
  const status = (id: string) => config.taskStatuses.find((s) => s.id === id)?.label ?? id;
  return tasks.slice(0, max).map((t, i) =>
    [`#${i + 1} ${t.title}`, t.assigneeIds.length ? t.assigneeIds.map(name).join(", ") : "unassigned", t.dueDate ? `due ${t.dueDate}` : null, status(t.status)].filter(Boolean).join(" — ").slice(0, 300),
  );
}
