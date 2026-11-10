/**
 * Zod schemas for the AI-generated workspace configuration.
 *
 * The AI never produces code — only JSON that must pass these schemas.
 * Every widget `type` maps 1:1 to an entry in the component registry.
 */
import { z } from "zod";

export const ID_RE = /^[a-z0-9][a-z0-9_-]{0,47}$/;
export const idSchema = z.string().regex(ID_RE, "ids must be lowercase slug (a-z, 0-9, _ , -)");

export const RESERVED_SOURCES = ["tasks", "worklogs"] as const;

export const languageSchema = z.enum(["bn", "en", "banglish"]);

export const fieldTypeSchema = z.enum([
  "text",
  "textarea",
  "number",
  "date",
  "select",
  "multiselect",
  "email",
  "phone",
  "url",
  "checkbox",
  "member",
]);

export const fieldSchema = z.object({
  id: idSchema,
  label: z.string().min(1).max(80),
  type: fieldTypeSchema,
  required: z.boolean().optional(),
  options: z.array(z.string().min(1).max(60)).max(30).optional(),
  placeholder: z.string().max(120).optional(),
  helpText: z.string().max(200).optional(),
});

export const collectionSchema = z.object({
  id: idSchema.refine((v) => !(RESERVED_SOURCES as readonly string[]).includes(v), "reserved id"),
  name: z.string().min(1).max(80),
  description: z.string().max(300).optional(),
  fields: z.array(fieldSchema).min(1).max(30),
});

export const statusColorSchema = z.enum([
  "slate",
  "blue",
  "amber",
  "violet",
  "green",
  "red",
  "pink",
  "cyan",
  "orange",
]);

export const taskStatusSchema = z.object({
  id: idSchema,
  label: z.string().min(1).max(40),
  color: statusColorSchema,
  isDone: z.boolean().optional(),
});

export const priorityIdSchema = z.enum(["low", "medium", "high", "urgent"]);

export const prioritySchema = z.object({
  id: priorityIdSchema,
  label: z.string().min(1).max(30),
});

export const roleSchema = z.object({
  id: idSchema,
  name: z.string().min(1).max(60),
  description: z.string().max(200).optional(),
});

export const memberSchema = z.object({
  id: idSchema,
  name: z.string().min(1).max(60),
  roleId: idSchema,
});

export const filterSchema = z.object({
  field: z.string().min(1),
  op: z.enum(["eq", "neq", "contains", "empty", "notEmpty", "gt", "lt"]),
  value: z.union([z.string(), z.number(), z.boolean()]).optional(),
});

export const dateRangeSchema = z.enum(["today", "week", "month", "all"]);
export const aggregateSchema = z.enum(["count", "sum", "avg"]);
export const dateBucketSchema = z.enum(["day", "week", "month"]);

export const PAGE_ICONS = [
  "dashboard",
  "form",
  "tasks",
  "users",
  "chart",
  "calendar",
  "bug",
  "rocket",
  "clipboard",
  "kanban",
  "activity",
  "inbox",
  "target",
  "file",
  "review",
] as const;
export const pageIconSchema = z.enum(PAGE_ICONS);

const widgetBase = {
  id: idSchema,
  title: z.string().min(1).max(80),
  description: z.string().max(200).optional(),
  width: z.number().int().min(1).max(4),
};

export const metricWidgetSchema = z.object({
  ...widgetBase,
  type: z.literal("metric"),
  source: z.string(),
  aggregate: aggregateSchema,
  field: z.string().optional(),
  filter: filterSchema.optional(),
  dateRange: dateRangeSchema.optional(),
  target: z.number().positive().optional(),
  color: statusColorSchema.optional(),
});

export const tableWidgetSchema = z.object({
  ...widgetBase,
  type: z.literal("table"),
  source: z.string(),
  columns: z.array(z.string()).min(1).max(12),
  pageSize: z.number().int().min(3).max(50).optional(),
  filter: filterSchema.optional(),
});

export const kanbanWidgetSchema = z.object({
  ...widgetBase,
  type: z.literal("kanban"),
  filter: filterSchema.optional(),
});

export const taskListWidgetSchema = z.object({
  ...widgetBase,
  type: z.literal("taskList"),
  filter: filterSchema.optional(),
  showCompleted: z.boolean().optional(),
  limit: z.number().int().min(1).max(50).optional(),
});

export const formWidgetSchema = z.object({
  ...widgetBase,
  type: z.literal("form"),
  collectionId: z.string(),
  submitLabel: z.string().max(40).optional(),
  successMessage: z.string().max(120).optional(),
});

export const barChartWidgetSchema = z.object({
  ...widgetBase,
  type: z.literal("barChart"),
  source: z.string(),
  groupBy: z.string(),
  aggregate: aggregateSchema,
  valueField: z.string().optional(),
  dateBucket: dateBucketSchema.optional(),
  filter: filterSchema.optional(),
  dateRange: dateRangeSchema.optional(),
});

export const lineChartWidgetSchema = z.object({
  ...widgetBase,
  type: z.literal("lineChart"),
  source: z.string(),
  dateField: z.string(),
  dateBucket: dateBucketSchema,
  aggregate: aggregateSchema,
  valueField: z.string().optional(),
  filter: filterSchema.optional(),
  periods: z.number().int().min(3).max(60).optional(),
});

export const pieChartWidgetSchema = z.object({
  ...widgetBase,
  type: z.literal("pieChart"),
  source: z.string(),
  groupBy: z.string(),
  aggregate: aggregateSchema,
  valueField: z.string().optional(),
  filter: filterSchema.optional(),
});

export const calendarWidgetSchema = z.object({
  ...widgetBase,
  type: z.literal("calendar"),
  source: z.string(),
  dateField: z.string(),
  titleField: z.string(),
});

export const activityWidgetSchema = z.object({
  ...widgetBase,
  type: z.literal("activity"),
  limit: z.number().int().min(3).max(50).optional(),
});

export const progressWidgetSchema = z.object({
  ...widgetBase,
  type: z.literal("progress"),
  source: z.string(),
  mode: z.enum(["completion", "target", "byMember"]),
  target: z.number().positive().optional(),
  dateRange: dateRangeSchema.optional(),
});

export const attachmentsWidgetSchema = z.object({
  ...widgetBase,
  type: z.literal("attachments"),
});

export const worklogWidgetSchema = z.object({
  ...widgetBase,
  type: z.literal("worklog"),
  showRecent: z.number().int().min(0).max(30).optional(),
});

export const workloadWidgetSchema = z.object({
  ...widgetBase,
  type: z.literal("workload"),
});

export const widgetSchema = z.discriminatedUnion("type", [
  metricWidgetSchema,
  tableWidgetSchema,
  kanbanWidgetSchema,
  taskListWidgetSchema,
  formWidgetSchema,
  barChartWidgetSchema,
  lineChartWidgetSchema,
  pieChartWidgetSchema,
  calendarWidgetSchema,
  activityWidgetSchema,
  progressWidgetSchema,
  attachmentsWidgetSchema,
  worklogWidgetSchema,
  workloadWidgetSchema,
]);

export const pageSchema = z.object({
  id: idSchema,
  title: z.string().min(1).max(60),
  icon: pageIconSchema.optional(),
  widgets: z.array(widgetSchema).max(40),
});

export const seedTaskSchema = z.object({
  title: z.string().min(1).max(160),
  description: z.string().max(1000).optional(),
  status: z.string(),
  priority: priorityIdSchema.optional(),
  assigneeIds: z.array(z.string()).max(10).optional(),
  dueInDays: z.number().int().min(-60).max(365).optional(),
  /** exact deadline the user gave, YYYY-MM-DD */
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().catch(undefined),
  subtasks: z.array(z.string().min(1).max(160)).max(12).optional(),
  custom: z.record(z.union([z.string(), z.number(), z.boolean()])).optional(),
});

/** A change to an existing task, which the AI names by its #number in the EXISTING TASKS list. */
export const taskUpdateSchema = z.object({
  task: z.coerce.number().int().min(1),
  title: z.string().min(1).max(160).optional().catch(undefined),
  status: z.string().optional().catch(undefined),
  priority: priorityIdSchema.optional().catch(undefined),
  /** the full new list of people (replaces the old one) */
  assigneeIds: z.array(z.string()).max(10).optional().catch(undefined),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().catch(undefined),
});

export const seedSchema = z.object({
  tasks: z.array(seedTaskSchema).max(30).optional(),
  records: z.record(z.array(z.record(z.unknown())).max(30)).optional(),
});

export const workspaceConfigSchema = z.object({
  version: z.literal(1),
  name: z.string().min(1).max(80),
  description: z.string().max(400).optional(),
  language: languageSchema,
  team: z.object({
    roles: z.array(roleSchema).min(1).max(15),
    members: z.array(memberSchema).max(100),
  }),
  taskStatuses: z.array(taskStatusSchema).min(2).max(10),
  priorities: z.array(prioritySchema).min(1).max(4),
  taskFields: z.array(fieldSchema).max(15),
  collections: z.array(collectionSchema).max(10),
  pages: z.array(pageSchema).min(1).max(12),
  reports: z.array(z.string().max(160)).max(12).optional(),
  seed: seedSchema.optional(),
});

/** What the AI returns for a "generate" request. */
export const analysisSchema = z.object({
  language: languageSchema,
  businessContext: z.string().max(600),
  roles: z.array(z.string().max(80)).max(20),
  sections: z.array(z.string().max(80)).max(20),
  dataFields: z.array(z.string().max(80)).max(40),
  tasks: z.array(z.string().max(160)).max(20),
  deadlinesAndPriorities: z.string().max(400).optional(),
  suggestedReports: z.array(z.string().max(160)).max(12),
});

/** Something the user asked for that the component registry cannot build — reported honestly. */
export const unsupportedSchema = z.object({
  request: z.string().min(1).max(200),
  reason: z.string().max(300),
  alternative: z.string().max(400),
});

export const generateResponseSchema = z.object({
  message: z.string().max(1200),
  analysis: analysisSchema,
  needsClarification: z.boolean(),
  questions: z.array(z.string().max(300)).max(5),
  config: workspaceConfigSchema.nullable(),
});

export const editResponseSchema = z.object({
  message: z.string().max(1200),
  summary: z.array(z.string().max(200)).max(20),
  config: workspaceConfigSchema,
});

export const workEntrySchema = z.object({
  description: z.string().min(1).max(300),
  category: z.string().max(60).optional(),
  hours: z.number().min(0).max(24).optional(),
  status: z.enum(["done", "in_progress"]).optional(),
});

export const worklogResponseSchema = z.object({
  message: z.string().max(600),
  entries: z.array(workEntrySchema).max(20),
});
