"use client";
/** Generic input for any FieldDef + a validation helper. Used by forms, tables, tasks. */
import type { FieldDef, FieldValue, Language, Member } from "@/lib/config/types";
import { Checkbox, Input, NativeSelect, Textarea } from "@/components/ui/primitives";
import { t } from "@/lib/i18n";
import { bnToEnDigits, cn } from "@/lib/utils";

interface Props {
  field: FieldDef;
  value: FieldValue;
  onChange: (v: FieldValue) => void;
  members: Member[];
  lang: Language;
  disabled?: boolean;
  invalid?: boolean;
  id?: string;
}

export function FieldInput({ field, value, onChange, members, lang, disabled, invalid, id }: Props) {
  const common = { id, disabled, "aria-invalid": invalid, className: cn(invalid && "border-destructive") };
  switch (field.type) {
    case "textarea":
      return <Textarea {...common} rows={3} placeholder={field.placeholder} value={String(value ?? "")} onChange={(e) => onChange(e.target.value)} />;
    case "number":
      return <Input {...common} type="number" inputMode="decimal" placeholder={field.placeholder} value={value === undefined || value === null ? "" : String(value)} onChange={(e) => onChange(e.target.value === "" ? undefined : Number(e.target.value))} />;
    case "date":
      return <Input {...common} type="date" value={String(value ?? "")} onChange={(e) => onChange(e.target.value || undefined)} />;
    case "email":
      return <Input {...common} type="email" placeholder={field.placeholder ?? "name@example.com"} value={String(value ?? "")} onChange={(e) => onChange(e.target.value)} />;
    case "phone":
      return <Input {...common} type="tel" inputMode="tel" placeholder={field.placeholder ?? "01XXXXXXXXX"} value={String(value ?? "")} onChange={(e) => onChange(e.target.value)} />;
    case "url":
      return <Input {...common} type="url" placeholder={field.placeholder ?? "https://"} value={String(value ?? "")} onChange={(e) => onChange(e.target.value)} />;
    case "checkbox":
      return (
        <label className="flex h-9 items-center gap-2 text-sm">
          <Checkbox id={id} disabled={disabled} checked={!!value} onChange={(e) => onChange(e.target.checked)} />
          {value ? t(lang, "yes") : t(lang, "no")}
        </label>
      );
    case "select":
      return (
        <NativeSelect {...common} value={String(value ?? "")} onChange={(e) => onChange(e.target.value || undefined)}>
          <option value="">{t(lang, "select")}</option>
          {(field.options ?? []).map((o) => (
            <option key={o} value={o}>{o}</option>
          ))}
        </NativeSelect>
      );
    case "multiselect": {
      const arr = Array.isArray(value) ? value : [];
      return (
        <div className="flex flex-wrap gap-1.5">
          {(field.options ?? []).map((o) => {
            const on = arr.includes(o);
            return (
              <button type="button" key={o} disabled={disabled} onClick={() => onChange(on ? arr.filter((x) => x !== o) : [...arr, o])} className={cn("rounded-full border px-2.5 py-1 text-xs", on ? "border-primary bg-accent text-accent-foreground" : "hover:bg-muted")}>
                {o}
              </button>
            );
          })}
        </div>
      );
    }
    case "member":
      return (
        <NativeSelect {...common} value={String(value ?? "")} onChange={(e) => onChange(e.target.value || undefined)}>
          <option value="">{t(lang, "select")}</option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>{m.name}</option>
          ))}
        </NativeSelect>
      );
    default:
      return <Input {...common} placeholder={field.placeholder} value={String(value ?? "")} onChange={(e) => onChange(e.target.value)} />;
  }
}

export function validateValues(fields: FieldDef[], values: Record<string, FieldValue>, lang: Language): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const f of fields) {
    const v = values[f.id];
    const empty = v === undefined || v === null || v === "" || (Array.isArray(v) && v.length === 0);
    if (f.required && empty) {
      errors[f.id] = `${f.label} ${t(lang, "required")}`;
      continue;
    }
    if (empty) continue;
    const s = bnToEnDigits(String(v));
    if (f.type === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) errors[f.id] = `${f.label} ${t(lang, "invalid")}`;
    if (f.type === "phone" && !/^\+?[\d\s-]{6,16}$/.test(s)) errors[f.id] = `${f.label} ${t(lang, "invalid")}`;
    if (f.type === "url" && !/^https?:\/\/\S+$/.test(s)) errors[f.id] = `${f.label} ${t(lang, "invalid")}`;
    if (f.id === "nid" && !/^\d{10}$|^\d{13}$|^\d{17}$/.test(s)) errors[f.id] = `${f.label} ${t(lang, "invalid")} (10/13/17)`;
  }
  return errors;
}
