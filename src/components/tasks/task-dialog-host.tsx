"use client";
/** Wraps children with a WidgetEnv whose openTask/newTask open the shared TaskDialog wired to the store. */
import { useCallback, useMemo, useState, type ReactNode } from "react";
import type { Task, Workspace } from "@/lib/config/types";
import { WidgetEnvProvider } from "@/components/dashboard/env";
import { useWorkspaceActions } from "@/lib/workspace/store";
import { TaskDialog } from "./task-dialog";

export function WorkspaceEnv({ workspace, readOnly = false, children }: { workspace: Workspace; readOnly?: boolean; children: ReactNode }) {
  const actions = useWorkspaceActions(workspace.id);
  const [state, setState] = useState<{ open: boolean; taskId?: string; defaults?: Partial<Task> }>({ open: false });
  const openTask = useCallback((taskId: string) => setState({ open: true, taskId }), []);
  const newTask = useCallback((defaults?: Partial<Task>) => setState({ open: true, defaults }), []);
  const env = useMemo(() => ({ workspace, readOnly, openTask, newTask }), [workspace, readOnly, openTask, newTask]);
  const task = state.taskId ? workspace.data.tasks.find((t) => t.id === state.taskId) ?? null : null;

  return (
    <WidgetEnvProvider value={env}>
      {children}
      <TaskDialog
        workspace={workspace}
        open={state.open}
        onOpenChange={(open) => setState((s) => ({ ...s, open }))}
        task={task}
        defaults={state.defaults}
        readOnly={readOnly}
        onSave={(draft, id) => (id ? actions.updateTask(id, draft) : actions.addTask(draft))}
        onDelete={(id) => actions.deleteTask(id)}
      />
    </WidgetEnvProvider>
  );
}
