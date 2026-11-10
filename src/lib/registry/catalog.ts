/**
 * Component registry catalog (framework-agnostic metadata).
 * The React implementation lives in `components/dashboard/widget-registry.tsx`;
 * this file is importable from server code (AI pipeline) and client code alike.
 */
import type { Widget, WidgetType, WorkspaceConfig } from "../config/types";
import { defaultDateField, getSource, listSources } from "../engine/sources";
import { uid } from "../utils";

export type SourceKind = "any" | "tasks" | "collection" | "none";

export interface CatalogEntry {
  type: WidgetType;
  label: string;
  description: string;
  category: "Data" | "Tasks" | "Charts" | "Input" | "Other";
  defaultWidth: number;
  sourceKind: SourceKind;
  /** Types this widget can be switched to in-place (view switcher). */
  alternates?: WidgetType[];
}

export const CATALOG: Record<WidgetType, CatalogEntry> = {
  metric: { type: "metric", label: "Metric card", description: "A single KPI number (count / sum / average).", category: "Data", defaultWidth: 1, sourceKind: "any" },
  table: { type: "table", label: "Data table", description: "Searchable, sortable table with add/edit/delete.", category: "Data", defaultWidth: 4, sourceKind: "any", alternates: ["kanban", "taskList", "calendar"] },
  kanban: { type: "kanban", label: "Kanban board", description: "Drag-and-drop task board grouped by status.", category: "Tasks", defaultWidth: 4, sourceKind: "tasks", alternates: ["taskList", "table", "calendar"] },
  taskList: { type: "taskList", label: "Task list", description: "Checklist of tasks with quick complete.", category: "Tasks", defaultWidth: 2, sourceKind: "tasks", alternates: ["kanban", "table", "calendar"] },
  form: { type: "form", label: "Custom form", description: "Data-entry form that saves into a collection.", category: "Input", defaultWidth: 2, sourceKind: "collection" },
  barChart: { type: "barChart", label: "Bar chart", description: "Compare values across categories.", category: "Charts", defaultWidth: 2, sourceKind: "any", alternates: ["pieChart", "lineChart"] },
  lineChart: { type: "lineChart", label: "Line chart", description: "Trend over time (daily / weekly / monthly).", category: "Charts", defaultWidth: 2, sourceKind: "any", alternates: ["barChart", "pieChart"] },
  pieChart: { type: "pieChart", label: "Pie chart", description: "Share of total by category.", category: "Charts", defaultWidth: 2, sourceKind: "any", alternates: ["barChart", "lineChart"] },
  calendar: { type: "calendar", label: "Calendar", description: "Month view of dated items.", category: "Data", defaultWidth: 4, sourceKind: "any", alternates: ["table"] },
  activity: { type: "activity", label: "Activity feed", description: "Latest changes in this workspace.", category: "Other", defaultWidth: 2, sourceKind: "none" },
  progress: { type: "progress", label: "Progress indicator", description: "Completion %, target progress or per-member progress.", category: "Data", defaultWidth: 2, sourceKind: "any" },
  attachments: { type: "attachments", label: "Files & links", description: "Shared links and file references.", category: "Other", defaultWidth: 2, sourceKind: "none" },
  workload: { type: "workload", label: "Team workload", description: "Each person's open work, late and at-risk deadlines, and logged hours.", category: "Tasks", defaultWidth: 2, sourceKind: "none" },
  worklog: { type: "worklog", label: "Daily work report", description: "Natural-language self-reporting with AI extraction.", category: "Input", defaultWidth: 2, sourceKind: "none" },
};

export const WIDGET_TYPES = Object.keys(CATALOG) as WidgetType[];

/** Build a sensible default widget for the "Add widget" dialog. */
export function createDefaultWidget(type: WidgetType, config: WorkspaceConfig, sourceId?: string): Widget {
  const entry = CATALOG[type];
  const base = { id: uid("w").toLowerCase().replace(/[^a-z0-9_]/g, "_"), title: entry.label, width: entry.defaultWidth };
  const firstCollection = config.collections[0]?.id;
  const src = sourceId ?? (entry.sourceKind === "collection" ? firstCollection : "tasks") ?? "tasks";
  const source = getSource(config, src) ?? getSource(config, "tasks")!;
  const groupField =
    source.id === "tasks"
      ? "status"
      : source.fields.find((f) => f.type === "select" || f.type === "member")?.id ?? source.fields[0].id;
  switch (type) {
    case "metric":
      return { ...base, type, source: source.id, aggregate: "count" };
    case "table":
      return { ...base, type, source: source.id, columns: source.fields.slice(0, 5).map((f) => f.id), pageSize: 8 };
    case "kanban":
      return { ...base, type };
    case "taskList":
      return { ...base, type, showCompleted: false, limit: 8 };
    case "form":
      return { ...base, type, collectionId: config.collections.some((c) => c.id === sourceId) ? sourceId! : firstCollection ?? "" };
    case "barChart":
      return { ...base, type, source: source.id, groupBy: groupField, aggregate: "count" };
    case "pieChart":
      return { ...base, type, source: source.id, groupBy: groupField, aggregate: "count" };
    case "lineChart":
      return { ...base, type, source: source.id, dateField: defaultDateField(source), dateBucket: "day", aggregate: "count", periods: 14 };
    case "calendar":
      return {
        ...base,
        type,
        source: source.id,
        dateField: source.id === "tasks" ? "dueDate" : defaultDateField(source),
        titleField: source.fields.find((f) => f.type === "text")?.id ?? source.fields[0].id,
      };
    case "activity":
      return { ...base, type, limit: 10 };
    case "progress":
      return { ...base, type, source: source.id, mode: source.id === "tasks" ? "completion" : "target", target: 100 };
    case "attachments":
      return { ...base, type };
    case "worklog":
      return { ...base, type, showRecent: 5 };
    case "workload":
      return { ...base, type };
  }
}

/** Convert a widget to an alternate view while keeping id/title/width. */
export function convertWidget(widget: Widget, to: WidgetType, config: WorkspaceConfig): Widget {
  const source = "source" in widget ? widget.source : "tasks";
  const next = createDefaultWidget(to, config, CATALOG[to].sourceKind === "tasks" ? "tasks" : source);
  const merged = { ...next, id: widget.id, title: widget.title, width: to === "kanban" || to === "calendar" || to === "table" ? Math.max(widget.width, 3) : widget.width } as Widget;
  if ("groupBy" in widget && "groupBy" in merged) (merged as { groupBy: string }).groupBy = widget.groupBy;
  if ("filter" in widget && widget.filter && "filter" in next) (merged as { filter?: unknown }).filter = widget.filter;
  return merged;
}

export function sourceOptions(config: WorkspaceConfig, kind: SourceKind) {
  const all = listSources(config);
  if (kind === "tasks") return all.filter((s) => s.kind === "tasks");
  if (kind === "collection") return all.filter((s) => s.kind === "collection");
  if (kind === "none") return [];
  return all;
}

/** Compact registry description injected into the AI system prompt. */
export function catalogForPrompt(): string {
  return WIDGET_TYPES.map((t) => `- ${t}: ${CATALOG[t].description}`).join("\n");
}
