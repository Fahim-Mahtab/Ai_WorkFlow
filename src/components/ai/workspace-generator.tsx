"use client";
/**
 * The AI Workspace Generator:
 * prompt → pipeline progress → (clarification) → analysis + live dashboard preview → user approval → saved workspace.
 */
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle, ArrowRight, CheckCircle2, RotateCcw } from "lucide-react";
import { aiClient, ApiError, type GenerateResult } from "@/lib/ai/client";
import { LANGUAGE_LABEL } from "@/lib/ai/language";
import { createWorkspace } from "@/lib/workspace/factory";
import { useStore } from "@/lib/workspace/store";
import { useAssistant } from "@/components/layout/providers";
import { Button } from "@/components/ui/button";
import { Badge, Card, Textarea } from "@/components/ui/primitives";
import { DashboardCanvas } from "@/components/dashboard/dashboard-canvas";
import { WorkspaceEnv } from "@/components/tasks/task-dialog-host";
import { GENERATE_STEPS, GenerationProgress } from "./generation-progress";
import { clearIntake, IntakeChat, type IntakeMessage } from "./intake-chat";
import { SuggestionChips, UnsupportedNotice } from "./capability-notice";
import { UsageBadge } from "./usage-badge";
import { finalizeTeam, TeamSetup } from "./team-setup";
import { attachPendingUsage } from "@/lib/storage/usage";
import { saveChat } from "@/lib/storage/local";
import { cn, nowISO, uid } from "@/lib/utils";

type Phase = "idle" | "running" | "clarify" | "preview" | "error";

export function WorkspaceGenerator() {
  const router = useRouter();
  const { addWorkspace } = useStore();
  const { status, ask } = useAssistant();
  const [transcript, setTranscript] = useState<IntakeMessage[]>([]);
  const [phase, setPhase] = useState<Phase>("idle");
  const [result, setResult] = useState<GenerateResult | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [answers, setAnswers] = useState<string[]>([]);
  const [usedPrompt, setUsedPrompt] = useState("");
  const [isDoneAnimating, setIsDoneAnimating] = useState(false);
  const live = status?.mode === "live";

  const [generatorMode, setGeneratorMode] = useState<"demo" | "live">("demo");
  const isDemo = generatorMode === "demo";

  const run = async (p: string, opts: { forceDemo?: boolean; forceGenerate?: boolean } = {}) => {
    if (!p.trim()) return;
    setPhase("running");
    setError(null);
    setUsedPrompt(p);
    const finalForceDemo = opts.forceDemo !== undefined ? opts.forceDemo : isDemo;
    try {
      const r = await aiClient.generate({ prompt: p, ...opts, forceDemo: finalForceDemo });
      setResult(r);
      if (r.needsClarification || !r.config) {
        setAnswers(r.questions.map(() => ""));
        setPhase("clarify");
      } else {
        setIsDoneAnimating(true);
        setTimeout(() => {
          setIsDoneAnimating(false);
          setPhase("preview");
        }, 1200);
      }
    } catch (e) {
      setError(e instanceof ApiError ? e : new ApiError(String(e), "unknown"));
      setPhase("error");
    }
  };

  const preview = useMemo(() => (result?.config ? createWorkspace(result.config, { prompt: usedPrompt }) : null), [result, usedPrompt]);

  const setTeam = (team: NonNullable<GenerateResult["config"]>["team"]) =>
    setResult((r) => (r?.config ? { ...r, config: { ...r.config, team } } : r));

  const approve = () => {
    if (!result?.config) return;
    const ws = createWorkspace({ ...result.config, team: finalizeTeam(result.config.team) }, { prompt: usedPrompt });
    addWorkspace(ws);
    // the generation cost now belongs to this workspace, and is the first entry of its AI log
    attachPendingUsage(ws.id);
    // the conversation that led here becomes the start of the workspace's AI chat
    const intro = transcript.length ? transcript.map((m) => ({ id: uid("m"), role: m.role, text: m.text, at: nowISO(), usage: m.usage ?? null })) : [{ id: uid("m"), role: "user" as const, text: usedPrompt, at: nowISO() }];
    saveChat(ws.id, [...intro, { id: uid("m"), role: "assistant", text: result.message || `Workspace “${ws.config.name}” generated.`, at: nowISO(), usage: result.usage ?? null }]);
    clearIntake();
    toast.success(`Workspace “${ws.config.name}” created`);
    router.push("/dashboard");
  };

  // the team box answers "who is on the team?", so don't repeat that question
  const followUps = (result?.questions ?? []).filter((q) => !/team|টিম|member|সদস্য|কারা|who\b|names?\b|nam\b/i.test(q));

  const withAnswers = () => {
    const extra = result!.questions.map((q, i) => (answers[i]?.trim() ? `${q} → ${answers[i].trim()}` : "")).filter(Boolean).join("\n");
    run(`${usedPrompt}\n\n${extra}`, { forceDemo: isDemo, forceGenerate: true });
  };

  return (
    <div className="space-y-6">
      {/* Provider Mode Switcher: Free Demo (0 Tokens) vs Live DeepSeek API */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-[#090e18]/80 px-4 py-3 backdrop-blur-xl">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-gray-300">Engine Mode:</span>
          <div className="inline-flex rounded-full border border-white/10 bg-black/40 p-1">
            <button
              type="button"
              onClick={() => setGeneratorMode("demo")}
              className={cn(
                "flex items-center gap-1.5 rounded-full px-3.5 py-1 text-xs font-semibold transition-all",
                isDemo
                  ? "bg-cyan-500/20 text-cyan-300 shadow-[0_0_15px_rgba(34,211,238,0.3)] border border-cyan-400/40"
                  : "text-gray-400 hover:text-white"
              )}
            >
              <span>⚡ Free Demo (0 Tokens)</span>
            </button>
            <button
              type="button"
              onClick={() => setGeneratorMode("live")}
              className={cn(
                "flex items-center gap-1.5 rounded-full px-3.5 py-1 text-xs font-semibold transition-all",
                !isDemo
                  ? "bg-amber-500/20 text-amber-300 shadow-[0_0_15px_rgba(245,158,11,0.3)] border border-amber-400/40"
                  : "text-gray-400 hover:text-white"
              )}
            >
              <span>🤖 Live DeepSeek API</span>
            </button>
          </div>
        </div>

        <div className="text-xs">
          {isDemo ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-cyan-500/30 bg-cyan-950/40 px-3 py-1 font-medium text-cyan-300">
              <span className="size-1.5 rounded-full bg-cyan-400 animate-pulse" />
              Safe Test Mode: Uses local dummy engine · 0 API tokens charged
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-950/40 px-3 py-1 font-medium text-amber-300">
              <span className="size-1.5 rounded-full bg-amber-400 animate-pulse" />
              Live Mode: Requests consume tokens from your DeepSeek account
            </span>
          )}
        </div>
      </div>

      <IntakeChat
        disabled={phase === "running"}
        forceDemo={isDemo}
        onBuild={(brief, t) => {
          setTranscript(t);
          run(brief, { forceDemo: isDemo, forceGenerate: true });
        }}
      />

      {(phase === "running" || isDoneAnimating) && (
        <div className="card-3d rounded-2xl border border-primary/30 bg-card/90 p-5 shadow-2xl backdrop-blur-2xl">
          <GenerationProgress steps={GENERATE_STEPS} running={!isDoneAnimating} done={isDoneAnimating} live={live} />
        </div>
      )}

      {phase === "error" && error && (
        <Card className="space-y-3 border-destructive/40 p-5">
          <p className="flex items-center gap-2 font-medium text-destructive"><AlertTriangle className="size-4" /> {error.message}</p>
          {error.details.length > 0 && (
            <ul className="list-disc pl-5 text-xs text-muted-foreground">{error.details.slice(0, 6).map((d, i) => <li key={i}>{d}</li>)}</ul>
          )}
          <UsageBadge usage={error.usage} label="Spent on failed attempt:" />
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => run(usedPrompt)}><RotateCcw /> Retry</Button>
            {error.canFallback && <Button size="sm" variant="outline" onClick={() => run(usedPrompt, { forceDemo: true })}>Use demo generator</Button>}
          </div>
        </Card>
      )}

      {phase === "clarify" && result && (
        <Card className="space-y-4 p-5">
          <div>
            <p className="font-medium">{result.message || "A few questions first"}</p>
            <p className="text-xs text-muted-foreground">Answer what you can — or generate with sensible assumptions.</p>
          </div>
          <UnsupportedNotice items={result.unsupported ?? []} lang={result.language} />
          <UsageBadge usage={result.usage} />
          {result.questions.map((q, i) => (
            <div key={i} className="space-y-1">
              <p className="text-sm">{q}</p>
              <Textarea rows={2} value={answers[i] ?? ""} onChange={(e) => setAnswers((a) => a.map((x, j) => (j === i ? e.target.value : x)))} />
            </div>
          ))}
          <div className="flex gap-2">
            <Button size="sm" onClick={withAnswers}><ArrowRight /> Generate with answers</Button>
            <Button size="sm" variant="outline" onClick={() => run(usedPrompt, { forceGenerate: true })}>Generate anyway</Button>
          </div>
        </Card>
      )}

      {phase === "preview" && result?.config && preview && (
        <div className="space-y-4">
          <Card className="space-y-4 p-5">
            <div className="flex flex-wrap items-start gap-3">
              <CheckCircle2 className="mt-0.5 size-5 text-[var(--series-3)]" />
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{result.config.name}</p>
                <p className="text-sm text-muted-foreground">{result.message}</p>
              </div>
              <Badge color={result.mode === "live" ? "green" : "amber"}>{result.mode === "live" ? "Generated by AI" : "Demo generator"}</Badge>
            </div>
            <UsageBadge usage={result.usage} label="This generation:" />
            <TeamSetup team={result.config.team} lang={result.language} onChange={setTeam} />
            {result.analysis && (
              <details className="group rounded-lg border px-3 py-2">
              <summary className="cursor-pointer text-xs font-medium text-muted-foreground">AI analysis</summary>
              <div className="mt-3 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
                <Info title="Language" items={[LANGUAGE_LABEL[result.language]]} />
                <Info title="Business context" items={[result.analysis.businessContext]} />
                <Info title="Users & roles" items={result.analysis.roles} />
                <Info title="Sections" items={result.analysis.sections} />
                <Info title="Data fields" items={result.analysis.dataFields} />
                <Info title="Tasks" items={result.analysis.tasks} />
                <Info title="Deadlines & priorities" items={result.analysis.deadlinesAndPriorities ? [result.analysis.deadlinesAndPriorities] : []} />
                <Info title="Suggested reports" items={result.analysis.suggestedReports} />
              </div>
              </details>
            )}
            <UnsupportedNotice items={result.unsupported ?? []} lang={result.language} />
            <SuggestionChips
              items={result.suggestions ?? []}
              lang={result.language}
              label={result.language === "bn" ? "তৈরির পর এগুলো যোগ করতে পারেন (ক্লিক করলে ওয়ার্কস্পেস তৈরি হবে এবং নির্দেশনাটি AI Assistant-এ প্রস্তুত থাকবে)" : "Next steps — click to create the workspace with this instruction ready in the AI Assistant"}
              onPick={(s) => {
                approve();
                ask(s);
              }}
            />
            {followUps.length > 0 && (
              <div className="rounded-lg bg-muted/60 p-3 text-xs">
                <p className="mb-1 font-medium">Optional follow-ups (ask the AI Assistant later)</p>
                <ul className="list-disc pl-4 text-muted-foreground">{followUps.map((q, i) => <li key={i}>{q}</li>)}</ul>
              </div>
            )}
            {result.warnings.length > 0 && (
              <details className="text-xs text-muted-foreground">
                <summary className="cursor-pointer">{result.warnings.length} auto-fixes applied by the registry validator</summary>
                <ul className="mt-1 list-disc pl-4">{result.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>
              </details>
            )}
            <div className="flex flex-wrap items-center gap-2 border-t pt-4">
              <p className="mr-auto text-xs text-muted-foreground">
                {result.config.pages.length} pages · {result.config.pages.reduce((n, p) => n + p.widgets.length, 0)} widgets · {result.config.team.members.length} members · {result.config.collections.length} forms
              </p>
              <Button variant="outline" size="sm" onClick={() => run(usedPrompt)}><RotateCcw /> Regenerate</Button>
              <Button size="sm" onClick={approve}><CheckCircle2 /> Approve & create workspace</Button>
            </div>
          </Card>
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Preview — rendered from JSON by the component registry</p>
            <div className="rounded-xl border border-dashed p-3 sm:p-4">
              <WorkspaceEnv workspace={preview} readOnly>
                <DashboardCanvas workspace={preview} readOnly />
              </WorkspaceEnv>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Info({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <div className="space-y-1">
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{title}</p>
      <p className="text-sm leading-snug">{items.slice(0, 8).join(" · ")}</p>
    </div>
  );
}
