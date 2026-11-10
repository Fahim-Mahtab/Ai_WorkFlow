"use client";
/** No-code editor for a single widget's configuration (title, size, source, columns, grouping, filters, form fields…). */
import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import { toast } from "sonner";
import type { Collection, FieldDef, Filter, Widget, WorkspaceConfig } from "@/lib/config/types";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox, Input, Label, NativeSelect } from "@/components/ui/primitives";
import { CATALOG, sourceOptions } from "@/lib/registry/catalog";
import { getSource } from "@/lib/engine/sources";
import { validateConfig } from "@/lib/config/validate";
import { FieldsEditor, finalizeFieldIds } from "./collection-fields-editor";

interface Props {
  config: WorkspaceConfig;
  widget: Widget | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSave: (config: WorkspaceConfig) => void;
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

export function WidgetSettingsDialog({ config, widget, open, onOpenChange, onSave }: Props) {
  const [draft, setDraft] = useState<Widget | null>(widget);
  const [formFields, setFormFields] = useState<FieldDef[] | null>(null);

  useEffect(() => {
    if (open && widget) {
      setDraft(widget);
      setFormFields(widget.type === "form" ? config.collections.find((c) => c.id === widget.collectionId)?.fields ?? null : null);
    }
  }, [open, widget, config.collections]);

  if (!draft) return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const set = (patch: Record<string, unknown>) => setDraft((d) => ({ ...(d as any), ...patch }) as Widget);
  const entry = CATALOG[draft.type];
  const src = "source" in draft ? getSource(config, draft.source) : draft.type === "kanban" || draft.type === "taskList" ? getSource(config, "tasks") : undefined;
  const fields = src?.fields ?? [];
  const numberFields = fields.filter((f) => f.type === "number");
  const dateFields = fields.filter((f) => f.type === "date");
  const hasFilter = "filter" in draft || ["metric", "table", "kanban", "taskList", "barChart", "lineChart", "pieChart"].includes(draft.type);
  const filter = (draft as { filter?: Filter }).filter;

  const save = () => {
    let next: WorkspaceConfig = {
      ...config,
      pages: config.pages.map((p) => ({ ...p, widgets: p.widgets.map((w) => (w.id === draft.id ? draft : w)) })),
    };
    if (draft.type === "form" && formFields) {
      const col = config.collections.find((c) => c.id === draft.collectionId);
      if (col) {
        const finalFields = finalizeFieldIds(formFields, ["createdAt", "createdBy", "id"]);
        next = { ...next, collections: next.collections.map((c): Collection => (c.id === col.id ? { ...c, fields: finalFields } : c)) };
      }
    }
    const v = validateConfig(next);
    if (!v.ok) {
      toast.error("Invalid settings: " + v.errors.slice(0, 2).join("; "));
      return;
    }
    v.warnings.forEach((w) => toast.warning(w));
    onSave(v.config!);
    onOpenChange(false);
  };

  const sourceSelect = "source" in draft && (
    <Row label="Data source">
      <NativeSelect
        value={draft.source}
        onChange={(e) => {
          const s = getSource(config, e.target.value)!;
          const firstCat = s.id === "tasks" ? "status" : s.fields.find((f) => f.type === "select" || f.type === "member")?.id ?? s.fields[0].id;
          set({
            source: e.target.value,
            filter: undefined,
            ...(draft.type === "table" ? { columns: s.fields.slice(0, 5).map((f) => f.id) } : {}),
            ...("groupBy" in draft ? { groupBy: firstCat } : {}),
            ...("dateField" in draft ? { dateField: s.kind === "worklogs" ? "date" : s.id === "tasks" && draft.type === "calendar" ? "dueDate" : "createdAt" } : {}),
            ...("titleField" in draft ? { titleField: s.fields.find((f) => f.type === "text")?.id ?? s.fields[0].id } : {}),
          });
        }}
      >
        {sourceOptions(config, entry.sourceKind === "tasks" ? "tasks" : "any").map((s) => (
          <option key={s.id} value={s.id}>{s.label}</option>
        ))}
      </NativeSelect>
    </Row>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader title={`Edit widget · ${entry.label}`} description="Changes are validated against the component registry before saving." />
        <DialogBody className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-[1fr_140px]">
            <Row label="Title">
              <Input value={draft.title} onChange={(e) => set({ title: e.target.value })} />
            </Row>
            <Row label="Width">
              <NativeSelect value={draft.width} onChange={(e) => set({ width: Number(e.target.value) })}>
                <option value={1}>¼ — small</option>
                <option value={2}>½ — half</option>
                <option value={3}>¾ — wide</option>
                <option value={4}>Full width</option>
              </NativeSelect>
            </Row>
          </div>
          <Row label="Description (optional)">
            <Input value={draft.description ?? ""} onChange={(e) => set({ description: e.target.value || undefined })} />
          </Row>

          <div className="grid gap-3 sm:grid-cols-2">
            {sourceSelect}

            {(draft.type === "metric" || draft.type === "barChart" || draft.type === "lineChart" || draft.type === "pieChart") && (
              <Row label="Aggregate">
                <NativeSelect value={draft.aggregate} onChange={(e) => set({ aggregate: e.target.value })}>
                  <option value="count">Count of items</option>
                  <option value="sum" disabled={!numberFields.length}>Sum of a number field</option>
                  <option value="avg" disabled={!numberFields.length}>Average of a number field</option>
                </NativeSelect>
              </Row>
            )}
            {draft.type === "metric" && draft.aggregate !== "count" && (
              <Row label="Number field">
                <NativeSelect value={draft.field ?? ""} onChange={(e) => set({ field: e.target.value })}>
                  {numberFields.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
                </NativeSelect>
              </Row>
            )}
            {(draft.type === "barChart" || draft.type === "lineChart" || draft.type === "pieChart") && draft.aggregate !== "count" && (
              <Row label="Value field">
                <NativeSelect value={draft.valueField ?? ""} onChange={(e) => set({ valueField: e.target.value })}>
                  <option value="">—</option>
                  {numberFields.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
                </NativeSelect>
              </Row>
            )}
            {(draft.type === "barChart" || draft.type === "pieChart") && (
              <Row label="Group by">
                <NativeSelect value={draft.groupBy} onChange={(e) => set({ groupBy: e.target.value })}>
                  {fields.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
                </NativeSelect>
              </Row>
            )}
            {draft.type === "barChart" && fields.find((f) => f.id === draft.groupBy)?.type === "date" && (
              <Row label="Date bucket">
                <NativeSelect value={draft.dateBucket ?? "day"} onChange={(e) => set({ dateBucket: e.target.value })}>
                  <option value="day">Daily</option><option value="week">Weekly</option><option value="month">Monthly</option>
                </NativeSelect>
              </Row>
            )}
            {(draft.type === "lineChart" || draft.type === "calendar") && (
              <Row label="Date field">
                <NativeSelect value={draft.dateField} onChange={(e) => set({ dateField: e.target.value })}>
                  {dateFields.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
                </NativeSelect>
              </Row>
            )}
            {draft.type === "lineChart" && (
              <>
                <Row label="Period">
                  <NativeSelect value={draft.dateBucket} onChange={(e) => set({ dateBucket: e.target.value })}>
                    <option value="day">Daily</option><option value="week">Weekly</option><option value="month">Monthly</option>
                  </NativeSelect>
                </Row>
                <Row label="Number of periods">
                  <Input type="number" min={3} max={60} value={draft.periods ?? ""} onChange={(e) => set({ periods: e.target.value ? Number(e.target.value) : undefined })} />
                </Row>
              </>
            )}
            {draft.type === "calendar" && (
              <Row label="Title field">
                <NativeSelect value={draft.titleField} onChange={(e) => set({ titleField: e.target.value })}>
                  {fields.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
                </NativeSelect>
              </Row>
            )}
            {(draft.type === "metric" || draft.type === "barChart" || draft.type === "progress") && (
              <Row label="Time range">
                <NativeSelect value={draft.dateRange ?? "all"} onChange={(e) => set({ dateRange: e.target.value === "all" ? undefined : e.target.value })}>
                  <option value="all">All time</option><option value="today">Today</option><option value="week">Last 7 days</option><option value="month">Last 30 days</option>
                </NativeSelect>
              </Row>
            )}
            {draft.type === "metric" && (
              <>
                <Row label="Target (optional)">
                  <Input type="number" min={1} value={draft.target ?? ""} onChange={(e) => set({ target: e.target.value ? Number(e.target.value) : undefined })} />
                </Row>
                <Row label="Accent color">
                  <NativeSelect value={draft.color ?? "blue"} onChange={(e) => set({ color: e.target.value })}>
                    {["slate", "blue", "amber", "violet", "green", "red", "pink", "cyan", "orange"].map((c) => <option key={c} value={c}>{c}</option>)}
                  </NativeSelect>
                </Row>
              </>
            )}
            {draft.type === "progress" && (
              <>
                <Row label="Mode">
                  <NativeSelect value={draft.mode} onChange={(e) => set({ mode: e.target.value })}>
                    <option value="completion" disabled={draft.source !== "tasks"}>Task completion %</option>
                    <option value="target">Count vs target</option>
                    <option value="byMember">Per member</option>
                  </NativeSelect>
                </Row>
                {draft.mode !== "completion" && (
                  <Row label="Target">
                    <Input type="number" min={1} value={draft.target ?? ""} onChange={(e) => set({ target: e.target.value ? Number(e.target.value) : undefined })} />
                  </Row>
                )}
              </>
            )}
            {draft.type === "taskList" && (
              <>
                <Row label="Max items">
                  <Input type="number" min={1} max={50} value={draft.limit ?? 10} onChange={(e) => set({ limit: Number(e.target.value) || 10 })} />
                </Row>
                <label className="flex items-center gap-2 self-end pb-2 text-sm">
                  <Checkbox checked={!!draft.showCompleted} onChange={(e) => set({ showCompleted: e.target.checked })} /> Show completed
                </label>
              </>
            )}
            {draft.type === "table" && (
              <Row label="Rows per page">
                <Input type="number" min={3} max={50} value={draft.pageSize ?? 8} onChange={(e) => set({ pageSize: Number(e.target.value) || 8 })} />
              </Row>
            )}
            {(draft.type === "activity" || draft.type === "worklog") && (
              <Row label={draft.type === "activity" ? "Items" : "Recent entries shown"}>
                <Input type="number" min={0} max={50} value={draft.type === "activity" ? draft.limit ?? 10 : draft.showRecent ?? 5} onChange={(e) => set(draft.type === "activity" ? { limit: Number(e.target.value) || 10 } : { showRecent: Number(e.target.value) })} />
              </Row>
            )}
            {draft.type === "form" && (
              <>
                <Row label="Saves into collection">
                  <NativeSelect value={draft.collectionId} onChange={(e) => { set({ collectionId: e.target.value }); setFormFields(config.collections.find((c) => c.id === e.target.value)?.fields ?? null); }}>
                    {config.collections.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </NativeSelect>
                </Row>
                <Row label="Submit button label">
                  <Input value={draft.submitLabel ?? ""} onChange={(e) => set({ submitLabel: e.target.value || undefined })} />
                </Row>
              </>
            )}
          </div>

          {draft.type === "table" && (
            <div className="space-y-1.5">
              <Label>Columns</Label>
              <div className="space-y-1 rounded-lg border p-2">
                {[...draft.columns.map((id) => fields.find((f) => f.id === id)).filter((f): f is FieldDef => !!f), ...fields.filter((f) => !draft.columns.includes(f.id))].map((f) => {
                  const idx = draft.columns.indexOf(f.id);
                  const on = idx !== -1;
                  return (
                    <div key={f.id} className="flex items-center gap-2 text-sm">
                      <Checkbox checked={on} onChange={() => set({ columns: on ? draft.columns.filter((c) => c !== f.id) : [...draft.columns, f.id] })} disabled={on && draft.columns.length === 1} />
                      <span className={on ? "" : "text-muted-foreground"}>{f.label}</span>
                      {on && (
                        <span className="ml-auto flex">
                          <Button variant="ghost" size="iconSm" disabled={idx === 0} onClick={() => { const c = [...draft.columns]; [c[idx - 1], c[idx]] = [c[idx], c[idx - 1]]; set({ columns: c }); }} aria-label="Move left"><ArrowUp /></Button>
                          <Button variant="ghost" size="iconSm" disabled={idx === draft.columns.length - 1} onClick={() => { const c = [...draft.columns]; [c[idx + 1], c[idx]] = [c[idx], c[idx + 1]]; set({ columns: c }); }} aria-label="Move right"><ArrowDown /></Button>
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {hasFilter && fields.length > 0 && (
            <div className="space-y-1.5">
              <Label>Filter (optional)</Label>
              <div className="grid grid-cols-[1fr_120px_1fr] gap-2">
                <NativeSelect value={filter?.field ?? ""} onChange={(e) => set({ filter: e.target.value ? { field: e.target.value, op: filter?.op ?? "eq", value: filter?.value } : undefined })}>
                  <option value="">No filter</option>
                  {fields.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
                </NativeSelect>
                <NativeSelect disabled={!filter} value={filter?.op ?? "eq"} onChange={(e) => set({ filter: { ...filter!, op: e.target.value } })}>
                  <option value="eq">equals</option><option value="neq">not equal</option><option value="contains">contains</option>
                  <option value="gt">greater than</option><option value="lt">less than</option><option value="empty">is empty</option><option value="notEmpty">is not empty</option>
                </NativeSelect>
                {(() => {
                  const ff = fields.find((f) => f.id === filter?.field);
                  const opts = filter?.field === "status" && src?.id === "tasks" ? config.taskStatuses.map((s) => ({ v: s.id, l: s.label })) : ff?.type === "member" ? config.team.members.map((m) => ({ v: m.id, l: m.name })) : ff?.options?.map((o) => ({ v: o, l: o }));
                  const disabled = !filter || filter.op === "empty" || filter.op === "notEmpty";
                  return opts ? (
                    <NativeSelect disabled={disabled} value={String(filter?.value ?? "")} onChange={(e) => set({ filter: { ...filter!, value: e.target.value } })}>
                      <option value="">—</option>
                      {opts.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
                    </NativeSelect>
                  ) : (
                    <Input disabled={disabled} value={String(filter?.value ?? "")} onChange={(e) => set({ filter: { ...filter!, value: e.target.value } })} />
                  );
                })()}
              </div>
            </div>
          )}

          {draft.type === "form" && formFields && (
            <div className="space-y-1.5">
              <Label>Form fields (shared with the “{config.collections.find((c) => c.id === draft.collectionId)?.name}” collection — existing data is kept)</Label>
              <FieldsEditor fields={formFields} onChange={setFormFields} reserved={["createdAt", "createdBy", "id"]} />
            </div>
          )}
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button size="sm" onClick={save}>Save widget</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
