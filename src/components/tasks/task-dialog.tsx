"use client";
/** Full task editor: status, priority, multi-assignees, deadline, custom fields, subtasks, comments, links/files. */
import { useEffect, useState } from "react";
import { CheckCircle2, Circle, FileText, Link2, MessageSquare, Paperclip, Plus, Trash2, X } from "lucide-react";
import type { FieldValue, LinkRef, PriorityId, Task, Workspace } from "@/lib/config/types";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, useConfirm } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge, Checkbox, Input, Label, NativeSelect, Textarea } from "@/components/ui/primitives";
import { FieldInput } from "@/components/fields/field-input";
import { makeT } from "@/lib/i18n";
import { cn, nowISO, relativeTime, uid } from "@/lib/utils";

interface Props {
  workspace: Workspace;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  task?: Task | null;
  defaults?: Partial<Task>;
  readOnly?: boolean;
  onSave: (task: Partial<Task> & { title: string }, existingId?: string) => void;
  onDelete?: (id: string) => void;
}

type Draft = Omit<Task, "id" | "createdAt" | "updatedAt">;

function emptyDraft(ws: Workspace, defaults?: Partial<Task>): Draft {
  return {
    title: "",
    description: "",
    status: ws.config.taskStatuses[0]?.id ?? "todo",
    priority: "medium",
    assigneeIds: [],
    subtasks: [],
    comments: [],
    links: [],
    custom: {},
    kind: "assigned",
    ...defaults,
  };
}

export function TaskDialog({ workspace, open, onOpenChange, task, defaults, readOnly, onSave, onDelete }: Props) {
  const { config } = workspace;
  const t = makeT(config.language);
  const confirm = useConfirm();
  const [draft, setDraft] = useState<Draft>(() => (task ? { ...task } : emptyDraft(workspace, defaults)));
  const [newSub, setNewSub] = useState("");
  const [comment, setComment] = useState("");
  const [commentAs, setCommentAs] = useState(config.team.members[0]?.id ?? "");
  const [link, setLink] = useState({ label: "", url: "" });
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setDraft(task ? { ...task } : emptyDraft(workspace, defaults));
      setError("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, task?.id]);

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => ({ ...d, [k]: v }));
  const doneStatus = config.taskStatuses.find((s) => s.isDone)?.id;
  const isDone = config.taskStatuses.find((s) => s.id === draft.status)?.isDone;
  const subDone = draft.subtasks.filter((s) => s.done).length;

  const save = () => {
    if (!draft.title.trim()) {
      setError(`${t("title")} ${t("required")}`);
      return;
    }
    onSave({ ...draft, title: draft.title.trim() }, task?.id);
    onOpenChange(false);
  };

  const addLink = (l: Omit<LinkRef, "id">) => set("links", [...draft.links, { ...l, id: uid("l") }]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader title={task ? (config.language === "bn" ? "কাজের বিস্তারিত" : "Task details") : t("addTask")} />
        <DialogBody className="space-y-4">
          <div className="space-y-1">
            <Input autoFocus={!task} placeholder={t("title")} value={draft.title} disabled={readOnly} onChange={(e) => set("title", e.target.value)} className={cn("h-10 text-base font-medium", error && "border-destructive")} />
            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1">
              <Label>{t("status")}</Label>
              <NativeSelect value={draft.status} disabled={readOnly} onChange={(e) => set("status", e.target.value)}>
                {config.taskStatuses.map((s) => (
                  <option key={s.id} value={s.id}>{s.label}</option>
                ))}
              </NativeSelect>
            </div>
            <div className="space-y-1">
              <Label>{t("priority")}</Label>
              <NativeSelect value={draft.priority} disabled={readOnly} onChange={(e) => set("priority", e.target.value as PriorityId)}>
                {config.priorities.map((p) => (
                  <option key={p.id} value={p.id}>{p.label}</option>
                ))}
              </NativeSelect>
            </div>
            <div className="space-y-1">
              <Label>{t("dueDate")}</Label>
              <Input type="date" disabled={readOnly} value={draft.dueDate ?? ""} onChange={(e) => set("dueDate", e.target.value || undefined)} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>{t("assignees")}</Label>
            <div className="flex flex-wrap gap-1.5">
              {config.team.members.map((m) => {
                const on = draft.assigneeIds.includes(m.id);
                return (
                  <button key={m.id} type="button" disabled={readOnly} onClick={() => set("assigneeIds", on ? draft.assigneeIds.filter((x) => x !== m.id) : [...draft.assigneeIds, m.id])} className={cn("rounded-full border px-2.5 py-1 text-xs transition-colors", on ? "border-primary bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-muted")}>
                    {m.name}
                  </button>
                );
              })}
              {config.team.members.length === 0 && <span className="text-xs text-muted-foreground">No team members yet — add them in Team.</span>}
            </div>
          </div>

          <div className="space-y-1">
            <Label>{t("description")}</Label>
            <Textarea rows={3} disabled={readOnly} value={draft.description ?? ""} onChange={(e) => set("description", e.target.value)} />
          </div>

          {config.taskFields.length > 0 && (
            <div className="grid gap-3 sm:grid-cols-2">
              {config.taskFields.map((f) => (
                <div key={f.id} className="space-y-1">
                  <Label>{f.label}</Label>
                  <FieldInput field={f} value={draft.custom[f.id]} disabled={readOnly} onChange={(v: FieldValue) => set("custom", { ...draft.custom, [f.id]: v })} members={config.team.members} lang={config.language} />
                </div>
              ))}
            </div>
          )}

          {/* Subtasks */}
          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-1.5">
                <CheckCircle2 className="size-3.5" /> Subtasks {draft.subtasks.length > 0 && `(${subDone}/${draft.subtasks.length})`}
              </Label>
            </div>
            {draft.subtasks.length > 0 && (
              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-[var(--series-3)] transition-all" style={{ width: `${(subDone / draft.subtasks.length) * 100}%` }} />
              </div>
            )}
            <ul className="space-y-1">
              {draft.subtasks.map((s) => (
                <li key={s.id} className="group flex items-center gap-2 rounded-md px-1 py-0.5 hover:bg-muted/60">
                  <Checkbox checked={s.done} disabled={readOnly} onChange={() => set("subtasks", draft.subtasks.map((x) => (x.id === s.id ? { ...x, done: !x.done } : x)))} />
                  <span className={cn("flex-1 text-sm", s.done && "text-muted-foreground line-through")}>{s.title}</span>
                  {!readOnly && (
                    <button type="button" className="opacity-0 group-hover:opacity-100" onClick={() => set("subtasks", draft.subtasks.filter((x) => x.id !== s.id))} aria-label="Remove subtask">
                      <X className="size-3.5 text-muted-foreground" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
            {!readOnly && (
              <form
                className="flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!newSub.trim()) return;
                  set("subtasks", [...draft.subtasks, { id: uid("st"), title: newSub.trim(), done: false }]);
                  setNewSub("");
                }}
              >
                <Input placeholder="Add a subtask…" value={newSub} onChange={(e) => setNewSub(e.target.value)} className="h-8" />
                <Button type="submit" size="sm" variant="outline">
                  <Plus /> {t("add")}
                </Button>
              </form>
            )}
          </section>

          {/* Links & files */}
          <section className="space-y-2">
            <Label className="flex items-center gap-1.5">
              <Paperclip className="size-3.5" /> {t("attachments")}
            </Label>
            <ul className="space-y-1">
              {draft.links.map((l) => (
                <li key={l.id} className="flex items-center gap-2 text-sm">
                  {l.kind === "file" ? <FileText className="size-3.5 text-muted-foreground" /> : <Link2 className="size-3.5 text-muted-foreground" />}
                  {l.kind === "link" ? (
                    <a href={l.url} target="_blank" rel="noopener noreferrer" className="truncate text-primary hover:underline">{l.label || l.url}</a>
                  ) : (
                    <span className="truncate">{l.label} {l.size ? <span className="text-xs text-muted-foreground">({Math.ceil(l.size / 1024)} KB, reference only)</span> : null}</span>
                  )}
                  {!readOnly && (
                    <button type="button" onClick={() => set("links", draft.links.filter((x) => x.id !== l.id))} aria-label="Remove">
                      <X className="size-3.5 text-muted-foreground" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
            {!readOnly && (
              <div className="flex flex-wrap gap-2">
                <Input placeholder="Label" value={link.label} onChange={(e) => setLink({ ...link, label: e.target.value })} className="h-8 w-32" />
                <Input placeholder="https://…" value={link.url} onChange={(e) => setLink({ ...link, url: e.target.value })} className="h-8 min-w-40 flex-1" />
                <Button
                  size="sm"
                  variant="outline"
                  type="button"
                  disabled={!/^https?:\/\//.test(link.url)}
                  onClick={() => {
                    addLink({ label: link.label || link.url, url: link.url, kind: "link" });
                    setLink({ label: "", url: "" });
                  }}
                >
                  <Link2 /> {t("addLink")}
                </Button>
                <label className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-md border px-3 text-xs font-medium hover:bg-muted">
                  <FileText className="size-3.5" /> {t("attachFile")}
                  <input
                    type="file"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) addLink({ label: f.name, url: `file://${f.name}`, kind: "file", size: f.size });
                      e.target.value = "";
                    }}
                  />
                </label>
              </div>
            )}
          </section>

          {/* Comments */}
          <section className="space-y-2">
            <Label className="flex items-center gap-1.5">
              <MessageSquare className="size-3.5" /> Comments ({draft.comments.length})
            </Label>
            <ul className="space-y-2">
              {draft.comments.map((c) => (
                <li key={c.id} className="rounded-lg bg-muted/60 px-3 py-2 text-sm">
                  <div className="mb-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">{c.author}</span>
                    {relativeTime(c.createdAt)}
                  </div>
                  {c.text}
                </li>
              ))}
            </ul>
            {!readOnly && (
              <div className="flex flex-col gap-2 sm:flex-row">
                <NativeSelect value={commentAs} onChange={(e) => setCommentAs(e.target.value)} className="h-8 sm:w-40">
                  {config.team.members.map((m) => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                  {config.team.members.length === 0 && <option value="">Me</option>}
                </NativeSelect>
                <Input placeholder="Write a comment…" value={comment} onChange={(e) => setComment(e.target.value)} className="h-8 flex-1" onKeyDown={(e) => {
                  if (e.key === "Enter" && comment.trim()) {
                    e.preventDefault();
                    set("comments", [...draft.comments, { id: uid("c"), author: config.team.members.find((m) => m.id === commentAs)?.name ?? "Me", text: comment.trim(), createdAt: nowISO() }]);
                    setComment("");
                  }
                }} />
              </div>
            )}
          </section>
          {task && (
            <p className="text-xs text-muted-foreground">
              <Badge color={task.kind === "self" ? "violet" : "slate"}>{task.kind === "self" ? t("selfReported") : t("assigned")}</Badge>{" "}
              · created {relativeTime(task.createdAt)} · updated {relativeTime(task.updatedAt)}
            </p>
          )}
        </DialogBody>
        {!readOnly && (
          <DialogFooter className="justify-between sm:justify-between">
            <div className="flex gap-2">
              {task && onDelete && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive"
                  onClick={async () => {
                    if (await confirm({ title: "Delete this task?", description: `"${task.title}" and its subtasks/comments will be removed.`, destructive: true, confirmLabel: "Delete" })) {
                      onDelete(task.id);
                      onOpenChange(false);
                    }
                  }}
                >
                  <Trash2 /> {t("delete")}
                </Button>
              )}
              {doneStatus && (
                <Button variant="outline" size="sm" onClick={() => set("status", isDone ? config.taskStatuses[0].id : doneStatus)}>
                  {isDone ? <Circle /> : <CheckCircle2 />} {isDone ? "Reopen" : "Mark complete"}
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>{t("cancel")}</Button>
              <Button size="sm" onClick={save}>{t("save")}</Button>
            </div>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
