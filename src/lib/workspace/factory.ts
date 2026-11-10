/** Turns a validated config into a runtime Workspace. */
import type { RecordRow, Task, WorkLog, Workspace, WorkspaceConfig, FieldValue } from "../config/types";
import type { SeedTask } from "../config/types";
import { nowISO, uid } from "../utils";

/** A task the AI took from what the user said (generation seed or an AI edit) → a runtime task. */
export function seedToTask(st: SeedTask, cfg: Pick<WorkspaceConfig, "team" | "taskStatuses">, ts = nowISO()): Task {
  const dueDate = st.dueDate ?? (st.dueInDays !== undefined ? new Date(Date.now() + st.dueInDays * 86400000).toISOString().slice(0, 10) : undefined);
  const status = cfg.taskStatuses.some((s) => s.id === st.status) ? st.status : cfg.taskStatuses[0].id;
  const done = cfg.taskStatuses.some((s) => s.id === status && s.isDone);
  return {
    id: uid("t"),
    title: st.title,
    description: st.description,
    status,
    priority: st.priority ?? "medium",
    // people may have been removed in the team setup step before approval
    assigneeIds: (st.assigneeIds ?? []).filter((id) => cfg.team.members.some((m) => m.id === id)),
    dueDate,
    createdAt: ts,
    updatedAt: ts,
    completedAt: done ? ts : undefined,
    subtasks: (st.subtasks ?? []).map((s) => ({ id: uid("st"), title: s, done: false })),
    comments: [],
    links: [],
    custom: (st.custom ?? {}) as Record<string, FieldValue>,
    kind: "assigned",
  };
}

/** Creates a workspace from config. Seeds initial sample records and tasks if available. */
export function createWorkspace(
  config: WorkspaceConfig,
  opts: { prompt?: string; isDemo?: boolean; empty?: boolean } = {}
): Workspace {
  const { seed, ...cfg } = config;
  const ts = nowISO();

  const records: Record<string, RecordRow[]> = Object.fromEntries(
    cfg.collections.map((c) => {
      const seeded = opts.empty ? [] : (seed?.records?.[c.id] ?? []);
      const rows: RecordRow[] = seeded.map((r) => {
        const { createdBy, createdAt: rCreatedAt, ...vals } = r as Record<string, unknown>;
        return {
          id: uid("r"),
          values: vals as Record<string, FieldValue>,
          createdAt: typeof rCreatedAt === "string" ? rCreatedAt : ts,
          ...(typeof createdBy === "string" ? { createdBy } : {}),
        };
      });
      return [c.id, rows];
    })
  );

  const tasks: Task[] = opts.empty ? [] : (seed?.tasks ?? []).map((st) => seedToTask(st, cfg, ts));

  const worklogs: WorkLog[] = [];

  return {
    id: uid("ws"),
    createdAt: ts,
    updatedAt: ts,
    prompt: opts.prompt,
    isDemo: opts.isDemo,
    config: cfg,
    data: {
      tasks,
      records,
      worklogs,
      attachments: [],
      activity: [
        {
          id: uid("a"),
          at: ts,
          kind: "system",
          text: cfg.language === "bn" ? `"${cfg.name}" ওয়ার্কস্পেস তৈরি হয়েছে` : `Workspace "${cfg.name}" created`,
        },
      ],
    },
  };
}
