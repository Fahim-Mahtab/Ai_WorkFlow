/**
 * LocalStorage persistence (temporary PoC storage — no backend/database).
 * Versioned key so the shape can evolve; all access is guarded for SSR and
 * quota errors.
 */
import type { Workspace } from "../config/types";

const KEY = "awp:v1:workspaces";
const ACTIVE_KEY = "awp:v1:active";
const CHAT_KEY = "awp:v1:chat";

export interface PersistedState {
  workspaces: Workspace[];
  activeId: string | null;
}

function available(): boolean {
  try {
    return typeof window !== "undefined" && !!window.localStorage;
  } catch {
    return false;
  }
}

export function loadState(): PersistedState {
  if (!available()) return { workspaces: [], activeId: null };
  try {
    const raw = localStorage.getItem(KEY);
    const workspaces = raw ? (JSON.parse(raw) as Workspace[]) : [];
    const activeId = localStorage.getItem(ACTIVE_KEY);
    return { workspaces: Array.isArray(workspaces) ? workspaces : [], activeId };
  } catch (err) {
    console.warn("[storage] failed to load, starting fresh", err);
    return { workspaces: [], activeId: null };
  }
}

export function saveState(state: PersistedState): { ok: boolean; error?: string } {
  if (!available()) return { ok: false, error: "LocalStorage unavailable" };
  try {
    localStorage.setItem(KEY, JSON.stringify(state.workspaces));
    if (state.activeId) localStorage.setItem(ACTIVE_KEY, state.activeId);
    else localStorage.removeItem(ACTIVE_KEY);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export interface ChatEntry {
  id: string;
  role: "user" | "assistant";
  text: string;
  at: string;
  unsupported?: { request: string; reason: string; alternative: string }[];
  suggestions?: string[];
  usage?: import("../ai/pricing").UsageReport | null;
}

export function loadChat(workspaceId: string): ChatEntry[] {
  if (!available()) return [];
  try {
    return JSON.parse(localStorage.getItem(`${CHAT_KEY}:${workspaceId}`) ?? "[]") as ChatEntry[];
  } catch {
    return [];
  }
}

export function saveChat(workspaceId: string, entries: ChatEntry[]) {
  if (!available()) return;
  try {
    localStorage.setItem(`${CHAT_KEY}:${workspaceId}`, JSON.stringify(entries.slice(-50)));
  } catch {
    /* ignore quota */
  }
}

export function deleteChat(workspaceId: string) {
  if (!available()) return;
  localStorage.removeItem(`${CHAT_KEY}:${workspaceId}`);
}

export function clearAll() {
  if (!available()) return;
  Object.keys(localStorage)
    .filter((k) => k.startsWith("awp:"))
    .forEach((k) => localStorage.removeItem(k));
}

export function storageSize(): number {
  if (!available()) return 0;
  return Object.keys(localStorage)
    .filter((k) => k.startsWith("awp:"))
    .reduce((n, k) => n + (localStorage.getItem(k)?.length ?? 0), 0);
}
