/**
 * Move a workspace between browsers or sites (localhost → the live site, one laptop → another).
 * Everything lives in each browser's own storage, so this file is the way across:
 * the workspace (layout, tasks, records, work logs, automations, saved views) plus its AI chat.
 * Importing costs no AI tokens.
 */
import type { Workspace } from "../config/types";
import { validateConfig } from "../config/validate";
import { loadChat, saveChat, type ChatEntry } from "../storage/local";
import { slugify, uid } from "../utils";

interface ExportFile {
  kind: "kajflow-workspace";
  version: 1;
  exportedAt: string;
  workspace: Workspace;
  chat: ChatEntry[];
}

export function downloadWorkspace(ws: Workspace) {
  const file: ExportFile = { kind: "kajflow-workspace", version: 1, exportedAt: new Date().toISOString(), workspace: ws, chat: loadChat(ws.id) };
  const blob = new Blob([JSON.stringify(file, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${slugify(ws.config.name, "workspace")}.workspace.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}

/**
 * Read an export file (this format, or an older bare workspace JSON). Keeps the workspace id
 * unless this browser already has one with that id, and restores the AI chat under the final id.
 */
export function readWorkspaceFile(text: string, existingIds: string[]): Workspace {
  const raw = JSON.parse(text) as Partial<ExportFile> & Partial<Workspace>;
  const ws = (raw.kind === "kajflow-workspace" ? raw.workspace : raw) as Workspace | undefined;
  if (!ws || typeof ws !== "object") throw new Error("This is not a workspace file");
  const v = validateConfig(ws.config);
  if (!v.ok) throw new Error(v.errors[0] ?? "The workspace layout is invalid");
  if (!ws.data || !Array.isArray(ws.data.tasks)) throw new Error("The file has no workspace data");
  const id = ws.id && !existingIds.includes(ws.id) ? ws.id : uid("ws");
  // older exports may lack newer lists
  const d = ws.data as Partial<Workspace["data"]>;
  const data: Workspace["data"] = { tasks: d.tasks ?? [], records: d.records ?? {}, worklogs: d.worklogs ?? [], activity: d.activity ?? [], attachments: d.attachments ?? [] };
  if (raw.kind === "kajflow-workspace" && Array.isArray(raw.chat) && raw.chat.length) saveChat(id, raw.chat);
  return { ...ws, id, config: v.config!, data };
}
