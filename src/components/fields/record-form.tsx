"use client";
import { useState } from "react";
import type { FieldDef, FieldValue, Language, Member } from "@/lib/config/types";
import { Label } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import { FieldInput, validateValues } from "./field-input";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";

interface Props {
  fields: FieldDef[];
  members: Member[];
  lang: Language;
  initial?: Record<string, FieldValue>;
  submitLabel?: string;
  disabled?: boolean;
  /** show a "Submitted by" selector (records remember who entered them) */
  askCreatedBy?: boolean;
  initialCreatedBy?: string;
  onSubmit: (values: Record<string, FieldValue>, createdBy?: string) => void;
  onCancel?: () => void;
  compact?: boolean;
}

export function RecordForm({ fields, members, lang, initial, submitLabel, disabled, askCreatedBy, initialCreatedBy, onSubmit, onCancel, compact }: Props) {
  const [values, setValues] = useState<Record<string, FieldValue>>(initial ?? {});
  const [createdBy, setCreatedBy] = useState<string | undefined>(initialCreatedBy);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validateValues(fields, values, lang);
    setErrors(errs);
    if (Object.keys(errs).length) return;
    onSubmit(values, createdBy);
    if (!initial) setValues({});
  };

  return (
    <form onSubmit={submit} className="space-y-3" noValidate>
      <div className={cn("grid gap-3", !compact && "sm:grid-cols-2")}>
        {fields.map((f) => (
          <div key={f.id} className={cn("space-y-1", (f.type === "textarea" || f.type === "multiselect") && "sm:col-span-2")}>
            <Label htmlFor={`f_${f.id}`}>
              {f.label}
              {f.required && <span className="text-destructive"> *</span>}
            </Label>
            <FieldInput id={`f_${f.id}`} field={f} value={values[f.id]} onChange={(v) => setValues((s) => ({ ...s, [f.id]: v }))} members={members} lang={lang} disabled={disabled} invalid={!!errors[f.id]} />
            {errors[f.id] ? <p className="text-xs text-destructive">{errors[f.id]}</p> : f.helpText ? <p className="text-xs text-muted-foreground">{f.helpText}</p> : null}
          </div>
        ))}
        {askCreatedBy && members.length > 0 && (
          <div className="space-y-1">
            <Label>{t(lang, "createdBy")}</Label>
            <FieldInput field={{ id: "createdBy", label: "", type: "member" }} value={createdBy} onChange={(v) => setCreatedBy(v as string)} members={members} lang={lang} disabled={disabled} />
          </div>
        )}
      </div>
      <div className="flex justify-end gap-2">
        {onCancel && (
          <Button type="button" variant="outline" size="sm" onClick={onCancel}>
            {t(lang, "cancel")}
          </Button>
        )}
        <Button type="submit" size="sm" disabled={disabled}>
          {submitLabel ?? t(lang, "submit")}
        </Button>
      </div>
    </form>
  );
}
