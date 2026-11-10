/**
 * Tiny declarative query engine used by metric/chart/progress widgets.
 * Everything is driven by JSON config — no user code is ever evaluated.
 */
import type {
  Aggregate,
  DateBucket,
  DateRange,
  FieldDef,
  FieldValue,
  Filter,
  FlatRow,
  WorkspaceConfig,
} from "../config/types";
import { addDays, todayISO } from "../utils";

export function applyFilter(rows: FlatRow[], filter?: Filter): FlatRow[] {
  if (!filter) return rows;
  const { field, op, value } = filter;
  return rows.filter((r) => {
    const v = r[field];
    const arr = Array.isArray(v) ? v : [v];
    switch (op) {
      case "eq":
        return arr.some((x) => String(x ?? "") === String(value ?? ""));
      case "neq":
        return !arr.some((x) => String(x ?? "") === String(value ?? ""));
      case "contains":
        return arr.some((x) => String(x ?? "").toLowerCase().includes(String(value ?? "").toLowerCase()));
      case "empty":
        return v === undefined || v === null || v === "" || (Array.isArray(v) && v.length === 0);
      case "notEmpty":
        return !(v === undefined || v === null || v === "" || (Array.isArray(v) && v.length === 0));
      case "gt":
      case "lt": {
        // dates (YYYY-MM-DD, or the word "today") compare as dates; everything else as numbers
        const target = value === "today" ? todayISO() : value;
        const isDate = (x: unknown) => typeof x === "string" && /^\d{4}-\d{2}-\d{2}/.test(x);
        if (isDate(target)) {
          if (!isDate(v)) return false;
          const a = String(v).slice(0, 10);
          return op === "gt" ? a > String(target) : a < String(target);
        }
        if (v === undefined || v === null || v === "") return false;
        return op === "gt" ? Number(v) > Number(target) : Number(v) < Number(target);
      }
      default:
        return true;
    }
  });
}

export function applyDateRange(rows: FlatRow[], range: DateRange | undefined, dateField: string): FlatRow[] {
  if (!range || range === "all") return rows;
  const today = todayISO();
  const from = range === "today" ? today : range === "week" ? addDays(today, -6) : addDays(today, -29);
  return rows.filter((r) => {
    const d = String(r[dateField] ?? "").slice(0, 10);
    return d >= from && d <= today;
  });
}

export function aggregate(rows: FlatRow[], agg: Aggregate, valueField?: string): number {
  if (agg === "count" || !valueField) return rows.length;
  const nums = rows.map((r) => Number(r[valueField])).filter((n) => Number.isFinite(n));
  if (nums.length === 0) return 0;
  const sum = nums.reduce((a, b) => a + b, 0);
  return agg === "sum" ? sum : sum / nums.length;
}

export function bucketKey(iso: string, bucket: DateBucket): string {
  const d = String(iso).slice(0, 10);
  if (!d) return "";
  if (bucket === "day") return d;
  if (bucket === "month") return d.slice(0, 7);
  // ISO week start (Monday)
  const date = new Date(d + "T00:00:00");
  const day = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - day);
  return todayISO(date);
}

/** Generate the last N bucket keys ending today (for continuous line charts). */
export function lastBuckets(bucket: DateBucket, n: number): string[] {
  const out: string[] = [];
  const today = new Date(todayISO() + "T00:00:00");
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(today);
    if (bucket === "day") d.setDate(d.getDate() - i);
    if (bucket === "week") d.setDate(d.getDate() - i * 7);
    if (bucket === "month") d.setMonth(d.getMonth() - i, 1);
    out.push(bucketKey(todayISO(d), bucket));
  }
  return Array.from(new Set(out));
}

export function formatBucket(key: string, bucket: DateBucket): string {
  if (!key) return "—";
  const d = new Date((bucket === "month" ? key + "-01" : key) + "T00:00:00");
  if (bucket === "month") return d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/** Human label for a raw value of a field (status id → label, member id → name…). */
export function valueLabel(
  config: WorkspaceConfig,
  field: FieldDef | undefined,
  value: FieldValue,
  sourceId?: string,
): string {
  if (value === undefined || value === null || value === "") return "—";
  if (Array.isArray(value)) return value.map((v) => valueLabel(config, field, v, sourceId)).join(", ");
  if (field?.type === "member") {
    return config.team.members.find((m) => m.id === value)?.name ?? String(value);
  }
  if (field?.type === "checkbox") return value ? "✓" : "✗";
  if (sourceId === "tasks" && field?.id === "status") {
    return config.taskStatuses.find((s) => s.id === value)?.label ?? String(value);
  }
  if (sourceId === "tasks" && field?.id === "priority") {
    return config.priorities.find((p) => p.id === value)?.label ?? String(value);
  }
  return String(value);
}

export interface Datum {
  key: string;
  label: string;
  value: number;
}

export function groupRows(
  config: WorkspaceConfig,
  rows: FlatRow[],
  field: FieldDef | undefined,
  agg: Aggregate,
  valueField?: string,
  bucket?: DateBucket,
  sourceId?: string,
): Datum[] {
  if (!field) return [];
  const groups = new Map<string, FlatRow[]>();
  for (const r of rows) {
    const raw = r[field.id];
    let keys: string[];
    if (field.type === "date") keys = [bucketKey(String(raw ?? ""), bucket ?? "day")];
    else if (Array.isArray(raw)) keys = raw.length ? raw.map(String) : [""];
    else keys = [raw === undefined || raw === null ? "" : String(raw)];
    for (const k of keys) {
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k)!.push(r);
    }
  }
  // Keep the configured order for statuses/options so charts look stable.
  let order: string[] = [];
  if (sourceId === "tasks" && field.id === "status") order = config.taskStatuses.map((s) => s.id);
  else if (sourceId === "tasks" && field.id === "priority") order = config.priorities.map((p) => p.id);
  else if (field.options?.length) order = field.options;
  else if (field.type === "member") order = config.team.members.map((m) => m.id);

  const keys = Array.from(groups.keys());
  if (field.type === "date") keys.sort();
  else
    keys.sort((a, b) => {
      const ia = order.indexOf(a);
      const ib = order.indexOf(b);
      if (ia !== -1 || ib !== -1) return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
      return (groups.get(b)!.length ?? 0) - (groups.get(a)!.length ?? 0);
    });

  return keys.map((k) => ({
    key: k,
    label: field.type === "date" ? formatBucket(k, bucket ?? "day") : valueLabel(config, field, k || undefined, sourceId),
    value: aggregate(groups.get(k)!, agg, valueField),
  }));
}
