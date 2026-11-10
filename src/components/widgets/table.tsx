"use client";
/** Generic data table for any source: search, sort, paginate, add/edit/delete. */
import { useMemo, useState } from "react";
import { ArrowDownUp, Pencil, Plus, Search, Trash2 } from "lucide-react";
import type { FieldValue, FlatRow, WidgetOf } from "@/lib/config/types";
import { useEnv } from "@/components/dashboard/env";
import { getRows, getSource } from "@/lib/engine/sources";
import { applyFilter, valueLabel } from "@/lib/engine/query";
import { Button } from "@/components/ui/button";
import { EmptyState, Input } from "@/components/ui/primitives";
import { Dialog, DialogBody, DialogContent, DialogHeader, useConfirm } from "@/components/ui/dialog";
import { RecordForm } from "@/components/fields/record-form";
import { useWorkspaceActions } from "@/lib/workspace/store";
import { AssigneeStack, PriorityBadge, StatusBadge } from "@/components/tasks/task-bits";
import { Table2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PriorityId } from "@/lib/config/types";

export function TableWidget({ widget }: { widget: WidgetOf<"table"> }) {
  const { workspace, config, readOnly, t, openTask, newTask } = useEnv();
  const actions = useWorkspaceActions(workspace.id);
  const confirm = useConfirm();
  const source = getSource(config, widget.source);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<{ key: string; dir: 1 | -1 } | null>(null);
  const [page, setPage] = useState(0);
  const [editing, setEditing] = useState<{ open: boolean; row?: FlatRow }>({ open: false });
  const pageSize = widget.pageSize ?? 8;

  const cols = useMemo(() => widget.columns.map((id) => source?.fields.find((f) => f.id === id)).filter((f) => !!f), [widget.columns, source]);
  const rows = useMemo(() => {
    let r = applyFilter(getRows(workspace, widget.source), widget.filter);
    if (q.trim()) {
      const needle = q.toLowerCase();
      r = r.filter((row) => cols.some((c) => valueLabel(config, c, row[c.id], widget.source).toLowerCase().includes(needle)));
    }
    if (sort) {
      r = [...r].sort((a, b) => {
        const av = a[sort.key];
        const bv = b[sort.key];
        if (typeof av === "number" && typeof bv === "number") return (av - bv) * sort.dir;
        return String(av ?? "").localeCompare(String(bv ?? "")) * sort.dir;
      });
    } else if (widget.source !== "tasks") {
      r = [...r].sort((a, b) => String(b.createdAt ?? "").localeCompare(String(a.createdAt ?? "")));
    }
    return r;
  }, [workspace, widget.source, widget.filter, q, sort, cols, config]);

  if (!source) return <EmptyState title="Unknown data source" />;
  const pages = Math.max(1, Math.ceil(rows.length / pageSize));
  const current = Math.min(page, pages - 1);
  const visible = rows.slice(current * pageSize, current * pageSize + pageSize);
  const collection = config.collections.find((c) => c.id === widget.source);

  const renderCell = (row: FlatRow, fieldId: string) => {
    const field = source.fields.find((f) => f.id === fieldId);
    const v = row[fieldId];
    if (widget.source === "tasks") {
      if (fieldId === "status") return <StatusBadge config={config} status={String(v)} />;
      if (fieldId === "priority") return <PriorityBadge config={config} priority={v as PriorityId} />;
      if (fieldId === "assignees") return <AssigneeStack config={config} ids={(v as string[]) ?? []} />;
    }
    if (field?.type === "url" && v) return <a href={String(v)} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline" onClick={(e) => e.stopPropagation()}>{String(v)}</a>;
    return <span className={cn(field?.type === "textarea" && "line-clamp-2")}>{valueLabel(config, field, v as FieldValue, widget.source)}</span>;
  };

  const canAdd = !readOnly && (widget.source === "tasks" || !!collection);

  return (
    <div className="flex h-full flex-col gap-2">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} placeholder={t("search")} className="h-8 pl-8 text-xs" />
        </div>
        {canAdd && (
          <Button size="sm" variant="outline" onClick={() => (widget.source === "tasks" ? newTask() : setEditing({ open: true }))}>
            <Plus /> {widget.source === "tasks" ? t("addTask") : t("addRow")}
          </Button>
        )}
      </div>
      {rows.length === 0 ? (
        <EmptyState icon={<Table2 />} title={t("noData")} className="py-6" />
      ) : (
        <div className="-mx-1 overflow-x-auto scrollbar-thin">
          <table className="w-full min-w-max text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                {cols.map((c) => (
                  <th key={c.id} className="px-2 py-2 font-medium">
                    <button className="inline-flex items-center gap-1 hover:text-foreground" onClick={() => setSort((s) => (s?.key === c.id ? { key: c.id, dir: s.dir === 1 ? -1 : 1 } : { key: c.id, dir: 1 }))}>
                      {c.label}
                      <ArrowDownUp className={cn("size-3", sort?.key === c.id ? "opacity-100" : "opacity-30")} />
                    </button>
                  </th>
                ))}
                {!readOnly && widget.source !== "tasks" && <th className="w-16" />}
              </tr>
            </thead>
            <tbody>
              {visible.map((row) => (
                <tr
                  key={row.id}
                  className={cn("group border-b last:border-0 hover:bg-muted/50", widget.source === "tasks" && "cursor-pointer")}
                  onClick={() => widget.source === "tasks" && openTask(row.id)}
                >
                  {cols.map((c) => (
                    <td key={c.id} className="max-w-[260px] px-2 py-2 align-top">{renderCell(row, c.id)}</td>
                  ))}
                  {!readOnly && widget.source !== "tasks" && (
                    <td className="px-1 py-1.5 text-right whitespace-nowrap">
                      {collection && (
                        <Button variant="ghost" size="iconSm" aria-label={t("edit")} onClick={() => setEditing({ open: true, row })}>
                          <Pencil />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="iconSm"
                        aria-label={t("delete")}
                        onClick={async () => {
                          if (!(await confirm({ title: "Delete this entry?", description: "This cannot be undone.", destructive: true, confirmLabel: "Delete" }))) return;
                          if (widget.source === "worklogs") actions.deleteWorklog(row.id);
                          else actions.deleteRecord(widget.source, row.id);
                        }}
                      >
                        <Trash2 />
                      </Button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {rows.length > pageSize && (
        <div className="mt-auto flex items-center justify-between pt-1 text-xs text-muted-foreground">
          <span>
            {t("showing")} {current * pageSize + 1}–{Math.min(rows.length, (current + 1) * pageSize)} {t("of")} {rows.length}
          </span>
          <div className="flex gap-1">
            <Button size="sm" variant="ghost" disabled={current === 0} onClick={() => setPage(current - 1)}>{t("prev")}</Button>
            <Button size="sm" variant="ghost" disabled={current >= pages - 1} onClick={() => setPage(current + 1)}>{t("next")}</Button>
          </div>
        </div>
      )}
      {collection && (
        <Dialog open={editing.open} onOpenChange={(open) => setEditing((s) => ({ ...s, open }))}>
          <DialogContent size="lg">
            <DialogHeader title={editing.row ? `${t("edit")} · ${collection.name}` : `${t("addRow")} · ${collection.name}`} />
            <DialogBody>
              <RecordForm
                key={editing.row?.id ?? "new"}
                fields={collection.fields}
                members={config.team.members}
                lang={config.language}
                initial={editing.row ? Object.fromEntries(collection.fields.map((f) => [f.id, editing.row![f.id]])) : undefined}
                askCreatedBy={!editing.row}
                submitLabel={t("save")}
                onCancel={() => setEditing({ open: false })}
                onSubmit={(values, createdBy) => {
                  if (editing.row) actions.updateRecord(collection.id, editing.row.id, values);
                  else actions.addRecord(collection.id, values, createdBy);
                  setEditing({ open: false });
                }}
              />
            </DialogBody>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
