"use client";
/** Calendar, activity feed, progress indicators and file/link attachments. */
import { useMemo, useState } from "react";
import { Activity as ActivityIcon, ChevronLeft, ChevronRight, ClipboardList, FileText, Link2, MessageSquare, Paperclip, Settings2, Trash2, Workflow, Zap } from "lucide-react";
import type { ActivityItem, WidgetOf } from "@/lib/config/types";
import { useEnv } from "@/components/dashboard/env";
import { getRows, getSource } from "@/lib/engine/sources";
import { applyDateRange, valueLabel } from "@/lib/engine/query";
import { useWorkspaceActions } from "@/lib/workspace/store";
import { Button } from "@/components/ui/button";
import { EmptyState, Input } from "@/components/ui/primitives";
import { Avatar } from "@/components/tasks/task-bits";
import { cn, formatNumber, relativeTime, todayISO } from "@/lib/utils";
import { useConfirm } from "@/components/ui/dialog";

/* ------------------------------ Calendar ------------------------------ */
export function CalendarWidget({ widget }: { widget: WidgetOf<"calendar"> }) {
  const { workspace, config, openTask } = useEnv();
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const source = getSource(config, widget.source);
  const items = useMemo(() => {
    const map = new Map<string, { id: string; title: string }[]>();
    for (const r of getRows(workspace, widget.source)) {
      const d = String(r[widget.dateField] ?? "").slice(0, 10);
      if (!d) continue;
      const titleField = source?.fields.find((f) => f.id === widget.titleField);
      const title = valueLabel(config, titleField, r[widget.titleField], widget.source);
      if (!map.has(d)) map.set(d, []);
      map.get(d)!.push({ id: r.id, title });
    }
    return map;
  }, [workspace, widget, source, config]);

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const startPad = (new Date(year, month, 1).getDay() + 6) % 7;
  const days = new Date(year, month + 1, 0).getDate();
  const cells = Array.from({ length: Math.ceil((startPad + days) / 7) * 7 }, (_, i) => {
    const day = i - startPad + 1;
    if (day < 1 || day > days) return null;
    return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  });
  const today = todayISO();

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{cursor.toLocaleDateString("en-US", { month: "long", year: "numeric" })}</span>
        <div className="flex gap-1">
          <Button variant="ghost" size="iconSm" onClick={() => setCursor(new Date(year, month - 1, 1))} aria-label="Previous month"><ChevronLeft /></Button>
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setCursor(new Date(new Date().getFullYear(), new Date().getMonth(), 1))}>Today</Button>
          <Button variant="ghost" size="iconSm" onClick={() => setCursor(new Date(year, month + 1, 1))} aria-label="Next month"><ChevronRight /></Button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-lg border bg-border text-xs">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
          <div key={d} className="bg-muted px-1.5 py-1 text-center font-medium text-muted-foreground">{d}</div>
        ))}
        {cells.map((iso, i) => {
          const list = iso ? items.get(iso) ?? [] : [];
          return (
            <div key={i} className={cn("min-h-16 bg-card p-1", !iso && "bg-muted/40")}>
              {iso && (
                <>
                  <div className={cn("mb-0.5 inline-flex size-5 items-center justify-center rounded-full text-[11px]", iso === today ? "bg-primary font-semibold text-primary-foreground" : "text-muted-foreground")}>{Number(iso.slice(8))}</div>
                  <div className="space-y-0.5">
                    {list.slice(0, 3).map((it) => (
                      <button
                        key={it.id}
                        onClick={() => widget.source === "tasks" && openTask(it.id)}
                        className="block w-full truncate rounded bg-accent px-1 py-0.5 text-left text-[10px] text-accent-foreground hover:opacity-80"
                        title={it.title}
                      >
                        {it.title}
                      </button>
                    ))}
                    {list.length > 3 && <div className="px-1 text-[10px] text-muted-foreground">+{list.length - 3}</div>}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---------------------------- Activity feed --------------------------- */
const ACT_ICON: Record<ActivityItem["kind"], React.ReactNode> = {
  task: <ClipboardList />,
  record: <FileText />,
  worklog: <Zap />,
  config: <Settings2 />,
  comment: <MessageSquare />,
  system: <ActivityIcon />,
  rule: <Workflow />,
};

export function ActivityWidget({ widget }: { widget: WidgetOf<"activity"> }) {
  const { workspace, t } = useEnv();
  const items = workspace.data.activity.slice(0, widget.limit ?? 10);
  if (!items.length) return <EmptyState icon={<ActivityIcon />} title={t("noActivity")} className="py-6" />;
  return (
    <ul className="space-y-2.5">
      {items.map((a) => (
        <li key={a.id} className="flex gap-2.5 text-sm">
          <span className="mt-0.5 rounded-md bg-muted p-1 text-muted-foreground [&_svg]:size-3.5">{ACT_ICON[a.kind]}</span>
          <div className="min-w-0 flex-1">
            <p className="leading-snug">{a.text}</p>
            <p className="text-[11px] text-muted-foreground">{relativeTime(a.at)}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}

/* ------------------------------ Progress ------------------------------ */
function Bar({ label, value, max, sub, lang }: { label: React.ReactNode; value: number; max: number; sub?: string; lang: "bn" | "en" | "banglish" }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="flex min-w-0 items-center gap-1.5 truncate">{label}</span>
        <span className="shrink-0 tabular-nums text-muted-foreground">{sub ?? `${formatNumber(Math.round(pct), lang)}%`}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-[var(--series-3)] transition-all" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function ProgressWidget({ widget }: { widget: WidgetOf<"progress"> }) {
  const { workspace, config, t } = useEnv();
  const lang = config.language;
  const source = getSource(config, widget.source);
  const doneIds = new Set(config.taskStatuses.filter((s) => s.isDone).map((s) => s.id));
  const rows = applyDateRange(getRows(workspace, widget.source), widget.dateRange, source?.kind === "worklogs" ? "date" : "createdAt");

  if (widget.mode === "completion") {
    const done = rows.filter((r) => doneIds.has(String(r.status))).length;
    const pct = rows.length ? Math.round((done / rows.length) * 100) : 0;
    return (
      <div className="flex items-center gap-5">
        <div className="relative size-24 shrink-0">
          <svg viewBox="0 0 36 36" className="size-24 -rotate-90">
            <circle cx="18" cy="18" r="15.5" fill="none" stroke="var(--muted)" strokeWidth="3.5" />
            <circle cx="18" cy="18" r="15.5" fill="none" stroke="var(--series-3)" strokeWidth="3.5" strokeLinecap="round" strokeDasharray={`${(pct / 100) * 97.4} 97.4`} />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-lg font-semibold tabular-nums">{formatNumber(pct, lang)}%</span>
        </div>
        <div className="space-y-1 text-sm">
          <p><span className="font-semibold tabular-nums">{formatNumber(done, lang)}</span> <span className="text-muted-foreground">{t("of")} {formatNumber(rows.length, lang)} {t("done")}</span></p>
          {config.taskStatuses.filter((s) => !s.isDone).map((s) => (
            <p key={s.id} className="text-xs text-muted-foreground">{s.label}: {formatNumber(rows.filter((r) => r.status === s.id).length, lang)}</p>
          ))}
        </div>
      </div>
    );
  }

  if (widget.mode === "target") {
    const target = widget.target ?? 100;
    return (
      <div className="space-y-3">
        <div className="flex items-baseline gap-1.5">
          <span className="text-2xl font-semibold tabular-nums">{formatNumber(rows.length, lang)}</span>
          <span className="text-sm text-muted-foreground">/ {formatNumber(target, lang)} {t("target")}</span>
        </div>
        <Bar label={source?.label} value={rows.length} max={target} lang={lang} />
      </div>
    );
  }

  // byMember
  const memberKey = widget.source === "tasks" ? "assignees" : widget.source === "worklogs" ? "memberId" : "createdBy";
  const stats = config.team.members
    .map((m) => {
      const mine = rows.filter((r) => {
        const v = r[memberKey];
        return Array.isArray(v) ? v.includes(m.id) : v === m.id;
      });
      const done = widget.source === "tasks" ? mine.filter((r) => doneIds.has(String(r.status))).length : mine.length;
      return { m, total: mine.length, done };
    })
    .filter((s) => s.total > 0 || widget.source !== "tasks")
    .sort((a, b) => b.total - a.total);
  const max = Math.max(1, ...stats.map((s) => s.total));
  if (!stats.length) return <EmptyState title={t("noData")} className="py-6" />;
  return (
    <div className="max-h-64 space-y-2.5 overflow-y-auto pr-1 scrollbar-thin">
      {stats.map(({ m, total, done }) => (
        <Bar
          key={m.id}
          lang={lang}
          label={<><Avatar member={m} size={18} /> <span className="truncate">{m.name}</span></>}
          value={widget.source === "tasks" ? done : total}
          max={widget.source === "tasks" ? Math.max(1, total) : widget.target ?? max}
          sub={widget.source === "tasks" ? `${formatNumber(done, lang)}/${formatNumber(total, lang)}` : formatNumber(total, lang)}
        />
      ))}
    </div>
  );
}

/* ----------------------------- Attachments ---------------------------- */
export function AttachmentsWidget({ widget }: { widget: WidgetOf<"attachments"> }) {
  const { workspace, readOnly, t, openTask } = useEnv();
  const actions = useWorkspaceActions(workspace.id);
  const confirm = useConfirm();
  const [form, setForm] = useState({ label: "", url: "" });
  const own = workspace.data.attachments.filter((a) => !a.widgetId || a.widgetId === widget.id);
  const fromTasks = workspace.data.tasks.flatMap((task) => task.links.map((l) => ({ ...l, taskId: task.id, taskTitle: task.title })));

  return (
    <div className="space-y-3">
      {own.length + fromTasks.length === 0 && <EmptyState icon={<Paperclip />} title={t("noData")} className="py-4" />}
      <ul className="space-y-1.5">
        {own.map((a) => (
          <li key={a.id} className="group flex items-center gap-2 text-sm">
            {a.kind === "file" ? <FileText className="size-3.5 shrink-0 text-muted-foreground" /> : <Link2 className="size-3.5 shrink-0 text-muted-foreground" />}
            {a.kind === "link" ? <a href={a.url} target="_blank" rel="noopener noreferrer" className="min-w-0 flex-1 truncate text-primary hover:underline">{a.label}</a> : <span className="min-w-0 flex-1 truncate">{a.label} <span className="text-xs text-muted-foreground">(reference)</span></span>}
            {!readOnly && (
              <button className="opacity-0 group-hover:opacity-100" aria-label={t("delete")} onClick={async () => (await confirm({ title: "Remove attachment?", destructive: true, confirmLabel: "Remove" })) && actions.removeAttachment(a.id)}>
                <Trash2 className="size-3.5 text-muted-foreground" />
              </button>
            )}
          </li>
        ))}
        {fromTasks.slice(0, 6).map((l) => (
          <li key={l.id} className="flex items-center gap-2 text-sm">
            <Paperclip className="size-3.5 shrink-0 text-muted-foreground" />
            <span className="min-w-0 flex-1 truncate">{l.label}</span>
            <button className="truncate text-xs text-muted-foreground hover:underline" onClick={() => openTask(l.taskId)}>{l.taskTitle}</button>
          </li>
        ))}
      </ul>
      {!readOnly && (
        <div className="flex flex-wrap gap-2">
          <Input className="h-8 w-28 flex-1" placeholder="Label" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} />
          <Input className="h-8 min-w-32 flex-[2]" placeholder="https://…" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} />
          <Button size="sm" variant="outline" disabled={!/^https?:\/\//.test(form.url)} onClick={() => { actions.addAttachment({ label: form.label || form.url, url: form.url, kind: "link", widgetId: widget.id }); setForm({ label: "", url: "" }); }}>
            <Link2 /> {t("addLink")}
          </Button>
          <label className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-md border px-3 text-xs font-medium hover:bg-muted">
            <FileText className="size-3.5" /> {t("attachFile")}
            <input type="file" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) actions.addAttachment({ label: f.name, url: `file://${f.name}`, kind: "file", size: f.size, widgetId: widget.id }); e.target.value = ""; }} />
          </label>
        </div>
      )}
    </div>
  );
}
