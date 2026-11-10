"use client";
/** Browser-side calls to our own Next.js API routes (the API key never reaches the browser). */
import type { EditResult, GenerateResult, WorklogResult } from "./pipeline";
import type { ChatResult, ChatTurn } from "./chat";
import type { ProviderStatus } from "./providers";
import type { UsageReport } from "./pricing";
import type { WorkspaceConfig } from "../config/types";
import { recordUsage } from "../storage/usage";

export type { ChatResult, ChatTurn, EditResult, GenerateResult, ProviderStatus, UsageReport, WorklogResult };

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly kind: string,
    public readonly details: string[] = [],
    public readonly canFallback = false,
    /** Tokens spent before the failure (still billed by the provider). */
    public readonly usage: UsageReport | null = null,
  ) {
    super(message);
  }
}

async function post<T extends { usage?: UsageReport | null }>(url: string, body: unknown, workspaceId: string | null, timeoutMs = 240_000): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let res: Response;
  try {
    res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal: controller.signal });
  } catch (err) {
    if ((err as Error).name === "AbortError") throw new ApiError("The request timed out. The AI may be busy — try again or use demo mode.", "timeout", [], true);
    throw new ApiError("Network error — is the dev server running?", "network", [], true);
  } finally {
    clearTimeout(timer);
  }
  const data = await res.json().catch(() => null);
  if (!res.ok || !data) {
    if (data?.usage) recordUsage(workspaceId, data.usage);
    throw new ApiError(data?.error ?? `Request failed (${res.status})`, data?.kind ?? "server", data?.details ?? [], !!data?.canFallback, data?.usage ?? null);
  }
  if (data.usage) recordUsage(workspaceId, data.usage);
  return data as T;
}

export const aiClient = {
  status: async (): Promise<ProviderStatus> => {
    const r = await fetch("/api/ai/status", { cache: "no-store" });
    return r.json();
  },
  /** workspaceId is null for a brand-new workspace — usage is re-attributed on approval. */
  generate: (body: { prompt: string; history?: { role: "user" | "assistant"; content: string }[]; forceDemo?: boolean; forceGenerate?: boolean }) =>
    post<GenerateResult>("/api/ai/generate", body, null),
  edit: (body: { instruction: string; config: WorkspaceConfig; existingTasks?: string[]; forceDemo?: boolean }, workspaceId: string) => post<EditResult>("/api/ai/edit", body, workspaceId),
  /** workspaceId null = intake chat before a workspace exists (usage is attached on approval). */
  chat: (body: { mode: "intake" | "workspace"; messages: ChatTurn[]; config?: WorkspaceConfig; existingTasks?: string[]; forceDemo?: boolean }, workspaceId: string | null) =>
    post<ChatResult>("/api/ai/chat", body, workspaceId, 90_000),
  worklog: (body: { text: string; forceDemo?: boolean }, workspaceId: string) => post<WorklogResult>("/api/ai/worklog", body, workspaceId, 90_000),
};
