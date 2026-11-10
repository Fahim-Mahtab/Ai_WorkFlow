"use client";
/**
 * Automations: rules written in plain Bangla / Banglish / English. The AI turns the sentence into
 * "When … if … then …"; you check it and save. Or build one yourself with the dropdowns (no AI).
 */
import { useState } from "react";
import { toast } from "sonner";
import { ArrowRight, Loader2, Plus, Sparkles, Trash2, Workflow, X, Zap } from "lucide-react";
import { PageHeader, RequireWorkspace } from "@/components/layout/page-header";
import { useWorkspaceActions } from "@/lib/workspace/store";
import { aiClient, ApiError } from "@/lib/ai/client";
import { describeAction, describeConditions, describeTrigger, newRule, sanitizeRule, type Rule, type RuleAction, type RuleTrigger } from "@/lib/automation/rules";
import type { PriorityId, Workspace, WorkspaceConfig } from "@/lib/config/types";
import { VoiceButton } from "@/components/ai/voice-button";
import { UsageBadge } from "@/components/ai/usage-badge";
import { Button } from "@/components/ui/button";
import { Badge, Card, EmptyState, Input, NativeSelect, Textarea } from "@/components/ui/primitives";
import { useConfirm } from "@/components/ui/dialog";
import { cn, relativeTime } from "@/lib/utils";
import type { UsageReport } from "@/lib/ai/pricing";

type Draft = Omit<Rule, "id" | "createdAt" | "enabled" | "runs">;

const EXAMPLES = [
  "Deadline par hoye gele priority urgent koro ar notify koro",
  "Review e gele Fahim ke assign koro",
  "ডেডলাইনের ২ দিন আগে মনে করিয়ে দাও",
  "When all checklist items are done, move the task to Review",
];

function RuleSummary({ rule, cfg }: { rule: Draft; cfg: WorkspaceConfig }) {
  const conds = describeConditions(rule.conditions, cfg);
  return (
    <div className="space-y-1 text-sm">
      <p><span className="mr-1.5 rounded bg-blue-500/10 px-1.5 py-0.5 text-xs font-semibold text-blue-600 dark:text-blue-400">WHEN</span>{describeTrigger(rule.trigger, cfg)}</p>
      {conds.length > 0 && <p><span className="mr-1.5 rounded bg-amber-500/10 px-1.5 py-0.5 text-xs font-semibold text-amber-600 dark:text-amber-400">IF</span>{conds.join(" and ")}</p>}
      <p><span className="mr-1.5 rounded bg-emerald-500/10 px-1.5 py-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">THEN</span>{rule.actions.map((a) => describeAction(a, cfg)).join(", then ")}</p>
    </div>
  );
}

/* ------------------------------ manual builder (no AI) ------------------------------ */

type TriggerKind = RuleTrigger["type"];
type ActionKind = RuleAction["type"];

const TRIGGERS: { id: TriggerKind; label: string }[] = [
  { id: "overdue", label: "A deadline is missed" },
  { id: "due_soon", label: "A deadline is near" },
  { id: "status_changed", label: "A task moves to a status" },
  { id: "task_created", label: "A task is created" },
  { id: "assignee_changed", label: "A task is reassigned" },
  { id: "priority_changed", label: "Priority changes" },
  { id: "subtasks_done", label: "All checklist items are done" },
];
const ACTIONS: { id: ActionKind; label: string }[] = [
  { id: "set_priority", label: "Set priority" },
  { id: "set_status", label: "Move to status" },
  { id: "assign", label: "Assign a person" },
  { id: "notify", label: "Notify (in the app)" },
  { id: "add_comment", label: "Add a comment" },
  { id: "add_subtasks", label: "Add checklist items" },
  { id: "set_due_in_days", label: "Set deadline in N days" },
];
const PRIORITIES: PriorityId[] = ["low", "medium", "high", "urgent"];

function Builder({ cfg, onDone }: { cfg: WorkspaceConfig; onDone: (d: Draft) => void }) {
  const [trigger, setTrigger] = useState<TriggerKind>("overdue");
  const [tStatus, setTStatus] = useState(cfg.taskStatuses[1]?.id ?? cfg.taskStatuses[0].id);
  const [days, setDays] = useState(2);
  const [who, setWho] = useState("");
  const [prio, setPrio] = useState<"" | PriorityId>("");
  const [actions, setActions] = useState<{ kind: ActionKind; value: string }[]>([{ kind: "set_priority", value: "urgent" }]);

  const defaultValue = (k: ActionKind) =>
    k === "set_priority" ? "urgent" : k === "set_status" ? cfg.taskStatuses[0].id : k === "assign" ? cfg.team.members[0]?.id ?? "" : k === "set_due_in_days" ? "3" : "";

  const build = () => {
    const tr: RuleTrigger =
      trigger === "status_changed" ? { type: trigger, to: tStatus } : trigger === "due_soon" ? { type: trigger, days } : ({ type: trigger } as RuleTrigger);
    const acts: RuleAction[] = actions.flatMap((a): RuleAction[] => {
      const v = a.value.trim();
      switch (a.kind) {
        case "set_priority": return [{ type: a.kind, priority: (v || "urgent") as PriorityId }];
        case "set_status": return v ? [{ type: a.kind, status: v }] : [];
        case "assign": return v ? [{ type: a.kind, memberIds: [v], mode: "add" }] : [];
        case "notify":
        case "add_comment": return v ? [{ type: a.kind, text: v }] : [];
        case "add_subtasks": { const items = v.split(",").map((s) => s.trim()).filter(Boolean); return items.length ? [{ type: a.kind, items }] : []; }
        case "set_due_in_days": return [{ type: a.kind, days: Math.max(0, Number(v) || 0) }];
      }
    });
    if (!acts.length) return toast.error("Fill in at least one action.");
    const draft = {
      name: `When ${describeTrigger(tr, cfg)}, ${acts.map((a) => describeAction(a, cfg)).join(", ")}`,
      trigger: tr,
      conditions: who || prio ? { ...(who ? { assigneeIds: [who] } : {}), ...(prio ? { priorities: [prio] } : {}) } : undefined,
      actions: acts,
    };
    const clean = sanitizeRule(draft, cfg);
    if (!clean) return toast.error("That rule points to something that doesn't exist.");
    onDone(clean);
  };

  return (
    <div className="space-y-3 text-sm">
      <div className="grid gap-2 sm:grid-cols-[5rem_1fr] sm:items-center">
        <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">WHEN</span>
        <div className="flex flex-wrap gap-2">
          <NativeSelect value={trigger} onChange={(e) => setTrigger(e.target.value as TriggerKind)} className="w-full sm:w-60" aria-label="Trigger">
            {TRIGGERS.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
          </NativeSelect>
          {trigger === "status_changed" && (
            <NativeSelect value={tStatus} onChange={(e) => setTStatus(e.target.value)} className="w-full sm:w-40" aria-label="Status">
              {cfg.taskStatuses.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </NativeSelect>
          )}
          {trigger === "due_soon" && (
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              within <Input type="number" min={0} max={30} value={days} onChange={(e) => setDays(Math.max(0, Math.min(30, Number(e.target.value) || 0)))} className="h-9 w-16" aria-label="Days" /> days
            </span>
          )}
        </div>
        <span className="text-xs font-semibold text-amber-600 dark:text-amber-400">IF <span className="font-normal text-muted-foreground">(optional)</span></span>
        <div className="flex flex-wrap gap-2">
          <NativeSelect value={who} onChange={(e) => setWho(e.target.value)} className="w-full sm:w-44" aria-label="Only for person">
            <option value="">Anyone</option>
            {cfg.team.members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </NativeSelect>
          <NativeSelect value={prio} onChange={(e) => setPrio(e.target.value as "" | PriorityId)} className="w-full sm:w-40" aria-label="Only for priority">
            <option value="">Any priority</option>
            {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
          </NativeSelect>
        </div>
        <span className="self-start pt-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400">THEN</span>
        <div className="space-y-2">
          {actions.map((a, i) => (
            <div key={i} className="flex flex-wrap items-center gap-2">
              <NativeSelect value={a.kind} onChange={(e) => { const kind = e.target.value as ActionKind; setActions((as) => as.map((x, j) => (j === i ? { kind, value: defaultValue(kind) } : x))); }} className="w-full sm:w-52" aria-label="Action">
                {ACTIONS.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
              </NativeSelect>
              {a.kind === "set_priority" || a.kind === "set_status" || a.kind === "assign" ? (
                <NativeSelect value={a.value} onChange={(e) => setActions((as) => as.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))} className="w-full sm:w-44" aria-label="Value">
                  {a.kind === "set_priority" && PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
                  {a.kind === "set_status" && cfg.taskStatuses.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                  {a.kind === "assign" && cfg.team.members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                </NativeSelect>
              ) : (
                <Input
                  value={a.value}
                  type={a.kind === "set_due_in_days" ? "number" : "text"}
                  onChange={(e) => setActions((as) => as.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))}
                  placeholder={a.kind === "add_subtasks" ? "Item 1, Item 2" : a.kind === "set_due_in_days" ? "Days" : "Text"}
                  className="h-9 min-w-0 flex-1 sm:max-w-64"
                  aria-label="Value"
                />
              )}
              {actions.length > 1 && (
                <Button variant="ghost" size="iconSm" onClick={() => setActions((as) => as.filter((_, j) => j !== i))} aria-label="Remove action"><X /></Button>
              )}
            </div>
          ))}
          {actions.length < 4 && (
            <Button variant="ghost" size="sm" onClick={() => setActions((as) => [...as, { kind: "notify", value: "" }])}><Plus /> Another action</Button>
          )}
        </div>
      </div>
      <Button size="sm" onClick={build}>Preview rule</Button>
    </div>
  );
}

/* ---------------------------------------- page ---------------------------------------- */

function AutomationsView({ workspace }: { workspace: Workspace }) {
  const cfg = workspace.config;
  const rules = workspace.rules ?? [];
  const actions = useWorkspaceActions(workspace.id);
  const confirm = useConfirm();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [note, setNote] = useState("");
  const [usage, setUsage] = useState<UsageReport | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [manual, setManual] = useState(false);
  const log = workspace.data.activity.filter((a) => a.kind === "rule").slice(0, 8);

  const ask = async (forceDemo = false) => {
    if (!text.trim()) return;
    setBusy(true);
    setError(null);
    setDraft(null);
    setNote("");
    try {
      const r = await aiClient.rule({ text: text.trim(), config: cfg, forceDemo }, workspace.id);
      setUsage(r.usage);
      setDraft(r.rule ? { ...r.rule, name: text.trim().slice(0, 200) } : null);
      setNote(r.message);
    } catch (e) {
      setError(e instanceof ApiError ? e : new ApiError(String(e), "unknown"));
    } finally {
      setBusy(false);
    }
  };

  const save = () => {
    if (!draft) return;
    actions.setRules((rs) => [newRule(draft), ...rs]);
    actions.log(`Automation added: ${draft.name}`, "config");
    toast.success("Automation is on");
    setDraft(null);
    setText("");
    setNote("");
    setManual(false);
  };

  return (
    <div className="mx-auto max-w-5xl space-y-5 px-4 py-6 sm:px-6">
      <PageHeader
        title="Automations"
        description="Tell it a rule in your own words. It runs by itself on every task change and checks deadlines every minute."
      />

      <Card className="space-y-3 p-4 sm:p-5">
        <div className="relative">
          <Textarea
            rows={2}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                ask();
              }
            }}
            placeholder="e.g. Deadline par hoye gele priority urgent koro"
            className="resize-none pb-10"
            disabled={busy}
            aria-label="Describe the rule"
          />
          <VoiceButton value={text} onChange={setText} disabled={busy} className="absolute bottom-1.5 left-1.5" />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {EXAMPLES.map((x) => (
            <button key={x} type="button" title={x} onClick={() => setText(x)} className="max-w-full truncate rounded-full border px-2.5 py-1 text-[11px] text-muted-foreground hover:border-primary hover:bg-accent hover:text-accent-foreground">{x}</button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" onClick={() => ask()} disabled={busy || !text.trim()}>
            {busy ? <Loader2 className="animate-spin" /> : <Sparkles />} Make rule
          </Button>
          <Button size="sm" variant="ghost" onClick={() => { setManual((m) => !m); setDraft(null); }}>
            {manual ? "Hide builder" : "Build it yourself"}
          </Button>
          <UsageBadge usage={usage ?? error?.usage} />
        </div>
        {error && (
          <div className="rounded-md border border-destructive/30 bg-destructive/5 p-2.5 text-xs text-destructive">
            {error.message}
            {error.canFallback && <Button variant="link" size="sm" className="h-auto px-1 text-xs" onClick={() => ask(true)}>Try demo mode</Button>}
          </div>
        )}
        {!draft && note && <p className="rounded-md bg-muted px-3 py-2 text-sm">{note}</p>}
        {manual && !draft && (
          <div className="rounded-xl border p-3">
            <Builder cfg={cfg} onDone={(d) => setDraft(d)} />
          </div>
        )}
        {draft && (
          <div className="space-y-3 rounded-xl border border-primary/30 bg-accent/40 p-3">
            <p className="flex items-center gap-1.5 text-sm font-medium"><Zap className="size-4 text-primary" /> Check the rule</p>
            <RuleSummary rule={draft} cfg={cfg} />
            {note && <p className="text-xs text-muted-foreground">{note}</p>}
            <div className="flex gap-2">
              <Button size="sm" onClick={save}>Turn it on</Button>
              <Button size="sm" variant="outline" onClick={() => setDraft(null)}>Discard</Button>
            </div>
          </div>
        )}
      </Card>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold">Your rules ({rules.length})</h2>
        {rules.length === 0 ? (
          <EmptyState icon={<Workflow />} title="No rules yet" description="Write one above, for example: Review e gele Fahim ke assign koro." />
        ) : (
          <div className="space-y-2">
            {rules.map((r) => (
              <Card key={r.id} className={cn("flex flex-col gap-3 p-4 sm:flex-row sm:items-start", !r.enabled && "opacity-60")}>
                <div className="min-w-0 flex-1 space-y-2">
                  <p className="font-medium">{r.name}</p>
                  <RuleSummary rule={r} cfg={cfg} />
                  <p className="text-xs text-muted-foreground">Ran {r.runs ?? 0} time{r.runs === 1 ? "" : "s"} · added {relativeTime(r.createdAt)}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <label className="flex cursor-pointer items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      role="switch"
                      checked={r.enabled}
                      onChange={(e) => actions.setRules((rs) => rs.map((x) => (x.id === r.id ? { ...x, enabled: e.target.checked } : x)))}
                      className="peer sr-only"
                    />
                    <span className="relative h-5 w-9 rounded-full bg-muted transition-colors after:absolute after:left-0.5 after:top-0.5 after:size-4 after:rounded-full after:bg-white after:shadow after:transition-transform peer-checked:bg-primary peer-checked:after:translate-x-4 peer-focus-visible:ring-2 peer-focus-visible:ring-primary/40" />
                    {r.enabled ? "On" : "Off"}
                  </label>
                  <Button
                    variant="ghost"
                    size="iconSm"
                    aria-label="Delete rule"
                    onClick={async () => {
                      if (await confirm({ title: "Delete this rule?", description: r.name, confirmLabel: "Delete", destructive: true })) actions.setRules((rs) => rs.filter((x) => x.id !== r.id));
                    }}
                  >
                    <Trash2 />
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>

      {log.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold">What rules did recently</h2>
          <Card className="divide-y">
            {log.map((a) => (
              <div key={a.id} className="flex items-start gap-2 px-4 py-2 text-sm">
                <ArrowRight className="mt-0.5 size-3.5 shrink-0 text-primary" />
                <span className="min-w-0 flex-1">{a.text}</span>
                <span className="shrink-0 text-xs text-muted-foreground">{relativeTime(a.at)}</span>
              </div>
            ))}
          </Card>
        </section>
      )}
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><Badge color="slate">note</Badge> Rules change tasks inside this workspace and post notifications in the bell. They can&apos;t send SMS or email.</p>
    </div>
  );
}

export default function AutomationsPage() {
  return <RequireWorkspace>{(ws) => <AutomationsView key={ws.id} workspace={ws} />}</RequireWorkspace>;
}
