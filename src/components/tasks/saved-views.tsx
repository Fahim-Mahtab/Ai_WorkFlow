"use client";
/**
 * Saved views bar: type (or say) what you want to see, e.g. "Nazmul er pending kaj" or
 * "urgent tasks due this week". It is understood in the browser, shown as chips to check,
 * and saved for one-click use. No AI tokens.
 */
import { useState } from "react";
import { Bookmark, Plus, X } from "lucide-react";
import type { Workspace } from "@/lib/config/types";
import { describeQuery, filterTasks, isEmptyQuery, makeView, parseViewText, type SavedView } from "@/lib/views/views";
import { useWorkspaceActions } from "@/lib/workspace/store";
import { VoiceButton } from "@/components/ai/voice-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

const EXAMPLES = ["Overdue kaj", "Urgent tasks due this week", "আজকের ডেডলাইন"];

export function SavedViews({ workspace, activeId, onSelect }: { workspace: Workspace; activeId: string | null; onSelect: (v: SavedView | null) => void }) {
  const actions = useWorkspaceActions(workspace.id);
  const views = workspace.views ?? [];
  const cfg = workspace.config;
  const [adding, setAdding] = useState(false);
  const [text, setText] = useState("");
  const query = parseViewText(text, cfg);
  const preview = describeQuery(query, cfg);
  const count = isEmptyQuery(query) ? 0 : filterTasks(workspace.data.tasks, query, cfg).length;
  const firstPerson = cfg.team.members[0]?.name;
  const examples = firstPerson ? [`${firstPerson} er pending kaj`, ...EXAMPLES] : EXAMPLES;

  const save = () => {
    if (isEmptyQuery(query)) return;
    const v = makeView(text, query);
    actions.setViews((vs) => [...vs, v]);
    onSelect(v);
    setText("");
    setAdding(false);
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1.5">
        <Bookmark className="size-4 text-muted-foreground" aria-hidden />
        <button onClick={() => onSelect(null)} className={cn("rounded-full border px-3 py-1 text-xs", !activeId ? "border-primary bg-accent font-medium text-accent-foreground" : "hover:bg-muted")}>All tasks</button>
        {views.map((v) => (
          <span key={v.id} className={cn("group inline-flex items-center rounded-full border text-xs", activeId === v.id ? "border-primary bg-accent font-medium text-accent-foreground" : "hover:bg-muted")}>
            <button onClick={() => onSelect(v)} className="py-1 pl-3 pr-1.5" title={describeQuery(v.query, cfg).join(" · ")}>
              {v.name} <span className="text-muted-foreground">{filterTasks(workspace.data.tasks, v.query, cfg).length}</span>
            </button>
            <button
              onClick={() => {
                actions.setViews((vs) => vs.filter((x) => x.id !== v.id));
                if (activeId === v.id) onSelect(null);
              }}
              className="mr-1 rounded-full p-0.5 text-muted-foreground opacity-60 hover:bg-background hover:opacity-100"
              aria-label={`Delete view ${v.name}`}
            >
              <X className="size-3" />
            </button>
          </span>
        ))}
        {!adding && (
          <Button variant="ghost" size="sm" className="h-7 rounded-full text-xs" onClick={() => setAdding(true)}><Plus /> New view</Button>
        )}
      </div>
      {adding && (
        <div className="space-y-2 rounded-xl border bg-card p-3">
          <div className="flex items-center gap-2">
            <div className="relative min-w-0 flex-1">
              <Input
                autoFocus
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") save();
                  if (e.key === "Escape") setAdding(false);
                }}
                placeholder="What do you want to see? e.g. Nazmul er pending kaj"
                className="pr-20"
                aria-label="Describe the view"
              />
              <VoiceButton value={text} onChange={setText} className="absolute right-1 top-1/2 -translate-y-1/2" />
            </div>
            <Button size="sm" onClick={save} disabled={isEmptyQuery(query)}>Save view</Button>
            <Button size="sm" variant="ghost" onClick={() => setAdding(false)}>Cancel</Button>
          </div>
          {text.trim() ? (
            preview.length ? (
              <p className="flex flex-wrap items-center gap-1.5 text-xs">
                <span className="text-muted-foreground">Shows:</span>
                {preview.map((p) => <span key={p} className="rounded-full bg-muted px-2 py-0.5">{p}</span>)}
                <span className="text-muted-foreground">· {count} task{count === 1 ? "" : "s"} now</span>
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">Name a person, a status ({cfg.taskStatuses.map((s) => s.label).join(", ")}), a priority (urgent, high, low), or a time (today, this week, overdue, pending).</p>
            )
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {examples.map((x) => (
                <button key={x} onClick={() => setText(x)} className="rounded-full border px-2.5 py-1 text-[11px] text-muted-foreground hover:bg-muted">{x}</button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
