"use client";
/**
 * AI Assistant side panel — the conversational control surface for the
 * active dashboard. Edits go through the server pipeline and are always
 * previewed (diff + live preview) before being applied.
 */
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowUp, Loader2, Plus, RotateCcw, Sparkles, Trash2, X } from "lucide-react";
import { useStore, useWorkspaceActions } from "@/lib/workspace/store";
import { aiClient, ApiError } from "@/lib/ai/client";
import { diffConfigs, type Change } from "@/lib/workspace/diff";
import { loadChat, saveChat, type ChatEntry } from "@/lib/storage/local";
import type { SeedTask, Task, Unsupported, WorkspaceConfig } from "@/lib/config/types";
import { seedToTask } from "@/lib/workspace/factory";
import { TASK_LINE_MAX, taskLines } from "@/lib/workspace/task-lines";
import type { TaskChange } from "./change-preview-dialog";
import { SuggestionChips, UnsupportedNotice } from "./capability-notice";
import { UsageBadge, UsageTotalPill, useUsageTotals } from "./usage-badge";
import { SAMPLE_EDITS } from "@/lib/workspace/demos";
import { Button } from "@/components/ui/button";
import { Badge, Textarea } from "@/components/ui/primitives";
import { useAssistant } from "@/components/layout/providers";
import { ChangePreviewDialog } from "./change-preview-dialog";
import { VoiceButton } from "./voice-button";
import { EDIT_STEPS, GenerationProgress } from "./generation-progress";
import { cn, nowISO, uid } from "@/lib/utils";

interface Pending {
  next: WorkspaceConfig;
  changes: Change[];
  summary: string[];
  warnings: string[];
  instruction: string;
  unsupported: Unsupported[];
  suggestions: string[];
  newTasks: SeedTask[];
  taskChanges: TaskChange[];
}

export function AssistantPanel({ onClose }: { onClose: () => void }) {
  const { active } = useStore();
  const { prefill, status } = useAssistant();
  const actions = useWorkspaceActions();
  const router = useRouter();
  const [input, setInput] = useState("");
  const [chat, setChat] = useState<ChatEntry[]>([]);
  const [busy, setBusy] = useState<null | "chat" | "edit">(null);
  // stage tells Retry what to redo: the conversation turn, or the edit it asked for
  const [error, setError] = useState<{ err: ApiError; stage: "chat" | "edit"; text: string } | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const [panelMode, setPanelMode] = useState<"demo" | "live">("demo");
  const isDemo = panelMode === "demo";
  const endRef = useRef<HTMLDivElement>(null);
  const live = !isDemo && status?.mode === "live";
  const totals = useUsageTotals(active?.id);

  useEffect(() => {
    setChat(active ? loadChat(active.id) : []);
  }, [active?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (prefill) setInput(prefill);
  }, [prefill]);
  useEffect(() => {
    // block body: newer browsers return a Promise from scrollIntoView, which must not leak out of an effect
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [chat, busy]);

  const push = (e: Omit<ChatEntry, "id" | "at">) => {
    setChat((c) => {
      const next = [...c, { ...e, id: uid("m"), at: nowISO() }];
      if (active) saveChat(active.id, next);
      return next;
    });
  };

  /** Turn the conversation into a concrete change, then show it for approval. */
  const runEdit = async (instruction: string, forceDemo = isDemo) => {
    if (!active) return;
    setError(null);
    setBusy("edit");
    try {
      // the AI names existing tasks by their #number in this list, so keep the same order to map them back
      const listed = active.data.tasks.slice(0, TASK_LINE_MAX);
      const r = await aiClient.edit({ instruction, config: active.config, existingTasks: taskLines(listed, active.config), forceDemo }, active.id);
      const extras = { unsupported: r.unsupported ?? [], suggestions: r.suggestions ?? [], usage: r.usage ?? null };
      if (!r.config) {
        push({ role: "assistant", text: r.message || "I couldn't produce a change for that.", ...extras });
        return;
      }
      const changes = diffConfigs(active.config, r.config);
      const newTasks = r.newTasks ?? [];
      const taskChanges = (r.taskUpdates ?? []).flatMap((u): TaskChange[] => {
        const before = listed[u.task - 1];
        if (!before) return [];
        const patch: Partial<Task> = {};
        if (u.title && u.title !== before.title) patch.title = u.title;
        if (u.status && u.status !== before.status) patch.status = u.status;
        if (u.priority && u.priority !== before.priority) patch.priority = u.priority;
        if (u.dueDate && u.dueDate !== before.dueDate) patch.dueDate = u.dueDate;
        if (u.assigneeIds && [...u.assigneeIds].sort().join() !== [...before.assigneeIds].sort().join()) patch.assigneeIds = u.assigneeIds;
        return Object.keys(patch).length ? [{ before, patch }] : [];
      });
      if (changes.length === 0 && newTasks.length === 0 && taskChanges.length === 0) {
        push({ role: "assistant", text: r.message || (extras.unsupported.length ? "" : "Nothing needed to change."), ...extras });
        return;
      }
      push({ role: "assistant", text: `${r.message}${r.summary.length ? "\n• " + r.summary.join("\n• ") : ""}${r.mode === "demo" ? "\n(demo mode)" : ""}`, ...extras });
      setPending({ next: r.config, changes, summary: r.summary, warnings: r.warnings, instruction, unsupported: extras.unsupported, suggestions: extras.suggestions, newTasks, taskChanges });
    } catch (e) {
      setError({ err: e instanceof ApiError ? e : new ApiError(String(e), "unknown"), stage: "edit", text: instruction });
    } finally {
      setBusy(null);
    }
  };

  /** Talk first: the AI answers, asks when unclear, or decides a change is ready. */
  const talk = async (history: ChatEntry[], forceDemo = isDemo) => {
    if (!active) return;
    setError(null);
    setBusy("chat");
    let instruction: string | undefined;
    try {
      const messages = history.filter((m) => m.text.trim()).slice(-12).map((m) => ({ role: m.role, content: m.text }));
      const r = await aiClient.chat({ mode: "workspace", messages, config: active.config, existingTasks: taskLines(active.data.tasks, active.config), forceDemo }, active.id);
      push({ role: "assistant", text: r.reply, suggestions: r.quickReplies, usage: r.usage ?? null });
      if (r.intent === "edit" && r.instruction) instruction = r.instruction;
    } catch (e) {
      const last = [...history].reverse().find((m) => m.role === "user")?.text ?? "";
      setError({ err: e instanceof ApiError ? e : new ApiError(String(e), "unknown"), stage: "chat", text: last });
    } finally {
      setBusy(null);
    }
    if (instruction) await runEdit(instruction, forceDemo);
  };

  const send = (text: string) => {
    if (!active || !text.trim() || busy) return;
    const entry: ChatEntry = { id: uid("m"), role: "user", text: text.trim(), at: nowISO() };
    const history = [...chat, entry];
    push({ role: "user", text: entry.text });
    setInput("");
    talk(history, isDemo);
  };

  const retry = (forceDemo: boolean) => {
    if (!error) return;
    if (error.stage === "edit") runEdit(error.text, forceDemo);
    else talk(chat, forceDemo);
  };

  const apply = () => {
    if (!pending || !active) return;
    if (pending.changes.length) actions.setConfig(pending.next, `AI edit: ${pending.instruction.slice(0, 80)}`);
    // tasks are data: added after the config so they can use any new people or statuses
    for (const t of pending.newTasks) {
      const { id: _id, createdAt: _c, updatedAt: _u, ...task } = seedToTask(t, pending.next);
      void _id; void _c; void _u;
      actions.addTask(task);
    }
    for (const c of pending.taskChanges) actions.updateTask(c.before.id, c.patch);
    toast.success("Changes applied");
    // carry the suggestions forward so the user can keep refining with one click
    push({ role: "assistant", text: "✓ Applied.", suggestions: pending.suggestions });
    setPending(null);
    router.push("/dashboard");
  };

  return (
    <aside className="fixed inset-0 z-30 flex flex-col border-l bg-card sm:static sm:z-auto sm:w-[380px] sm:shrink-0">
      <div className="flex h-12 shrink-0 items-center gap-2 border-b px-3">
        <Sparkles className="size-4 shrink-0 text-primary" />
        <span className="whitespace-nowrap text-sm font-semibold">AI Assistant</span>
        <button
          type="button"
          onClick={() => setPanelMode((m) => (m === "demo" ? "live" : "demo"))}
          className="ml-1 shrink-0 cursor-pointer"
          title={isDemo ? "Demo mode: free, 0 tokens. Click to switch to live DeepSeek AI" : "Live DeepSeek AI. Click to switch to free demo mode (0 tokens)"}
          aria-label={isDemo ? "Demo mode, click for live AI" : "Live AI, click for demo mode"}
        >
          <Badge color={live ? "green" : "amber"} className="whitespace-nowrap">
            {isDemo ? "⚡ Demo" : "🤖 Live"}
          </Badge>
        </button>
        <div className="flex-1" />
        <span className="hidden sm:inline-flex"><UsageTotalPill totals={totals.workspace} title="AI spend on this workspace" /></span>
        {active && chat.length > 0 && (
          <Button variant="ghost" size="iconSm" title="Clear conversation" aria-label="Clear conversation" onClick={() => { setChat([]); saveChat(active.id, []); }}>
            <Trash2 />
          </Button>
        )}
        <Button variant="ghost" size="iconSm" onClick={onClose} aria-label="Close assistant"><X /></Button>
      </div>

      {!active ? (
        <div className="flex flex-1 flex-col justify-center gap-3 p-5 text-sm">
          <p className="font-medium">No workspace yet</p>
          <p className="text-muted-foreground">Describe your work in বাংলা, Banglish or English on the generator page and I’ll build the dashboard.</p>
          <Button size="sm" onClick={() => router.push("/")}><Plus /> Open generator</Button>
        </div>
      ) : (
        <>
          <div className="flex-1 space-y-3 overflow-y-auto p-3 scrollbar-thin">
            <div className="rounded-lg bg-muted/60 p-3 text-xs text-muted-foreground">
              Working on <span className="font-medium text-foreground">{active.config.name}</span>. Ask me anything or tell me what you need, in any language. I’ll ask if something is unclear and show a preview before changing anything.
            </div>
            {chat.map((m, idx) => (
              <div key={m.id} className={cn("space-y-2", m.role === "user" ? "ml-auto max-w-[90%]" : "max-w-[95%]")}>
                {m.text && (
                  <div className={cn("whitespace-pre-wrap rounded-xl px-3 py-2 text-sm", m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted")}>{m.text}</div>
                )}
                {m.unsupported && m.unsupported.length > 0 && <UnsupportedNotice items={m.unsupported} lang={active.config.language} compact />}
                {m.role === "assistant" && m.usage && <UsageBadge usage={m.usage} />}
                {/* only the latest reply's suggestions stay clickable, so old chips don't pile up */}
                {m.suggestions && m.suggestions.length > 0 && idx === chat.length - 1 && (
                  <SuggestionChips items={m.suggestions} lang={active.config.language} disabled={!!busy} onPick={(s) => send(s)} />
                )}
              </div>
            ))}
            {busy === "chat" && (
              <div className="inline-flex items-center gap-1.5 rounded-xl bg-muted px-3 py-2 text-sm text-muted-foreground">
                <Loader2 className="size-3.5 animate-spin" /> Thinking…
              </div>
            )}
            {busy === "edit" && (
              <div className="rounded-xl border p-3">
                <GenerationProgress steps={EDIT_STEPS} running done={false} live={live} compact />
              </div>
            )}
            {error && (
              <div className="space-y-2 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
                <p className="font-medium">{error.err.message}</p>
                {error.err.details.length > 0 && <ul className="list-disc pl-4">{error.err.details.slice(0, 4).map((d, i) => <li key={i}>{d}</li>)}</ul>}
                {error.err.usage && <UsageBadge usage={error.err.usage} label="Spent on failed attempt:" />}
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => retry(false)}><RotateCcw /> Retry</Button>
                  {error.err.canFallback && <Button size="sm" variant="outline" onClick={() => retry(true)}>Use demo mode</Button>}
                </div>
              </div>
            )}
            <div ref={endRef} />
          </div>
          <div className="space-y-2 border-t p-3">
            {chat.length === 0 && (
              <div className="flex flex-wrap gap-1.5">
                {SAMPLE_EDITS.map((s) => (
                  <button key={s} onClick={() => setInput(s)} className="rounded-full border px-2.5 py-1 text-left text-[11px] text-muted-foreground hover:bg-muted">{s}</button>
                ))}
              </div>
            )}
            <form
              className="relative"
              onSubmit={(e) => {
                e.preventDefault();
                send(input);
              }}
            >
              <Textarea
                rows={3}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send(input);
                  }
                }}
                placeholder="Ask or tell me what you need…"
                className="resize-none pb-10 pr-11"
                disabled={!!busy}
              />
              <VoiceButton value={input} onChange={setInput} disabled={!!busy} className="absolute bottom-1.5 left-1.5" />
              <Button type="submit" size="iconSm" className="absolute bottom-2 right-2" disabled={!!busy || !input.trim()} aria-label="Send">
                {busy ? <Loader2 className="animate-spin" /> : <ArrowUp />}
              </Button>
            </form>
          </div>
          <ChangePreviewDialog
            open={!!pending}
            onOpenChange={(o) => !o && setPending(null)}
            workspace={active}
            next={pending?.next ?? null}
            changes={pending?.changes ?? []}
            summary={pending?.summary ?? []}
            warnings={pending?.warnings ?? []}
            unsupported={pending?.unsupported ?? []}
            newTasks={pending?.newTasks ?? []}
            taskChanges={pending?.taskChanges ?? []}
            onApply={apply}
          />
        </>
      )}
    </aside>
  );
}
