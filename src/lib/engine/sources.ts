/**
 * Data sources: "tasks", "worklogs" and every user collection.
 * Exposes a uniform field schema + flat rows so every widget (table, chart,
 * metric, calendar…) can work against any source without custom code.
 */
import type {
  FieldDef,
  FlatRow,
  Language,
  Workspace,
  WorkspaceConfig,
} from "../config/types";
import { t } from "../i18n";

export interface SourceInfo {
  id: string;
  label: string;
  kind: "tasks" | "worklogs" | "collection";
  fields: FieldDef[];
}

export function taskFields(config: WorkspaceConfig): FieldDef[] {
  const L = config.language;
  return [
    { id: "title", label: t(L, "title"), type: "text" },
    { id: "status", label: t(L, "status"), type: "select", options: config.taskStatuses.map((s) => s.id) },
    { id: "priority", label: t(L, "priority"), type: "select", options: config.priorities.map((p) => p.id) },
    { id: "assignees", label: t(L, "assignees"), type: "member" },
    { id: "dueDate", label: t(L, "dueDate"), type: "date" },
    { id: "createdAt", label: t(L, "createdAt"), type: "date" },
    { id: "completedAt", label: t(L, "completedAt"), type: "date" },
    { id: "kind", label: t(L, "kind"), type: "select", options: ["assigned", "self"] },
    ...config.taskFields,
  ];
}

export function worklogFields(lang: Language): FieldDef[] {
  return [
    { id: "date", label: t(lang, "date"), type: "date" },
    { id: "memberId", label: t(lang, "member"), type: "member" },
    { id: "description", label: t(lang, "description"), type: "text" },
    { id: "category", label: t(lang, "category"), type: "text" },
    { id: "hours", label: t(lang, "hours"), type: "number" },
    { id: "status", label: t(lang, "status"), type: "select", options: ["done", "in_progress"] },
    { id: "createdAt", label: t(lang, "createdAt"), type: "date" },
  ];
}

export function listSources(config: WorkspaceConfig): SourceInfo[] {
  const L = config.language;
  return [
    { id: "tasks", label: L === "bn" ? "কাজসমূহ" : "Tasks", kind: "tasks", fields: taskFields(config) },
    { id: "worklogs", label: L === "bn" ? "দৈনিক কাজের লগ" : "Work logs", kind: "worklogs", fields: worklogFields(L) },
    ...config.collections.map<SourceInfo>((c) => ({
      id: c.id,
      label: c.name,
      kind: "collection",
      fields: [
        ...c.fields,
        { id: "createdAt", label: t(L, "createdAt"), type: "date" },
        { id: "createdBy", label: t(L, "createdBy"), type: "member" },
      ],
    })),
  ];
}

export function getSource(config: WorkspaceConfig, id: string): SourceInfo | undefined {
  return listSources(config).find((s) => s.id === id);
}

export function getRows(ws: Workspace, sourceId: string): FlatRow[] {
  if (sourceId === "tasks") {
    return ws.data.tasks.map((task) => ({
      id: task.id,
      title: task.title,
      description: task.description,
      status: task.status,
      priority: task.priority,
      assignees: task.assigneeIds,
      dueDate: task.dueDate,
      createdAt: task.createdAt.slice(0, 10),
      completedAt: task.completedAt?.slice(0, 10),
      kind: task.kind,
      ...task.custom,
    }));
  }
  if (sourceId === "worklogs") {
    return ws.data.worklogs.map((w) => ({
      id: w.id,
      date: w.date,
      memberId: w.memberId,
      description: w.description,
      category: w.category,
      hours: w.hours,
      status: w.status,
      createdAt: w.createdAt.slice(0, 10),
    }));
  }
  return (ws.data.records[sourceId] ?? []).map((r) => ({
    ...r.values,
    id: r.id,
    createdAt: r.createdAt.slice(0, 10),
    createdBy: r.createdBy,
  }));
}

/** Best date field to use for time-based charts on a source. */
export function defaultDateField(source: SourceInfo): string {
  if (source.kind === "worklogs") return "date";
  const explicit = source.fields.find((f) => f.type === "date" && f.id !== "createdAt" && f.id !== "completedAt");
  if (source.kind === "collection" && explicit) return explicit.id;
  return "createdAt";
}
