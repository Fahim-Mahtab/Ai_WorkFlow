"use client";
import { useState } from "react";
import type { Widget, WidgetType, WorkspaceConfig } from "@/lib/config/types";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input, Label, NativeSelect } from "@/components/ui/primitives";
import { CATALOG, WIDGET_TYPES, createDefaultWidget, sourceOptions } from "@/lib/registry/catalog";
import { WIDGET_ICONS } from "@/components/dashboard/widget-registry";
import { cn } from "@/lib/utils";

export function AddWidgetDialog({ config, open, onOpenChange, onAdd }: { config: WorkspaceConfig; open: boolean; onOpenChange: (o: boolean) => void; onAdd: (w: Widget) => void }) {
  const [type, setType] = useState<WidgetType>("metric");
  const [source, setSource] = useState<string>("tasks");
  const [title, setTitle] = useState("");
  const kind = CATALOG[type].sourceKind;
  const sources = sourceOptions(config, kind);
  const effectiveSource = sources.some((s) => s.id === source) ? source : sources[0]?.id;
  const disabled = (kind === "collection" && config.collections.length === 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader title="Add widget" description="Pick a component from the registry. You can fine-tune it after adding." />
        <DialogBody className="space-y-4">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {WIDGET_TYPES.map((t) => {
              const Icon = WIDGET_ICONS[t];
              return (
                <button key={t} onClick={() => setType(t)} className={cn("flex flex-col items-start gap-1 rounded-lg border p-2.5 text-left transition-colors", type === t ? "border-primary bg-accent" : "hover:bg-muted")}>
                  <span className="flex items-center gap-2 text-sm font-medium"><Icon className="size-4 text-muted-foreground" />{CATALOG[t].label}</span>
                  <span className="text-[11px] leading-snug text-muted-foreground">{CATALOG[t].description}</span>
                </button>
              );
            })}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label>Title</Label>
              <Input placeholder={CATALOG[type].label} value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            {sources.length > 0 && (
              <div className="space-y-1">
                <Label>{kind === "collection" ? "Collection" : "Data source"}</Label>
                <NativeSelect value={effectiveSource} onChange={(e) => setSource(e.target.value)}>
                  {sources.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                </NativeSelect>
              </div>
            )}
          </div>
          {disabled && <p className="text-xs text-destructive">This workspace has no collections yet. Create one in Settings → Collections, or ask the AI to “add a … form”.</p>}
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            size="sm"
            disabled={disabled}
            onClick={() => {
              const w = createDefaultWidget(type, config, effectiveSource);
              onAdd({ ...w, title: title.trim() || w.title });
              setTitle("");
              onOpenChange(false);
            }}
          >
            Add widget
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
