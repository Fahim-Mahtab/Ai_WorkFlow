"use client";
/**
 * Self-reported work: employee writes free text (Bangla/Banglish/English),
 * AI extracts separate entries, the user reviews/edits, then saves.
 */
import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Sparkles, Trash2 } from "lucide-react";
import type { WorkEntry, Workspace } from "@/lib/config/types";
import { aiClient, ApiError, type UsageReport } from "@/lib/ai/client";
import { UsageBadge } from "@/components/ai/usage-badge";
import { useWorkspaceActions } from "@/lib/workspace/store";
import { Button } from "@/components/ui/button";
import { Badge, Checkbox, Input, NativeSelect, Textarea } from "@/components/ui/primitives";
import { makeT } from "@/lib/i18n";
import { todayISO } from "@/lib/utils";
import { WORKLOG_SAMPLES } from "@/lib/workspace/demos";

export function WorklogComposer({ workspace, readOnly, showSamples }: { workspace: Workspace; readOnly?: boolean; showSamples?: boolean }) {
  const { config } = workspace;
  const t = makeT(config.language);
  const actions = useWorkspaceActions(workspace.id);
  const [memberId, setMemberId] = useState(config.team.members[0]?.id ?? "");
  const [date, setDate] = useState(todayISO());
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [entries, setEntries] = useState<WorkEntry[] | null>(null);
  const [mode, setMode] = useState<"live" | "demo" | null>(null);
  const [asTasks, setAsTasks] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [usage, setUsage] = useState<UsageReport | null>(null);

  const extract = async (forceDemo = false) => {
    if (!text.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const r = await aiClient.worklog({ text, forceDemo }, workspace.id);
      setEntries(r.entries);
      setMode(r.mode);
      setUsage(r.usage ?? null);
      if (!r.entries.length) toast.info(r.message || "No entries found");
    } catch (e) {
      setError(e instanceof ApiError ? e : new ApiError(String(e), "unknown"));
    } finally {
      setLoading(false);
    }
  };

  const save = () => {
    if (!entries?.length) return;
    actions.addWorklogs(entries.map((e) => ({ memberId: memberId || undefined, date, description: e.description, category: e.category, hours: e.hours, status: e.status ?? "done" })));
    if (asTasks) {
      const doneId = config.taskStatuses.find((s) => s.isDone)?.id ?? config.taskStatuses[0].id;
      const openId = config.taskStatuses.find((s) => !s.isDone && s.id !== config.taskStatuses[0].id)?.id ?? config.taskStatuses[0].id;
      for (const e of entries) actions.addTask({ title: e.description, kind: "self", status: e.status === "in_progress" ? openId : doneId, assigneeIds: memberId ? [memberId] : [], dueDate: date });
    }
    toast.success(`${entries.length} ${config.language === "bn" ? "টি এন্ট্রি সংরক্ষিত" : "entries saved"}`);
    setEntries(null);
    setText("");
  };

  const update = (i: number, patch: Partial<WorkEntry>) => setEntries((es) => es!.map((e, j) => (j === i ? { ...e, ...patch } : e)));

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row">
        <NativeSelect value={memberId} onChange={(e) => setMemberId(e.target.value)} disabled={readOnly} className="sm:w-48" aria-label={t("member")}>
          {config.team.members.map((m) => (
            <option key={m.id} value={m.id}>{m.name}</option>
          ))}
          {config.team.members.length === 0 && <option value="">—</option>}
        </NativeSelect>
        <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} disabled={readOnly} className="sm:w-40" aria-label={t("date")} />
      </div>
      <Textarea rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder={t("describeWork")} disabled={readOnly || loading} />
      {showSamples && !readOnly && (
        <div className="flex flex-wrap gap-1.5">
          {WORKLOG_SAMPLES.map((s) => (
            <button key={s} onClick={() => setText(s)} className="max-w-full truncate rounded-full border px-2.5 py-1 text-[11px] text-muted-foreground hover:bg-muted">{s}</button>
          ))}
        </div>
      )}
      <div className="flex items-center gap-2">
        <Button size="sm" onClick={() => extract()} disabled={readOnly || loading || !text.trim()}>
          {loading ? <Loader2 className="animate-spin" /> : <Sparkles />} {t("extract")}
        </Button>
        {mode && <Badge color={mode === "live" ? "green" : "amber"}>{mode === "live" ? "AI" : "Demo mode"}</Badge>}
        <UsageBadge usage={usage ?? error?.usage} />
      </div>
      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 p-2.5 text-xs text-destructive">
          {error.message}
          {error.canFallback && (
            <Button variant="link" size="sm" className="h-auto px-1 text-xs" onClick={() => extract(true)}>Use demo extractor</Button>
          )}
        </div>
      )}
      {entries && entries.length > 0 && (
        <div className="space-y-2 rounded-lg border bg-muted/30 p-2.5">
          <p className="text-xs font-medium text-muted-foreground">Review {entries.length} extracted entries</p>
          {entries.map((e, i) => (
            <div key={i} className="grid grid-cols-[1fr_auto] gap-1.5 rounded-md bg-card p-2 sm:grid-cols-[1fr_110px_64px_110px_auto]">
              <Input className="h-8 text-sm" value={e.description} onChange={(ev) => update(i, { description: ev.target.value })} />
              <Input className="h-8 text-xs max-sm:hidden" placeholder={t("category")} value={e.category ?? ""} onChange={(ev) => update(i, { category: ev.target.value || undefined })} />
              <Input className="h-8 text-xs max-sm:hidden" type="number" min={0} max={24} step={0.5} placeholder="h" value={e.hours ?? ""} onChange={(ev) => update(i, { hours: ev.target.value ? Number(ev.target.value) : undefined })} />
              <NativeSelect className="h-8 text-xs max-sm:hidden" value={e.status ?? "done"} onChange={(ev) => update(i, { status: ev.target.value as "done" | "in_progress" })}>
                <option value="done">Done</option>
                <option value="in_progress">In progress</option>
              </NativeSelect>
              <Button variant="ghost" size="iconSm" onClick={() => setEntries((es) => es!.filter((_, j) => j !== i))} aria-label={t("delete")}><Trash2 /></Button>
            </div>
          ))}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <Checkbox checked={asTasks} onChange={(e) => setAsTasks(e.target.checked)} /> Also add as self-reported tasks
            </label>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setEntries(null)}>{t("cancel")}</Button>
              <Button size="sm" onClick={save}>{t("save")}</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
