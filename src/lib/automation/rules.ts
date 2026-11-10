/**
 * Plain-language automation rules. A rule is "When <trigger>, if <conditions>, then <actions>".
 * The AI (or the manual builder) turns a sentence like "deadline par hole priority urgent koro"
 * into this JSON; the engine below runs it on every task change and on a timer for deadlines.
 * Rules only ever change tasks inside this workspace: they never send messages anywhere.
 */
import { z } from "zod";
import { priorityIdSchema } from "../config/schema";
import type { PriorityId, Task, WorkspaceConfig } from "../config/types";
import { addDays, nowISO, todayISO, uid } from "../utils";

export const ruleTriggerSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("task_created") }),
  z.object({ type: z.literal("status_changed"), to: z.string().optional() }),
  z.object({ type: z.literal("assignee_changed") }),
  z.object({ type: z.literal("priority_changed"), to: priorityIdSchema.optional() }),
  z.object({ type: z.literal("subtasks_done") }),
  z.object({ type: z.literal("overdue") }),
  z.object({ type: z.literal("due_soon"), days: z.number().int().min(0).max(30) }),
]);

export const ruleConditionsSchema = z.object({
  statuses: z.array(z.string()).max(10).optional(),
  priorities: z.array(priorityIdSchema).max(4).optional(),
  assigneeIds: z.array(z.string()).max(20).optional(),
  titleContains: z.string().max(60).optional(),
});

export const ruleActionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("set_status"), status: z.string() }),
  z.object({ type: z.literal("set_priority"), priority: priorityIdSchema }),
  z.object({ type: z.literal("assign"), memberIds: z.array(z.string()).min(1).max(10), mode: z.enum(["add", "replace"]) }),
  z.object({ type: z.literal("add_comment"), text: z.string().min(1).max(300) }),
  z.object({ type: z.literal("add_subtasks"), items: z.array(z.string().min(1).max(160)).min(1).max(10) }),
  z.object({ type: z.literal("set_due_in_days"), days: z.number().int().min(0).max(365) }),
  /** shows in the bell + activity feed inside the app (no SMS/email) */
  z.object({ type: z.literal("notify"), text: z.string().min(1).max(200) }),
]);

export const ruleSchema = z.object({
  id: z.string(),
  /** the sentence the user wrote, shown as the rule's name */
  name: z.string().min(1).max(200),
  enabled: z.boolean(),
  trigger: ruleTriggerSchema,
  conditions: ruleConditionsSchema.optional(),
  actions: z.array(ruleActionSchema).min(1).max(6),
  createdAt: z.string(),
  /** how many times it has run */
  runs: z.number().int().optional(),
});

export type RuleTrigger = z.infer<typeof ruleTriggerSchema>;
export type RuleConditions = z.infer<typeof ruleConditionsSchema>;
export type RuleAction = z.infer<typeof ruleActionSchema>;
export type Rule = z.infer<typeof ruleSchema>;

/** What a rule did, written into the activity feed and the bell. */
export interface RuleNote {
  ruleId: string;
  text: string;
}

const doneSet = (cfg: Pick<WorkspaceConfig, "taskStatuses">) => new Set(cfg.taskStatuses.filter((s) => s.isDone).map((s) => s.id));

/**
 * Fix the ids in an AI-made or hand-made rule against the workspace (statuses, people), dropping
 * anything that points nowhere. Returns null when nothing usable is left.
 */
export function sanitizeRule(raw: unknown, cfg: WorkspaceConfig): Omit<Rule, "id" | "createdAt" | "enabled" | "runs"> | null {
  const p = ruleSchema.pick({ name: true, trigger: true, conditions: true, actions: true }).safeParse(raw);
  if (!p.success) return null;
  const status = (s?: string) => (s ? cfg.taskStatuses.find((x) => x.id === s || x.label.toLowerCase() === s.toLowerCase())?.id : undefined);
  const member = (m: string) => cfg.team.members.find((x) => x.id === m || x.name.toLowerCase() === m.toLowerCase())?.id;
  const r = p.data;
  let trigger = r.trigger;
  if (trigger.type === "status_changed" && trigger.to !== undefined) {
    const to = status(trigger.to);
    if (!to) return null;
    trigger = { ...trigger, to };
  }
  const c = r.conditions ?? {};
  const conditions: RuleConditions = {};
  const st = (c.statuses ?? []).map(status).filter((s): s is string => !!s);
  if (st.length) conditions.statuses = st;
  if (c.priorities?.length) conditions.priorities = c.priorities;
  const who = (c.assigneeIds ?? []).map(member).filter((s): s is string => !!s);
  if (who.length) conditions.assigneeIds = who;
  if (c.titleContains?.trim()) conditions.titleContains = c.titleContains.trim();
  const actions: RuleAction[] = [];
  for (const a of r.actions) {
    if (a.type === "set_status") {
      const s = status(a.status);
      if (s) actions.push({ ...a, status: s });
    } else if (a.type === "assign") {
      const ids = a.memberIds.map(member).filter((s): s is string => !!s);
      if (ids.length) actions.push({ ...a, memberIds: [...new Set(ids)] });
    } else actions.push(a);
  }
  if (!actions.length) return null;
  return { name: r.name, trigger, conditions: Object.keys(conditions).length ? conditions : undefined, actions };
}

export function newRule(r: Omit<Rule, "id" | "createdAt" | "enabled" | "runs">): Rule {
  return { ...r, id: uid("rule"), enabled: true, createdAt: nowISO(), runs: 0 };
}

function matches(c: RuleConditions | undefined, t: Task): boolean {
  if (!c) return true;
  if (c.statuses?.length && !c.statuses.includes(t.status)) return false;
  if (c.priorities?.length && !c.priorities.includes(t.priority)) return false;
  if (c.assigneeIds?.length && !c.assigneeIds.some((id) => t.assigneeIds.includes(id))) return false;
  if (c.titleContains && !t.title.toLowerCase().includes(c.titleContains.toLowerCase())) return false;
  return true;
}

function firesOnChange(tr: RuleTrigger, before: Task | null, after: Task): boolean {
  switch (tr.type) {
    case "task_created":
      return !before;
    case "status_changed":
      return !!before && before.status !== after.status && (!tr.to || tr.to === after.status);
    case "assignee_changed":
      return !!before && [...before.assigneeIds].sort().join() !== [...after.assigneeIds].sort().join();
    case "priority_changed":
      return !!before && before.priority !== after.priority && (!tr.to || tr.to === after.priority);
    case "subtasks_done": {
      const all = (t: Task) => t.subtasks.length > 0 && t.subtasks.every((s) => s.done);
      return all(after) && !(before && all(before));
    }
    default:
      return false;
  }
}

function act(t: Task, actions: RuleAction[], cfg: Pick<WorkspaceConfig, "taskStatuses" | "team">, ruleName: string): { task: Task; notify: string[] } {
  const done = doneSet(cfg);
  const ts = nowISO();
  let task = { ...t };
  const notify: string[] = [];
  for (const a of actions) {
    switch (a.type) {
      case "set_status":
        if (cfg.taskStatuses.some((s) => s.id === a.status) && task.status !== a.status) {
          task = { ...task, status: a.status, completedAt: done.has(a.status) ? ts : undefined };
        }
        break;
      case "set_priority":
        task = { ...task, priority: a.priority as PriorityId };
        break;
      case "assign": {
        const ids = a.memberIds.filter((id) => cfg.team.members.some((m) => m.id === id));
        task = { ...task, assigneeIds: a.mode === "replace" ? ids : [...new Set([...task.assigneeIds, ...ids])] };
        break;
      }
      case "add_comment":
        task = { ...task, comments: [...task.comments, { id: uid("c"), author: "⚡ Rule", text: a.text, createdAt: ts }] };
        break;
      case "add_subtasks": {
        const have = new Set(task.subtasks.map((s) => s.title.toLowerCase()));
        task = { ...task, subtasks: [...task.subtasks, ...a.items.filter((i) => !have.has(i.toLowerCase())).map((title) => ({ id: uid("st"), title, done: false }))] };
        break;
      }
      case "set_due_in_days":
        task = { ...task, dueDate: addDays(todayISO(), a.days) };
        break;
      case "notify":
        notify.push(a.text);
        break;
    }
  }
  void ruleName;
  return { task: { ...task, updatedAt: ts }, notify };
}

/** Bell text: the task, then the rule's own message (or the rule's name when it has none). */
const noteText = (rule: Rule, t: Task, notify: string[]) => `"${t.title}": ${notify.length ? notify.join(" · ") : rule.name}`;

/**
 * Run the change-triggered rules for one task (null `before` = just created).
 * Single pass: changes made by a rule do not trigger other rules, so rules can never loop.
 */
export function runTaskRules(rules: Rule[] | undefined, cfg: WorkspaceConfig, before: Task | null, after: Task): { task: Task; notes: RuleNote[]; fired: string[] } {
  let task = after;
  const notes: RuleNote[] = [];
  const fired: string[] = [];
  for (const rule of rules ?? []) {
    if (!rule.enabled || !firesOnChange(rule.trigger, before, after) || !matches(rule.conditions, after)) continue;
    const r = act(task, rule.actions, cfg, rule.name);
    task = r.task;
    notes.push({ ruleId: rule.id, text: noteText(rule, after, r.notify) });
    fired.push(rule.id);
  }
  return { task, notes, fired };
}

/** Days from today to an ISO date (negative = past). */
export function daysUntil(date: string, today = todayISO()): number {
  return Math.round((Date.parse(date + "T00:00:00Z") - Date.parse(today + "T00:00:00Z")) / 86400000);
}

/**
 * Deadline rules (overdue / due soon) run on a timer. Each rule fires once per task per deadline:
 * the task remembers `ruleId@dueDate` so moving the deadline lets it fire again.
 */
export function sweepTimeRules(rules: Rule[] | undefined, cfg: WorkspaceConfig, tasks: Task[], today = todayISO()): { tasks: Task[]; notes: RuleNote[]; fired: string[] } | null {
  const timed = (rules ?? []).filter((r) => r.enabled && (r.trigger.type === "overdue" || r.trigger.type === "due_soon"));
  if (!timed.length) return null;
  const done = doneSet(cfg);
  const notes: RuleNote[] = [];
  const fired: string[] = [];
  let changed = false;
  const next = tasks.map((t) => {
    if (!t.dueDate || done.has(t.status)) return t;
    const d = daysUntil(t.dueDate, today);
    let task = t;
    for (const rule of timed) {
      const tr = rule.trigger;
      const due = tr.type === "overdue" ? d < 0 : tr.type === "due_soon" && d >= 0 && d <= tr.days;
      const key = `${rule.id}@${t.dueDate}`;
      if (!due || (task.firedRules ?? []).includes(key) || !matches(rule.conditions, task)) continue;
      const r = act(task, rule.actions, cfg, rule.name);
      task = { ...r.task, firedRules: [...(task.firedRules ?? []), key].slice(-40) };
      notes.push({ ruleId: rule.id, text: noteText(rule, t, r.notify) });
      fired.push(rule.id);
      changed = true;
    }
    return task;
  });
  return changed ? { tasks: next, notes, fired } : null;
}

/* ------------------------------ plain-language description ------------------------------ */

export function describeTrigger(tr: RuleTrigger, cfg: WorkspaceConfig): string {
  const status = (id?: string) => cfg.taskStatuses.find((s) => s.id === id)?.label ?? id;
  switch (tr.type) {
    case "task_created":
      return "a task is created";
    case "status_changed":
      return tr.to ? `a task moves to ${status(tr.to)}` : "a task's status changes";
    case "assignee_changed":
      return "a task is reassigned";
    case "priority_changed":
      return tr.to ? `priority becomes ${tr.to}` : "priority changes";
    case "subtasks_done":
      return "all checklist items are done";
    case "overdue":
      return "a deadline is missed";
    case "due_soon":
      return tr.days === 0 ? "a task is due today" : `a task is due within ${tr.days} day${tr.days === 1 ? "" : "s"}`;
  }
}

export function describeConditions(c: RuleConditions | undefined, cfg: WorkspaceConfig): string[] {
  if (!c) return [];
  const out: string[] = [];
  const status = (id: string) => cfg.taskStatuses.find((s) => s.id === id)?.label ?? id;
  const name = (id: string) => cfg.team.members.find((m) => m.id === id)?.name ?? id;
  if (c.statuses?.length) out.push(`status is ${c.statuses.map(status).join(" or ")}`);
  if (c.priorities?.length) out.push(`priority is ${c.priorities.join(" or ")}`);
  if (c.assigneeIds?.length) out.push(`assigned to ${c.assigneeIds.map(name).join(" or ")}`);
  if (c.titleContains) out.push(`title contains "${c.titleContains}"`);
  return out;
}

export function describeAction(a: RuleAction, cfg: WorkspaceConfig): string {
  const status = (id: string) => cfg.taskStatuses.find((s) => s.id === id)?.label ?? id;
  const name = (id: string) => cfg.team.members.find((m) => m.id === id)?.name ?? id;
  switch (a.type) {
    case "set_status":
      return `move it to ${status(a.status)}`;
    case "set_priority":
      return `set priority to ${a.priority}`;
    case "assign":
      return `${a.mode === "replace" ? "assign it only to" : "also assign"} ${a.memberIds.map(name).join(", ")}`;
    case "add_comment":
      return `comment "${a.text}"`;
    case "add_subtasks":
      return `add checklist: ${a.items.join(", ")}`;
    case "set_due_in_days":
      return `set deadline to ${a.days} day${a.days === 1 ? "" : "s"} from then`;
    case "notify":
      return `notify: "${a.text}"`;
  }
}
