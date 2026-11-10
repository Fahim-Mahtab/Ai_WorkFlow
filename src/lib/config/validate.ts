/**
 * Validation pipeline for any workspace config (AI output or manual JSON edits):
 *   1. normalize  – repair common AI mistakes (ids, widths, aliases, defaults)
 *   2. Zod        – strict structural validation
 *   3. registry   – every widget type exists and every reference
 *                   (source, field, collection, status, member) resolves
 */
import { workspaceConfigSchema, ID_RE, PAGE_ICONS, RESERVED_SOURCES } from "./schema";
import type { Widget, WorkspaceConfig } from "./types";
import { CATALOG } from "../registry/catalog";
import { defaultDateField, getSource } from "../engine/sources";
import { slugify } from "../utils";

export interface ValidationResult {
  ok: boolean;
  config?: WorkspaceConfig;
  errors: string[];
  warnings: string[];
}

type AnyObj = Record<string, unknown>;
const isObj = (v: unknown): v is AnyObj => typeof v === "object" && v !== null && !Array.isArray(v);
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const str = (v: unknown, d = ""): string => (typeof v === "string" ? v : typeof v === "number" ? String(v) : d);

const TYPE_ALIASES: Record<string, string> = {
  bar: "barChart", bar_chart: "barChart", barchart: "barChart",
  line: "lineChart", line_chart: "lineChart", linechart: "lineChart",
  pie: "pieChart", pie_chart: "pieChart", piechart: "pieChart", donut: "pieChart",
  card: "metric", kpi: "metric", stat: "metric", metric_card: "metric",
  datatable: "table", data_table: "table",
  board: "kanban", kanban_board: "kanban",
  tasks: "taskList", task_list: "taskList", tasklist: "taskList", checklist: "taskList",
  activity_feed: "activity", feed: "activity",
  progress_bar: "progress", progressbar: "progress",
  files: "attachments", links: "attachments",
  daily_report: "worklog", work_log: "worklog", worklogs: "worklog",
};

const WIDTHS: Record<string, number> = { full: 4, wide: 3, large: 3, half: 2, medium: 2, small: 1, quarter: 1 };
const COLORS = ["slate", "blue", "amber", "violet", "green", "red", "pink", "cyan", "orange"];

function safeId(v: unknown, fallback: string, used: Set<string>): string {
  let id = str(v);
  if (!ID_RE.test(id)) id = slugify(id || fallback, fallback);
  if (!ID_RE.test(id)) id = slugify(fallback, "x");
  let unique = id;
  let n = 2;
  while (used.has(unique)) unique = `${id}_${n++}`;
  used.add(unique);
  return unique;
}

function normalizeField(f: unknown, i: number, used: Set<string>) {
  const o = isObj(f) ? f : { label: str(f) };
  const label = str(o.label) || str(o.name) || str(o.id) || `Field ${i + 1}`;
  let type = str(o.type, "text").toLowerCase();
  const typeMap: Record<string, string> = { string: "text", tel: "phone", mobile: "phone", int: "number", integer: "number", boolean: "checkbox", bool: "checkbox", dropdown: "select", enum: "select", long_text: "textarea", multiline: "textarea", user: "member", employee: "member", datetime: "date", link: "url" };
  type = typeMap[type] ?? type;
  const valid = ["text", "textarea", "number", "date", "select", "multiselect", "email", "phone", "url", "checkbox", "member"];
  if (!valid.includes(type)) type = "text";
  const options = arr(o.options).map((x) => (isObj(x) ? str(x.label) || str(x.value) : str(x))).filter(Boolean);
  if ((type === "select" || type === "multiselect") && options.length === 0) type = "text";
  return {
    id: safeId(o.id ?? label, `field_${i + 1}`, used),
    label: label.slice(0, 80),
    type,
    ...(o.required ? { required: true } : {}),
    ...(options.length ? { options: options.slice(0, 30).map((x) => x.slice(0, 60)) } : {}),
    ...(str(o.placeholder) ? { placeholder: str(o.placeholder).slice(0, 120) } : {}),
    ...(str(o.helpText) ? { helpText: str(o.helpText).slice(0, 200) } : {}),
  };
}

export function normalizeConfig(raw: unknown): unknown {
  if (!isObj(raw)) return raw;
  const c: AnyObj = { ...raw };
  c.version = 1;
  c.name = str(c.name, "Workspace").slice(0, 80);
  if (c.description !== undefined) c.description = str(c.description).slice(0, 400);
  if (!["bn", "en", "banglish"].includes(str(c.language))) c.language = "en";

  // team
  const team = isObj(c.team) ? c.team : {};
  const roleIds = new Set<string>();
  let roles = arr(team.roles).map((r, i) => {
    const o = isObj(r) ? r : { name: str(r) };
    const name = str(o.name) || str(o.label) || `Role ${i + 1}`;
    return { id: safeId(o.id ?? name, `role_${i + 1}`, roleIds), name: name.slice(0, 60), ...(str(o.description) ? { description: str(o.description).slice(0, 200) } : {}) };
  });
  if (roles.length === 0) roles = [{ id: safeId("member", "member", roleIds), name: "Member" }];
  const memberIds = new Set<string>();
  const members = arr(team.members).slice(0, 100).map((m, i) => {
    const o = isObj(m) ? m : { name: str(m) };
    const name = str(o.name) || `Member ${i + 1}`;
    let roleId = str(o.roleId ?? o.role);
    if (!roles.some((r) => r.id === roleId)) {
      const byName = roles.find((r) => r.name.toLowerCase() === roleId.toLowerCase());
      roleId = byName?.id ?? roles[roles.length - 1].id;
    }
    return { id: safeId(o.id ?? `m${i + 1}`, `m${i + 1}`, memberIds), name: name.slice(0, 60), roleId };
  });
  c.team = { roles, members };

  // statuses
  const statusIds = new Set<string>();
  let statuses = arr(c.taskStatuses).map((s, i) => {
    const o = isObj(s) ? s : { label: str(s) };
    const label = str(o.label) || str(o.name) || `Status ${i + 1}`;
    return {
      id: safeId(o.id ?? label, `status_${i + 1}`, statusIds),
      label: label.slice(0, 40),
      color: COLORS.includes(str(o.color)) ? str(o.color) : COLORS[i % COLORS.length],
      ...(o.isDone ? { isDone: true } : {}),
    };
  });
  if (statuses.length < 2) {
    statuses = [
      { id: "todo", label: "To Do", color: "slate" },
      { id: "in_progress", label: "In Progress", color: "blue" },
      { id: "done", label: "Done", color: "green", isDone: true },
    ];
  }
  if (!statuses.some((s) => s.isDone)) {
    const doneLike = statuses.find((s) => /done|complete|closed|deployed|approved|সম্পন্ন|শেষ/i.test(s.id + s.label));
    (doneLike ?? statuses[statuses.length - 1]).isDone = true;
  }
  c.taskStatuses = statuses.slice(0, 10);

  // priorities
  const pr = arr(c.priorities).filter((p) => isObj(p) && ["low", "medium", "high", "urgent"].includes(str(p.id)));
  c.priorities = pr.length
    ? pr.map((p) => ({ id: str((p as AnyObj).id), label: str((p as AnyObj).label, str((p as AnyObj).id)).slice(0, 30) }))
    : [
        { id: "low", label: "Low" },
        { id: "medium", label: "Medium" },
        { id: "high", label: "High" },
        { id: "urgent", label: "Urgent" },
      ];

  const taskFieldIds = new Set<string>(["title", "status", "priority", "assignees", "dueDate", "createdAt", "completedAt", "kind", "description"]);
  c.taskFields = arr(c.taskFields).slice(0, 15).map((f, i) => normalizeField(f, i, taskFieldIds));

  const colIds = new Set<string>(RESERVED_SOURCES);
  c.collections = arr(c.collections).slice(0, 10).map((col, i) => {
    const o = isObj(col) ? col : {};
    const name = str(o.name) || str(o.title) || `Collection ${i + 1}`;
    const fIds = new Set<string>(["id", "createdAt", "createdBy"]);
    let fields = arr(o.fields).slice(0, 30).map((f, j) => normalizeField(f, j, fIds));
    if (fields.length === 0) fields = [{ id: "name", label: "Name", type: "text" }];
    return { id: safeId(o.id ?? name, `collection_${i + 1}`, colIds), name: name.slice(0, 80), ...(str(o.description) ? { description: str(o.description).slice(0, 300) } : {}), fields };
  });

  // pages & widgets
  const pageIds = new Set<string>();
  const widgetIds = new Set<string>();
  let pages = arr(c.pages).slice(0, 12).map((p, i) => {
    const o = isObj(p) ? p : {};
    const title = str(o.title) || str(o.name) || `Page ${i + 1}`;
    const icon = PAGE_ICONS.includes(str(o.icon) as (typeof PAGE_ICONS)[number]) ? str(o.icon) : undefined;
    const widgets = arr(o.widgets).slice(0, 40).map((w) => {
      if (!isObj(w)) return null;
      let type = str(w.type);
      if (!(type in CATALOG)) type = TYPE_ALIASES[type.toLowerCase()] ?? type;
      if (!(type in CATALOG)) return { __unknown: str(w.type) };
      let width: number = typeof w.width === "number" ? w.width : WIDTHS[str(w.width).toLowerCase()] ?? Number(str(w.width));
      if (!Number.isFinite(width)) width = CATALOG[type as keyof typeof CATALOG].defaultWidth;
      width = Math.max(1, Math.min(4, Math.round(width)));
      const title = str(w.title) || CATALOG[type as keyof typeof CATALOG].label;
      const out: AnyObj = { ...w, type, width, title: title.slice(0, 80), id: safeId(w.id ?? title, "widget", widgetIds) };
      if (out.columns && Array.isArray(out.columns)) out.columns = (out.columns as unknown[]).map((x) => (isObj(x) ? str(x.field ?? x.id) : str(x))).filter(Boolean);
      for (const k of ["filter", "description", "field", "valueField", "dateRange", "target", "color", "dateBucket", "submitLabel", "successMessage"]) {
        if (out[k] === null || out[k] === "") delete out[k];
      }
      if (typeof out.target === "string") out.target = Number(out.target) || undefined;
      return out;
    });
    return { id: safeId(o.id ?? title, `page_${i + 1}`, pageIds), title: title.slice(0, 60), ...(icon ? { icon } : {}), widgets };
  });
  if (pages.length === 0) pages = [{ id: "dashboard", title: "Dashboard", widgets: [] }];
  c.pages = pages;

  if (c.reports !== undefined) c.reports = arr(c.reports).map((r) => str(r).slice(0, 160)).filter(Boolean).slice(0, 12);
  if (c.seed !== undefined && !isObj(c.seed)) delete c.seed;
  return c;
}

/** Reference checks + auto-fixes that need the whole config. */
function resolveReferences(config: WorkspaceConfig, warnings: string[]): WorkspaceConfig {
  const pages = config.pages.map((page) => {
    const widgets: Widget[] = [];
    for (const w of page.widgets) {
      const fixed = fixWidget(config, w, warnings);
      if (fixed) widgets.push(fixed);
    }
    return { ...page, widgets };
  });

  // seed references
  let seed = config.seed;
  if (seed) {
    const statusIds = config.taskStatuses.map((s) => s.id);
    const memberIds = config.team.members.map((m) => m.id);
    const tasks = seed.tasks?.map((t) => ({
      ...t,
      status: statusIds.includes(t.status) ? t.status : config.taskStatuses.find((s) => s.label === t.status)?.id ?? statusIds[0],
      // models sometimes use the person's name instead of their id
      assigneeIds: t.assigneeIds
        ?.map((a) => (memberIds.includes(a) ? a : config.team.members.find((m) => m.name.toLowerCase() === a.toLowerCase())?.id))
        .filter((a): a is string => !!a),
    }));
    const records = seed.records
      ? Object.fromEntries(Object.entries(seed.records).filter(([k]) => config.collections.some((c) => c.id === k)))
      : undefined;
    seed = { ...(tasks ? { tasks } : {}), ...(records ? { records } : {}) };
  }
  return { ...config, pages, ...(seed ? { seed } : {}) };
}

function fixWidget(config: WorkspaceConfig, w: Widget, warnings: string[]): Widget | null {
  const where = `widget "${w.title}" (${w.type})`;
  if (w.type === "form") {
    if (!config.collections.some((c) => c.id === w.collectionId)) {
      const byName = config.collections.find((c) => c.name === w.collectionId);
      if (byName) return { ...w, collectionId: byName.id };
      warnings.push(`${where}: unknown collection "${w.collectionId}" — removed`);
      return null;
    }
    return w;
  }
  if (!("source" in w)) {
    if ((w.type === "kanban" || w.type === "taskList") && w.filter && !getSource(config, "tasks")!.fields.some((f) => f.id === w.filter!.field)) {
      const { filter: _drop, ...rest } = w;
      void _drop;
      return rest as Widget;
    }
    return w;
  }
  const source = getSource(config, w.source) ?? config.collections.map((c) => getSource(config, c.id)!).find((s) => s.label === w.source);
  if (!source) {
    warnings.push(`${where}: unknown source "${w.source}" — removed`);
    return null;
  }
  const fieldIds = source.fields.map((f) => f.id);
  const has = (id?: string) => !!id && fieldIds.includes(id);
  const next = { ...w, source: source.id } as Widget & AnyObj;
  if ("filter" in next && next.filter && !has((next.filter as { field: string }).field)) {
    warnings.push(`${where}: filter field "${(next.filter as { field: string }).field}" not found — filter dropped`);
    delete next.filter;
  }
  const numberField = source.fields.find((f) => f.type === "number")?.id;
  const categorical = source.id === "tasks" ? "status" : source.fields.find((f) => f.type === "select" || f.type === "member")?.id ?? source.fields[0].id;
  switch (next.type) {
    case "metric":
      if (next.aggregate !== "count" && !has(next.field)) {
        if (numberField) next.field = numberField;
        else next.aggregate = "count";
      }
      break;
    case "table": {
      const cols = next.columns.filter((c) => has(c));
      next.columns = cols.length ? cols : fieldIds.slice(0, 5);
      break;
    }
    case "barChart":
    case "pieChart":
      if (!has(next.groupBy)) {
        warnings.push(`${where}: groupBy "${next.groupBy}" not found — using "${categorical}"`);
        next.groupBy = categorical;
      }
      if (next.aggregate !== "count" && !has(next.valueField)) next.aggregate = "count";
      break;
    case "lineChart":
      if (!has(next.dateField) || source.fields.find((f) => f.id === next.dateField)?.type !== "date") next.dateField = defaultDateField(source);
      if (next.aggregate !== "count" && !has(next.valueField)) next.aggregate = "count";
      break;
    case "calendar":
      if (!has(next.dateField)) next.dateField = source.id === "tasks" ? "dueDate" : defaultDateField(source);
      if (!has(next.titleField)) next.titleField = source.fields.find((f) => f.type === "text")?.id ?? fieldIds[0];
      break;
    case "progress":
      if (next.mode === "completion" && source.id !== "tasks") next.mode = "target";
      if (next.mode === "target" && !next.target) next.target = 100;
      break;
  }
  return next as Widget;
}

export function validateConfig(raw: unknown): ValidationResult {
  const warnings: string[] = [];
  const normalized = normalizeConfig(raw);
  if (isObj(normalized)) {
    for (const p of arr(normalized.pages)) {
      if (!isObj(p)) continue;
      const kept: unknown[] = [];
      for (const w of arr(p.widgets)) {
        if (w === null) continue;
        if (isObj(w) && "__unknown" in w) {
          warnings.push(`Unknown component type "${str(w.__unknown)}" is not in the registry — removed`);
          continue;
        }
        kept.push(w);
      }
      p.widgets = kept;
    }
  }
  const parsed = workspaceConfigSchema.safeParse(normalized);
  if (!parsed.success) {
    const errors = parsed.error.issues.slice(0, 25).map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`);
    return { ok: false, errors, warnings };
  }
  const config = resolveReferences(parsed.data, warnings);
  return { ok: true, config, errors: [], warnings };
}
