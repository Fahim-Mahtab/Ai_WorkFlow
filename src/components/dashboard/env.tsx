"use client";
/** Rendering environment shared by every widget: the workspace, read-only flag and task dialog opener. */
import { createContext, useContext } from "react";
import type { Task, Workspace } from "@/lib/config/types";
import { makeT } from "@/lib/i18n";

export interface WidgetEnv {
  workspace: Workspace;
  readOnly: boolean;
  openTask: (taskId: string) => void;
  newTask: (defaults?: Partial<Task>) => void;
}

const Ctx = createContext<WidgetEnv | null>(null);
export const WidgetEnvProvider = Ctx.Provider;

export function useEnv() {
  const env = useContext(Ctx);
  if (!env) throw new Error("useEnv outside WidgetEnvProvider");
  return { ...env, config: env.workspace.config, t: makeT(env.workspace.config.language) };
}
