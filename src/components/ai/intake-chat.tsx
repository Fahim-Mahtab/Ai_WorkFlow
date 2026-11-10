"use client";
/**
 * Conversation before building: the AI asks about the work, team, data and
 * reports, one question at a time, then shows what it understood and offers
 * to build. Nothing is generated until the user says so.
 */
import { useEffect, useRef, useState } from "react";
import { ArrowUp, CheckCircle2, Hammer, Loader2, RotateCcw, Sparkles } from "lucide-react";
import { aiClient, ApiError, type ChatResult } from "@/lib/ai/client";
import type { UsageReport } from "@/lib/ai/pricing";
import { SAMPLE_PROMPTS } from "@/lib/workspace/demos";
import { Button } from "@/components/ui/button";
import { Card, Textarea } from "@/components/ui/primitives";
import { UsageBadge } from "./usage-badge";
import { VoiceButton } from "./voice-button";
import { cn } from "@/lib/utils";

export interface IntakeMessage {
  role: "user" | "assistant";
  text: string;
  quickReplies?: string[];
  intent?: ChatResult["intent"];
  brief?: string;
  usage?: UsageReport | null;
}

const KEY = "awp:v1:intake";
const load = (): IntakeMessage[] => {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]") as IntakeMessage[];
  } catch {
    return [];
  }
};
const save = (m: IntakeMessage[]) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(m.slice(-40)));
  } catch {
    /* storage full or blocked: the chat still works for this visit */
  }
};
export const clearIntake = () => {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
};

export function IntakeChat({
  disabled,
  forceDemo = true,
  onBuild,
}: {
  disabled?: boolean;
  forceDemo?: boolean;
  onBuild: (brief: string, transcript: IntakeMessage[]) => void;
}) {
  const [messages, setMessages] = useState<IntakeMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [brief, setBrief] = useState("");
  const scroller = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const m = load();
    setMessages(m);
    setBrief([...m].reverse().find((x) => x.role === "assistant")?.brief ?? "");
  }, []);
  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, busy]);

  const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");
  const ready = lastAssistant?.intent === "build" && !!lastAssistant.brief && messages[messages.length - 1] === lastAssistant;
  const userText = messages.filter((m) => m.role === "user").map((m) => m.text).join("\n");

  const talk = async (history: IntakeMessage[], demo = forceDemo) => {
    setBusy(true);
    setError(null);
    try {
      const r = await aiClient.chat({ mode: "intake", messages: history.map((m) => ({ role: m.role, content: m.text })), forceDemo: demo }, null);
      const next = [...history, { role: "assistant" as const, text: r.reply, quickReplies: r.quickReplies, intent: r.intent, brief: r.brief, usage: r.usage ?? null }];
      setMessages(next);
      save(next);
      if (r.intent === "build" && r.brief) setBrief(r.brief);
    } catch (e) {
      setError(e instanceof ApiError ? e : new ApiError(String(e), "unknown"));
    } finally {
      setBusy(false);
    }
  };

  const send = (text: string) => {
    if (!text.trim() || busy || disabled) return;
    const next = [...messages, { role: "user" as const, text: text.trim() }];
    setMessages(next);
    save(next);
    setInput("");
    talk(next, forceDemo);
  };

  const reset = () => {
    setMessages([]);
    setBrief("");
    setError(null);
    clearIntake();
    inputRef.current?.focus();
  };

  return (
    <Card className="overflow-hidden">
      <div ref={scroller} className="max-h-[52vh] space-y-3 overflow-y-auto p-4 scrollbar-thin sm:p-5">
        <Bubble role="assistant">
          Describe the work you want to manage. I&apos;ll assemble your workspace.
          <span className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="inline-block size-1.5 rounded-full bg-emerald-500 animate-pulse" />
            বাংলা · Banglish · English
          </span>
        </Bubble>
        {messages.map((m, i) => (
          <div key={i} className={cn("space-y-1.5", m.role === "user" && "flex flex-col items-end")}>
            <Bubble role={m.role}>{m.text}</Bubble>
            {m.role === "assistant" && <UsageBadge usage={m.usage} />}
            {/* when the summary card is up, its Build button replaces the chips */}
            {m.role === "assistant" && i === messages.length - 1 && !busy && !ready && !!m.quickReplies?.length && (
              <div className="flex flex-wrap gap-1.5">
                {m.quickReplies.map((q) => (
                  <button key={q} type="button" disabled={disabled} onClick={() => send(q)} className="rounded-full border border-primary/30 bg-accent px-3 py-1 text-xs text-accent-foreground hover:border-primary disabled:opacity-50">
                    {q}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
        {busy && (
          <Bubble role="assistant">
            <span className="inline-flex items-center gap-1.5 text-muted-foreground"><Loader2 className="size-3.5 animate-spin" /> Thinking…</span>
          </Bubble>
        )}
        {error && (
          <div className="space-y-2 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
            <p className="font-medium">{error.message}</p>
            {error.usage && <UsageBadge usage={error.usage} label="Spent on failed attempt:" />}
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => talk(messages)}><RotateCcw /> Retry</Button>
              {error.canFallback && <Button size="sm" variant="outline" onClick={() => talk(messages, true)}>Use demo mode</Button>}
            </div>
          </div>
        )}
        {ready && (
          <div className="space-y-2 rounded-xl border border-primary/30 bg-accent/50 p-3">
            <p className="flex items-center gap-1.5 text-sm font-medium"><CheckCircle2 className="size-4 text-primary" /> What I understood</p>
            <Textarea rows={5} value={brief} onChange={(e) => setBrief(e.target.value)} className="bg-card text-sm" aria-label="Workspace brief" />
            <div className="flex flex-wrap gap-2">
              <Button size="sm" disabled={disabled || !brief.trim()} onClick={() => onBuild(brief, messages)}><Hammer /> Build my workspace</Button>
              <Button size="sm" variant="outline" disabled={disabled} onClick={() => inputRef.current?.focus()}>Change something</Button>
            </div>
          </div>
        )}
      </div>

      <div className="space-y-2 border-t bg-muted/30 p-3 sm:px-5">
        {messages.length === 0 && (
          <div className="flex flex-wrap gap-1.5">
            {SAMPLE_PROMPTS.map((s) => (
              <button key={s.label} type="button" onClick={() => setInput(s.prompt)} className="rounded-full border bg-card px-3 py-1 text-xs hover:border-primary hover:bg-accent">
                <span className="text-muted-foreground">{s.lang} ·</span> {s.label}
              </button>
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
            ref={inputRef}
            rows={2}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send(input);
              }
            }}
            placeholder={messages.length ? "Type response or prompt…" : "Describe what you need in বাংলা, Banglish or English…"}
            className="resize-none bg-card/80 backdrop-blur-md pb-10 pr-11 transition-all focus:ring-2 focus:ring-primary/40"
            disabled={busy || disabled}
          />
          <VoiceButton value={input} onChange={setInput} disabled={busy || disabled} className="absolute bottom-1.5 left-1.5" />
          <Button type="submit" size="iconSm" className="absolute bottom-2.5 right-2.5 shadow-md shadow-primary/20 transition-transform active:scale-95" disabled={busy || disabled || !input.trim()} aria-label="Send">
            {busy ? <Loader2 className="animate-spin" /> : <ArrowUp />}
          </Button>
        </form>
        {messages.length > 0 && (
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            {!ready && (
              <button type="button" disabled={busy || disabled} onClick={() => onBuild(userText, messages)} className="inline-flex items-center gap-1.5 font-medium text-primary hover:underline disabled:opacity-50">
                <Sparkles className="size-3" /> Instant Build
              </button>
            )}
            <button type="button" disabled={busy || disabled} onClick={reset} className="inline-flex items-center gap-1 hover:text-foreground disabled:opacity-50">
              <RotateCcw className="size-3" /> Reset
            </button>
          </div>
        )}
      </div>
    </Card>
  );
}

function Bubble({ role, children }: { role: "user" | "assistant"; children: React.ReactNode }) {
  return (
    <div className={cn("w-fit max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2 text-sm", role === "user" ? "ml-auto rounded-br-md bg-primary text-primary-foreground" : "rounded-bl-md bg-muted")}>
      {children}
    </div>
  );
}
