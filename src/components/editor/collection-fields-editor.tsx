"use client";
/** Add/remove/edit fields of a collection (form) or the custom task fields. */
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import type { FieldDef, FieldType } from "@/lib/config/types";
import { Button } from "@/components/ui/button";
import { Checkbox, Input, NativeSelect } from "@/components/ui/primitives";
import { slugify } from "@/lib/utils";

const TYPES: FieldType[] = ["text", "textarea", "number", "date", "select", "multiselect", "email", "phone", "url", "checkbox", "member"];

export function FieldsEditor({ fields, onChange, reserved = [] }: { fields: FieldDef[]; onChange: (f: FieldDef[]) => void; reserved?: string[] }) {
  const update = (i: number, patch: Partial<FieldDef>) => onChange(fields.map((f, j) => (j === i ? { ...f, ...patch } : f)));
  const move = (i: number, d: -1 | 1) => {
    const next = [...fields];
    const [x] = next.splice(i, 1);
    next.splice(i + d, 0, x);
    onChange(next);
  };
  const add = () => {
    const used = new Set([...fields.map((f) => f.id), ...reserved]);
    let id = "new_field";
    let n = 2;
    while (used.has(id)) id = `new_field_${n++}`;
    onChange([...fields, { id, label: "New field", type: "text" }]);
  };

  return (
    <div className="space-y-2">
      {fields.map((f, i) => (
        <div key={f.id} className="space-y-2 rounded-lg border p-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <Input className="h-8 min-w-36 flex-1" value={f.label} onChange={(e) => update(i, { label: e.target.value })} aria-label="Field label" />
            <NativeSelect className="h-8 w-32" value={f.type} onChange={(e) => update(i, { type: e.target.value as FieldType, ...(["select", "multiselect"].includes(e.target.value) && !f.options?.length ? { options: ["Option 1", "Option 2"] } : {}) })} aria-label="Field type">
              {TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </NativeSelect>
            <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Checkbox checked={!!f.required} onChange={(e) => update(i, { required: e.target.checked || undefined })} /> required
            </label>
            <div className="ml-auto flex">
              <Button variant="ghost" size="iconSm" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Move up"><ArrowUp /></Button>
              <Button variant="ghost" size="iconSm" disabled={i === fields.length - 1} onClick={() => move(i, 1)} aria-label="Move down"><ArrowDown /></Button>
              <Button variant="ghost" size="iconSm" disabled={fields.length <= 1} onClick={() => onChange(fields.filter((_, j) => j !== i))} aria-label="Remove field"><Trash2 /></Button>
            </div>
          </div>
          {(f.type === "select" || f.type === "multiselect") && (
            <Input
              className="h-8 text-xs"
              placeholder="Options, comma separated"
              defaultValue={(f.options ?? []).join(", ")}
              onBlur={(e) => update(i, { options: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })}
            />
          )}
          <p className="text-[10px] text-muted-foreground">id: {f.id}{f.id === "new_field" || f.id.startsWith("new_field_") ? ` → will be saved as “${slugify(f.label, "field")}”` : ""}</p>
        </div>
      ))}
      <Button variant="outline" size="sm" onClick={add}>
        <Plus /> Add field
      </Button>
    </div>
  );
}

/** Give freshly-added fields a slug id derived from their label. */
export function finalizeFieldIds(fields: FieldDef[], reserved: string[] = []): FieldDef[] {
  const used = new Set(reserved);
  return fields.map((f) => {
    let id = f.id;
    if (id.startsWith("new_field")) id = slugify(f.label, "field");
    let unique = id;
    let n = 2;
    while (used.has(unique)) unique = `${id}_${n++}`;
    used.add(unique);
    return { ...f, id: unique, options: f.type === "select" || f.type === "multiselect" ? (f.options?.length ? f.options : ["Option 1"]) : undefined };
  });
}
