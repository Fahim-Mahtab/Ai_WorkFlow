/**
 * TypeScript types for workspace configuration (inferred from Zod) and
 * runtime workspace data (tasks, records, work logs) which lives in LocalStorage.
 */
import type { z } from "zod";
import type {
  analysisSchema,
  collectionSchema,
  fieldSchema,
  fieldTypeSchema,
  filterSchema,
  generateResponseSchema,
  editResponseSchema,
  languageSchema,
  memberSchema,
  pageSchema,
  priorityIdSchema,
  roleSchema,
  seedTaskSchema,
  taskUpdateSchema,
  statusColorSchema,
  taskStatusSchema,
  widgetSchema,
  workEntrySchema,
  workspaceConfigSchema,
  pageIconSchema,
  unsupportedSchema,
  aggregateSchema,
  dateBucketSchema,
  dateRangeSchema,
} from "./schema";

export type Language = z.infer<typeof languageSchema>;
export type FieldType = z.infer<typeof fieldTypeSchema>;
export type FieldDef = z.infer<typeof fieldSchema>;
export type Collection = z.infer<typeof collectionSchema>;
export type StatusColor = z.infer<typeof statusColorSchema>;
export type TaskStatus = z.infer<typeof taskStatusSchema>;
export type PriorityId = z.infer<typeof priorityIdSchema>;
export type Role = z.infer<typeof roleSchema>;
export type Member = z.infer<typeof memberSchema>;
export type Filter = z.infer<typeof filterSchema>;
export type Aggregate = z.infer<typeof aggregateSchema>;
export type DateBucket = z.infer<typeof dateBucketSchema>;
export type DateRange = z.infer<typeof dateRangeSchema>;
export type PageIcon = z.infer<typeof pageIconSchema>;
export type Widget = z.infer<typeof widgetSchema>;
export type WidgetType = Widget["type"];
export type WidgetOf<T extends WidgetType> = Extract<Widget, { type: T }>;
export type Page = z.infer<typeof pageSchema>;
export type WorkspaceConfig = z.infer<typeof workspaceConfigSchema>;
export type SeedTask = z.infer<typeof seedTaskSchema>;
export type TaskUpdate = z.infer<typeof taskUpdateSchema>;
export type Analysis = z.infer<typeof analysisSchema>;
export type GenerateResponse = z.infer<typeof generateResponseSchema>;
export type EditResponse = z.infer<typeof editResponseSchema>;
export type WorkEntry = z.infer<typeof workEntrySchema>;
export type Unsupported = z.infer<typeof unsupportedSchema>;

/* ---------------------------- Runtime data ---------------------------- */

export type FieldValue = string | number | boolean | string[] | null | undefined;

export interface Subtask {
  id: string;
  title: string;
  done: boolean;
}

export interface Comment {
  id: string;
  author: string;
  text: string;
  createdAt: string;
}

export interface LinkRef {
  id: string;
  label: string;
  url: string;
  kind: "link" | "file";
  /** file references only store metadata — no upload in the PoC */
  size?: number;
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  status: string;
  priority: PriorityId;
  assigneeIds: string[];
  dueDate?: string; // yyyy-mm-dd
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  subtasks: Subtask[];
  comments: Comment[];
  links: LinkRef[];
  custom: Record<string, FieldValue>;
  kind: "assigned" | "self";
}

export interface RecordRow {
  id: string;
  values: Record<string, FieldValue>;
  createdAt: string;
  createdBy?: string;
}

export interface WorkLog {
  id: string;
  memberId?: string;
  date: string; // yyyy-mm-dd
  description: string;
  category?: string;
  hours?: number;
  status?: "done" | "in_progress";
  createdAt: string;
}

export interface ActivityItem {
  id: string;
  at: string;
  text: string;
  kind: "task" | "record" | "worklog" | "config" | "comment" | "system";
}

export interface Attachment extends LinkRef {
  widgetId?: string;
  createdAt: string;
}

export interface WorkspaceData {
  tasks: Task[];
  records: Record<string, RecordRow[]>;
  worklogs: WorkLog[];
  activity: ActivityItem[];
  attachments: Attachment[];
}

export interface Workspace {
  id: string;
  createdAt: string;
  updatedAt: string;
  prompt?: string;
  isDemo?: boolean;
  config: WorkspaceConfig;
  data: WorkspaceData;
}

/** Row shape consumed by the data engine (tables, charts, metrics). */
export type FlatRow = { id: string } & Record<string, FieldValue>;
