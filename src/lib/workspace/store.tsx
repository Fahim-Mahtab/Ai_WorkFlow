"use client";
/**
 * Client-side workspace store (React context) persisted to LocalStorage.
 * Config edits never touch `data`, so AI/manual edits preserve user data.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type {
  ActivityItem,
  Attachment,
  FieldValue,
  RecordRow,
  Task,
  WorkLog,
  Workspace,
  WorkspaceConfig,
} from "../config/types";
import { deleteChat, loadState, saveState } from "../storage/local";
import { runTaskRules, sweepTimeRules, type Rule, type RuleNote } from "../automation/rules";
import type { SavedView } from "../views/views";
import { nowISO, uid } from "../utils";

interface StoreValue {
  hydrated: boolean;
  workspaces: Workspace[];
  activeId: string | null;
  active: Workspace | null;
  storageError: string | null;
  setActive: (id: string | null) => void;
  addWorkspace: (ws: Workspace) => void;
  removeWorkspace: (id: string) => void;
  updateWorkspace: (id: string, fn: (ws: Workspace) => Workspace) => void;
}

const StoreCtx = createContext<StoreValue | null>(null);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [hydrated, setHydrated] = useState(false);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [storageError, setStorageError] = useState<string | null>(null);
  const skipSave = useRef(true);

  useEffect(() => {
    const s = loadState();
    setWorkspaces(s.workspaces);
    setActiveId(s.activeId && s.workspaces.some((w) => w.id === s.activeId) ? s.activeId : s.workspaces[0]?.id ?? null);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    if (skipSave.current) {
      skipSave.current = false;
      return;
    }
    const r = saveState({ workspaces, activeId });
    setStorageError(r.ok ? null : r.error ?? "Could not save");
  }, [workspaces, activeId, hydrated]);

  const addWorkspace = useCallback((ws: Workspace) => {
    setWorkspaces((prev) => [ws, ...prev]);
    setActiveId(ws.id);
  }, []);

  const removeWorkspace = useCallback((id: string) => {
    deleteChat(id);
    setWorkspaces((prev) => {
      const next = prev.filter((w) => w.id !== id);
      setActiveId((cur) => (cur === id ? next[0]?.id ?? null : cur));
      return next;
    });
  }, []);

  const updateWorkspace = useCallback((id: string, fn: (ws: Workspace) => Workspace) => {
    setWorkspaces((prev) => prev.map((w) => (w.id === id ? { ...fn(w), updatedAt: nowISO() } : w)));
  }, []);

  // deadline rules (overdue / due soon): check on open and every minute
  useEffect(() => {
    if (!hydrated || !activeId) return;
    const sweep = () =>
      setWorkspaces((prev) => {
        let changed = false;
        const next = prev.map((w) => {
          if (w.id !== activeId) return w;
          const r = sweepTimeRules(w.rules, w.config, w.data.tasks);
          if (!r) return w;
          changed = true;
          return { ...w, updatedAt: nowISO(), rules: countRuns(w.rules, r.fired), data: { ...withNotes(w.data, r.notes), tasks: r.tasks } };
        });
        return changed ? next : prev;
      });
    sweep();
    const t = setInterval(sweep, 60_000);
    return () => clearInterval(t);
  }, [hydrated, activeId]);

  const value = useMemo<StoreValue>(
    () => ({
      hydrated,
      workspaces,
      activeId,
      active: workspaces.find((w) => w.id === activeId) ?? null,
      storageError,
      setActive: setActiveId,
      addWorkspace,
      removeWorkspace,
      updateWorkspace,
    }),
    [hydrated, workspaces, activeId, storageError, addWorkspace, removeWorkspace, updateWorkspace],
  );
  return <StoreCtx.Provider value={value}>{children}</StoreCtx.Provider>;
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreCtx);
  if (!ctx) throw new Error("useStore must be used inside WorkspaceProvider");
  return ctx;
}

function activity(text: string, kind: ActivityItem["kind"]): ActivityItem {
  return { id: uid("a"), at: nowISO(), text, kind };
}

const withActivity = (ws: Workspace, text: string, kind: ActivityItem["kind"]): Workspace["data"] => ({
  ...ws.data,
  activity: [activity(text, kind), ...ws.data.activity].slice(0, 200),
});

/** Write what rules did into the activity feed (the bell reads these). */
const withNotes = (data: Workspace["data"], notes: RuleNote[]): Workspace["data"] =>
  notes.length ? { ...data, activity: [...notes.map((n) => activity(n.text, "rule")), ...data.activity].slice(0, 200) } : data;

const countRuns = (rules: Rule[] | undefined, fired: string[]): Rule[] | undefined =>
  fired.length && rules ? rules.map((r) => (fired.includes(r.id) ? { ...r, runs: (r.runs ?? 0) + fired.filter((f) => f === r.id).length } : r)) : rules;

/** Bound actions for the active workspace. */
export function useWorkspaceActions(workspaceId?: string) {
  const { updateWorkspace, activeId } = useStore();
  const id = workspaceId ?? activeId;

  return useMemo(() => {
    const up = (fn: (ws: Workspace) => Workspace) => id && updateWorkspace(id, fn);
    const isBn = (ws: Workspace) => ws.config.language === "bn";
    const memberName = (ws: Workspace, mid?: string) => ws.config.team.members.find((m) => m.id === mid)?.name;

    return {
      setConfig(config: WorkspaceConfig, note?: string) {
        up((ws) => ({ ...ws, config, data: note ? withActivity(ws, note, "config") : ws.data }));
      },
      updateConfig(fn: (c: WorkspaceConfig) => WorkspaceConfig, note?: string) {
        up((ws) => ({ ...ws, config: fn(ws.config), data: note ? withActivity(ws, note, "config") : ws.data }));
      },
      addTask(partial: Partial<Task> & { title: string }) {
        up((ws) => {
          const ts = nowISO();
          const task: Task = {
            id: uid("t"),
            status: ws.config.taskStatuses[0].id,
            priority: "medium",
            assigneeIds: [],
            subtasks: [],
            comments: [],
            links: [],
            custom: {},
            kind: "assigned",
            ...partial,
            createdAt: ts,
            updatedAt: ts,
          };
          const r = runTaskRules(ws.rules, ws.config, null, task);
          const data = withNotes(withActivity(ws, isBn(ws) ? `নতুন কাজ: ${task.title}` : `Task created: ${task.title}`, "task"), r.notes);
          return { ...ws, rules: countRuns(ws.rules, r.fired), data: { ...data, tasks: [r.task, ...ws.data.tasks] } };
        });
      },
      updateTask(taskId: string, patch: Partial<Task>, note?: string) {
        up((ws) => {
          const doneIds = new Set(ws.config.taskStatuses.filter((s) => s.isDone).map((s) => s.id));
          let text = note;
          let notes: RuleNote[] = [];
          let fired: string[] = [];
          const tasks = ws.data.tasks.map((t) => {
            if (t.id !== taskId) return t;
            const next = { ...t, ...patch, updatedAt: nowISO() };
            if (patch.status && patch.status !== t.status) {
              next.completedAt = doneIds.has(patch.status) ? nowISO() : undefined;
              const label = ws.config.taskStatuses.find((s) => s.id === patch.status)?.label ?? patch.status;
              text ??= isBn(ws) ? `"${t.title}" → ${label}` : `"${t.title}" moved to ${label}`;
            }
            const r = runTaskRules(ws.rules, ws.config, t, next);
            notes = r.notes;
            fired = r.fired;
            return r.task;
          });
          return { ...ws, rules: countRuns(ws.rules, fired), data: { ...withNotes(text ? withActivity(ws, text, "task") : ws.data, notes), tasks } };
        });
      },
      deleteTask(taskId: string) {
        up((ws) => {
          const t = ws.data.tasks.find((x) => x.id === taskId);
          return { ...ws, data: { ...withActivity(ws, isBn(ws) ? `কাজ মুছে ফেলা হয়েছে: ${t?.title}` : `Task deleted: ${t?.title}`, "task"), tasks: ws.data.tasks.filter((x) => x.id !== taskId) } };
        });
      },
      addRecord(collectionId: string, values: Record<string, FieldValue>, createdBy?: string) {
        up((ws) => {
          const row: RecordRow = { id: uid("r"), values, createdAt: nowISO(), createdBy };
          const col = ws.config.collections.find((c) => c.id === collectionId);
          const who = memberName(ws, createdBy);
          const text = isBn(ws) ? `${col?.name ?? collectionId}-এ নতুন এন্ট্রি${who ? ` (${who})` : ""}` : `New ${col?.name ?? collectionId} entry${who ? ` by ${who}` : ""}`;
          return { ...ws, data: { ...withActivity(ws, text, "record"), records: { ...ws.data.records, [collectionId]: [row, ...(ws.data.records[collectionId] ?? [])] } } };
        });
      },
      updateRecord(collectionId: string, rowId: string, values: Record<string, FieldValue>) {
        up((ws) => ({
          ...ws,
          data: {
            ...ws.data,
            records: { ...ws.data.records, [collectionId]: (ws.data.records[collectionId] ?? []).map((r) => (r.id === rowId ? { ...r, values: { ...r.values, ...values } } : r)) },
          },
        }));
      },
      deleteRecord(collectionId: string, rowId: string) {
        up((ws) => ({
          ...ws,
          data: { ...ws.data, records: { ...ws.data.records, [collectionId]: (ws.data.records[collectionId] ?? []).filter((r) => r.id !== rowId) } },
        }));
      },
      addWorklogs(entries: Omit<WorkLog, "id" | "createdAt">[]) {
        up((ws) => {
          const logs = entries.map((e) => ({ ...e, id: uid("wl"), createdAt: nowISO() }));
          const who = memberName(ws, entries[0]?.memberId);
          const text = isBn(ws) ? `${who ?? "একজন সদস্য"} ${logs.length}টি দৈনিক কাজের এন্ট্রি জমা দিয়েছেন` : `${who ?? "Someone"} submitted ${logs.length} work entries`;
          return { ...ws, data: { ...withActivity(ws, text, "worklog"), worklogs: [...logs, ...ws.data.worklogs] } };
        });
      },
      updateWorklog(logId: string, patch: Partial<WorkLog>) {
        up((ws) => ({ ...ws, data: { ...ws.data, worklogs: ws.data.worklogs.map((w) => (w.id === logId ? { ...w, ...patch } : w)) } }));
      },
      deleteWorklog(logId: string) {
        up((ws) => ({ ...ws, data: { ...ws.data, worklogs: ws.data.worklogs.filter((w) => w.id !== logId) } }));
      },
      addAttachment(a: Omit<Attachment, "id" | "createdAt">) {
        up((ws) => ({ ...ws, data: { ...withActivity(ws, isBn(ws) ? `সংযুক্তি যোগ: ${a.label}` : `Attachment added: ${a.label}`, "system"), attachments: [{ ...a, id: uid("att"), createdAt: nowISO() }, ...ws.data.attachments] } }));
      },
      removeAttachment(attId: string) {
        up((ws) => ({ ...ws, data: { ...ws.data, attachments: ws.data.attachments.filter((a) => a.id !== attId) } }));
      },
      setRules(fn: (rules: Rule[]) => Rule[]) {
        up((ws) => ({ ...ws, rules: fn(ws.rules ?? []) }));
      },
      setViews(fn: (views: SavedView[]) => SavedView[]) {
        up((ws) => ({ ...ws, views: fn(ws.views ?? []) }));
      },
      log(text: string, kind: ActivityItem["kind"] = "system") {
        up((ws) => ({ ...ws, data: withActivity(ws, text, kind) }));
      },
    };
  }, [id, updateWorkspace]);
}
