/**
 * Saved views ("Nazmul er pending kaj", "this week's deadlines") and workload / deadline-risk
 * figures. Everything here runs in the browser with plain rules: no AI tokens are spent.
 */
import type { PriorityId, Task, Workspace, WorkspaceConfig } from "../config/types";
import { daysUntil } from "../automation/rules";
import { todayISO, uid } from "../utils";

export type DueFilter = "overdue" | "today" | "week" | "none";

export interface ViewQuery {
  assigneeIds?: string[];
  statuses?: string[];
  priorities?: PriorityId[];
  due?: DueFilter;
  /** hide finished tasks */
  openOnly?: boolean;
  text?: string;
}

export interface SavedView {
  id: string;
  name: string;
  query: ViewQuery;
}

export const DUE_LABEL: Record<DueFilter, string> = { overdue: "Overdue", today: "Due today", week: "Due in 7 days", none: "No deadline" };

const PRIORITY_WORDS: [PriorityId, RegExp][] = [
  ["urgent", /urgent|joruri|জরুরি|জরুরী|asap/i],
  ["high", /\bhigh\b|beshi important|গুরুত্বপূর্ণ|উচ্চ/i],
  ["low", /\blow\b|kom important|নিম্ন/i],
];
const DUE_WORDS: [DueFilter, RegExp][] = [
  ["overdue", /overdue|late|deri|দেরি|মেয়াদ ?(শেষ|পার)|deadline (par|miss)/i],
  // whole words only: "kaj" (work) must not read as "aj" (today)
  ["today", /today|\baa?j(ke|ker)?\b|আজ/i],
  ["week", /this week|ei (week|shoptah|soptaho)|এই সপ্তাহ|next 7|7 din|৭ দিন|soon|shiggir|শীঘ্র/i],
  ["none", /no deadline|deadline nai|ডেডলাইন নেই/i],
];
const OPEN_WORDS = /pending|baki|বাকি|open|unfinished|chalu|চলমান|not done/i;

/** Understand a typed view like "Nazmul er pending kaj" or "urgent tasks due this week" without AI. */
export function parseViewText(text: string, cfg: WorkspaceConfig): ViewQuery {
  const q: ViewQuery = {};
  const lower = text.toLowerCase();
  const who = cfg.team.members.filter((m) => m.name.trim() && lower.includes(m.name.toLowerCase().split(" ")[0]));
  if (who.length) q.assigneeIds = who.map((m) => m.id);
  const st = cfg.taskStatuses.filter((s) => lower.includes(s.label.toLowerCase()));
  if (st.length) q.statuses = st.map((s) => s.id);
  const pr = PRIORITY_WORDS.filter(([, re]) => re.test(text)).map(([p]) => p);
  if (pr.length) q.priorities = pr;
  const due = DUE_WORDS.find(([, re]) => re.test(text));
  if (due) q.due = due[0];
  if (OPEN_WORDS.test(text) || (q.due && q.due !== "none" && !q.statuses)) q.openOnly = true;
  return q;
}

export function isEmptyQuery(q: ViewQuery): boolean {
  return !q.assigneeIds?.length && !q.statuses?.length && !q.priorities?.length && !q.due && !q.openOnly && !q.text;
}

export function makeView(name: string, query: ViewQuery): SavedView {
  return { id: uid("view"), name: name.trim().slice(0, 60) || "My view", query };
}

export function filterTasks(tasks: Task[], q: ViewQuery, cfg: WorkspaceConfig, today = todayISO()): Task[] {
  const done = new Set(cfg.taskStatuses.filter((s) => s.isDone).map((s) => s.id));
  return tasks.filter((t) => {
    if (q.assigneeIds?.length && !q.assigneeIds.some((id) => t.assigneeIds.includes(id))) return false;
    if (q.statuses?.length && !q.statuses.includes(t.status)) return false;
    if (q.priorities?.length && !q.priorities.includes(t.priority)) return false;
    if (q.openOnly && done.has(t.status)) return false;
    if (q.text && !t.title.toLowerCase().includes(q.text.toLowerCase())) return false;
    if (q.due) {
      if (q.due === "none") return !t.dueDate;
      if (!t.dueDate) return false;
      const d = daysUntil(t.dueDate, today);
      if (q.due === "overdue" && !(d < 0 && !done.has(t.status))) return false;
      if (q.due === "today" && d !== 0) return false;
      if (q.due === "week" && !(d >= 0 && d <= 7)) return false;
    }
    return true;
  });
}

export function describeQuery(q: ViewQuery, cfg: WorkspaceConfig): string[] {
  const out: string[] = [];
  const name = (id: string) => cfg.team.members.find((m) => m.id === id)?.name ?? id;
  const status = (id: string) => cfg.taskStatuses.find((s) => s.id === id)?.label ?? id;
  if (q.assigneeIds?.length) out.push(`People: ${q.assigneeIds.map(name).join(", ")}`);
  if (q.statuses?.length) out.push(`Status: ${q.statuses.map(status).join(", ")}`);
  if (q.priorities?.length) out.push(`Priority: ${q.priorities.join(", ")}`);
  if (q.due) out.push(DUE_LABEL[q.due]);
  if (q.openOnly) out.push("Not finished");
  if (q.text) out.push(`Title has "${q.text}"`);
  return out;
}

/* ------------------------------------ risk + workload ------------------------------------ */

export type Risk = "late" | "at_risk" | "watch" | "ok";

/**
 * Deadline risk from status and how close the deadline is:
 * late = past the deadline; at_risk = due within 2 days and not started yet;
 * watch = due within 2 days and in progress, or due within 5 days and not started.
 */
export function taskRisk(t: Task, cfg: WorkspaceConfig, today = todayISO()): Risk {
  const done = cfg.taskStatuses.some((s) => s.id === t.status && s.isDone);
  if (done || !t.dueDate) return "ok";
  const d = daysUntil(t.dueDate, today);
  const notStarted = t.status === cfg.taskStatuses[0]?.id;
  if (d < 0) return "late";
  if (d <= 2 && notStarted) return "at_risk";
  if (d <= 2 || (d <= 5 && notStarted)) return "watch";
  return "ok";
}

export interface PersonLoad {
  memberId: string;
  name: string;
  role: string;
  open: number;
  byStatus: { statusId: string; count: number }[];
  late: number;
  atRisk: number;
  dueThisWeek: number;
  doneThisWeek: number;
  hours7d: number;
  logs7d: number;
  nextDeadline?: { title: string; date: string };
}

export function workload(ws: Workspace, today = todayISO()): PersonLoad[] {
  const cfg = ws.config;
  const done = new Set(cfg.taskStatuses.filter((s) => s.isDone).map((s) => s.id));
  const weekAgo = Date.parse(today + "T00:00:00Z") - 7 * 86400000;
  return cfg.team.members.map((m) => {
    const mine = ws.data.tasks.filter((t) => t.assigneeIds.includes(m.id));
    const open = mine.filter((t) => !done.has(t.status));
    const logs = ws.data.worklogs.filter((w) => w.memberId === m.id && Date.parse(w.date + "T00:00:00Z") >= weekAgo);
    const next = open.filter((t) => t.dueDate).sort((a, b) => a.dueDate!.localeCompare(b.dueDate!))[0];
    return {
      memberId: m.id,
      name: m.name,
      role: cfg.team.roles.find((r) => r.id === m.roleId)?.name ?? "",
      open: open.length,
      byStatus: cfg.taskStatuses.filter((s) => !s.isDone).map((s) => ({ statusId: s.id, count: open.filter((t) => t.status === s.id).length })),
      late: open.filter((t) => taskRisk(t, cfg, today) === "late").length,
      atRisk: open.filter((t) => taskRisk(t, cfg, today) === "at_risk").length,
      dueThisWeek: open.filter((t) => t.dueDate && daysUntil(t.dueDate, today) >= 0 && daysUntil(t.dueDate, today) <= 7).length,
      doneThisWeek: mine.filter((t) => t.completedAt && Date.parse(t.completedAt) >= weekAgo).length,
      hours7d: logs.reduce((s, w) => s + (w.hours ?? 0), 0),
      logs7d: logs.length,
      nextDeadline: next ? { title: next.title, date: next.dueDate! } : undefined,
    };
  });
}
