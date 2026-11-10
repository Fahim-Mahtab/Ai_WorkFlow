"use client";
/** Workspace settings: general, task statuses, custom task fields, collections/forms, raw JSON, AI provider, danger zone. */
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Download, Plus, Trash2, Upload } from "lucide-react";
import { PageHeader, RequireWorkspace } from "@/components/layout/page-header";
import { useStore, useWorkspaceActions } from "@/lib/workspace/store";
import { useAssistant } from "@/components/layout/providers";
import { FieldsEditor, finalizeFieldIds } from "@/components/editor/collection-fields-editor";
import { Button } from "@/components/ui/button";
import { Badge, Card, Checkbox, Input, Label, NativeSelect, Textarea, DOT_COLORS } from "@/components/ui/primitives";
import { useConfirm } from "@/components/ui/dialog";
import { ImportWorkspaceButton } from "@/components/layout/import-workspace-button";
import { downloadWorkspace } from "@/lib/workspace/transfer";
import { validateConfig } from "@/lib/config/validate";
import { clearAll, storageSize } from "@/lib/storage/local";
import { resetUsage } from "@/lib/storage/usage";
import { useUsageTotals } from "@/components/ai/usage-badge";
import { formatUsd } from "@/lib/ai/pricing";
import type { Collection, FieldDef, StatusColor, TaskStatus, Workspace, WorkspaceConfig } from "@/lib/config/types";
import { cn, slugify, uid } from "@/lib/utils";

const COLORS: StatusColor[] = ["slate", "blue", "amber", "violet", "green", "red", "pink", "cyan", "orange"];

function Section({ title, description, children, actions }: { title: string; description?: string; children: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <Card className="space-y-4 p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="font-semibold">{title}</h2>
          {description && <p className="text-xs text-muted-foreground">{description}</p>}
        </div>
        {actions}
      </div>
      {children}
    </Card>
  );
}

function SettingsView({ ws }: { ws: Workspace }) {
  const actions = useWorkspaceActions(ws.id);
  const { removeWorkspace, addWorkspace } = useStore();
  const { status } = useAssistant();
  const confirm = useConfirm();
  const router = useRouter();
  const { config } = ws;
  const usageTotals = useUsageTotals(ws.id);

  const apply =(next: WorkspaceConfig, note: string) => {
    const v = validateConfig(next);
    if (!v.ok) {
      toast.error(v.errors.slice(0, 3).join("\n"));
      return false;
    }
    actions.setConfig(v.config!, note);
    v.warnings.forEach((w) => toast.warning(w));
    toast.success("Saved");
    return true;
  };

  /* general */
  const [general, setGeneral] = useState({ name: config.name, description: config.description ?? "", language: config.language });
  /* statuses */
  const [statuses, setStatuses] = useState<TaskStatus[]>(config.taskStatuses);
  /* task fields */
  const [taskFields, setTaskFields] = useState<FieldDef[]>(config.taskFields);
  /* collections */
  const [collections, setCollections] = useState<Collection[]>(config.collections);
  /* json */
  const [json, setJson] = useState("");
  const [jsonErrors, setJsonErrors] = useState<string[]>([]);

  useEffect(() => {
    setStatuses(config.taskStatuses);
    setTaskFields(config.taskFields);
    setCollections(config.collections);
    setJson(JSON.stringify(config, null, 2));
  }, [config]);

  const moveStatus = (i: number, d: -1 | 1) => {
    const s = [...statuses];
    [s[i], s[i + d]] = [s[i + d], s[i]];
    setStatuses(s);
  };

  const saveStatuses = async () => {
    const removed = config.taskStatuses.filter((s) => !statuses.some((x) => x.id === s.id));
    const affected = ws.data.tasks.filter((t) => removed.some((r) => r.id === t.status));
    if (affected.length && !(await confirm({ title: "Remove statuses in use?", description: `${affected.length} tasks use a removed status and will move to “${statuses[0]?.label}”.`, confirmLabel: "Save", destructive: true }))) return;
    const used = new Set<string>();
    const fixed = statuses.map((s) => {
      let id = s.id.startsWith("new_") ? slugify(s.label, "status") : s.id;
      while (used.has(id)) id += "_2";
      used.add(id);
      return { ...s, id };
    });
    if (apply({ ...config, taskStatuses: fixed }, "Task statuses updated")) affected.forEach((t) => actions.updateTask(t.id, { status: fixed[0].id }));
  };

  const download = () => downloadWorkspace(ws);

  return (
    <div className="mx-auto max-w-4xl space-y-5 px-4 py-6 sm:px-6">
      <PageHeader title="Settings" description="Everything the AI generated is editable here — no code required." />

      <Section title="General" actions={<Button size="sm" onClick={() => apply({ ...config, name: general.name, description: general.description || undefined, language: general.language }, "Workspace details updated")}>Save</Button>}>
        <div className="grid gap-3 sm:grid-cols-[1fr_180px]">
          <div className="space-y-1"><Label>Workspace name</Label><Input value={general.name} onChange={(e) => setGeneral({ ...general, name: e.target.value })} /></div>
          <div className="space-y-1">
            <Label>Dashboard language</Label>
            <NativeSelect value={general.language} onChange={(e) => setGeneral({ ...general, language: e.target.value as WorkspaceConfig["language"] })}>
              <option value="bn">বাংলা</option><option value="banglish">Banglish</option><option value="en">English</option>
            </NativeSelect>
          </div>
        </div>
        <div className="space-y-1"><Label>Description</Label><Textarea rows={2} value={general.description} onChange={(e) => setGeneral({ ...general, description: e.target.value })} /></div>
      </Section>

      <Section title="Task statuses" description="Custom workflow columns. Mark which statuses count as done." actions={<Button size="sm" onClick={saveStatuses}>Save statuses</Button>}>
        <div className="space-y-2">
          {statuses.map((s, i) => (
            <div key={s.id} className="flex flex-wrap items-center gap-2">
              <span className={cn("size-3 rounded-full", DOT_COLORS[s.color])} />
              <Input className="h-8 w-48" value={s.label} onChange={(e) => setStatuses(statuses.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} />
              <NativeSelect className="h-8 w-28" value={s.color} onChange={(e) => setStatuses(statuses.map((x, j) => (j === i ? { ...x, color: e.target.value as StatusColor } : x)))}>
                {COLORS.map((c) => <option key={c} value={c}>{c}</option>)}
              </NativeSelect>
              <label className="flex items-center gap-1.5 text-xs text-muted-foreground"><Checkbox checked={!!s.isDone} onChange={(e) => setStatuses(statuses.map((x, j) => (j === i ? { ...x, isDone: e.target.checked || undefined } : x)))} /> done</label>
              <span className="text-xs text-muted-foreground">{ws.data.tasks.filter((t) => t.status === s.id).length} tasks</span>
              <div className="ml-auto flex">
                <Button variant="ghost" size="iconSm" disabled={i === 0} onClick={() => moveStatus(i, -1)} aria-label="Move up"><ArrowUp /></Button>
                <Button variant="ghost" size="iconSm" disabled={i === statuses.length - 1} onClick={() => moveStatus(i, 1)} aria-label="Move down"><ArrowDown /></Button>
                <Button variant="ghost" size="iconSm" disabled={statuses.length <= 2} onClick={() => setStatuses(statuses.filter((_, j) => j !== i))} aria-label="Remove status"><Trash2 /></Button>
              </div>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={() => setStatuses([...statuses, { id: uid("new").toLowerCase(), label: "New status", color: "violet" }])}><Plus /> Add status</Button>
        </div>
      </Section>

      <Section title="Custom task fields" description="Extra fields shown on every task (e.g. Ward, Sprint, Story points)." actions={<Button size="sm" onClick={() => apply({ ...config, taskFields: finalizeFieldIds(taskFields, ["title", "status", "priority", "assignees", "dueDate", "createdAt", "completedAt", "kind", "description"]) }, "Task fields updated")}>Save fields</Button>}>
        {taskFields.length === 0 && <p className="text-sm text-muted-foreground">No custom fields yet.</p>}
        <FieldsEditor fields={taskFields} onChange={setTaskFields} reserved={["title", "status", "priority", "assignees", "dueDate"]} />
      </Section>

      <Section
        title="Collections & forms"
        description="Each collection stores records entered through forms. Removing a field keeps existing values in storage."
        actions={
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setCollections([...collections, { id: `new_collection_${collections.length + 1}`, name: "New collection", fields: [{ id: "name", label: "Name", type: "text", required: true }] }])}><Plus /> Collection</Button>
            <Button size="sm" onClick={() => apply({ ...config, collections: collections.map((c) => ({ ...c, id: c.id.startsWith("new_collection") ? slugify(c.name, "collection") : c.id, fields: finalizeFieldIds(c.fields, ["createdAt", "createdBy", "id"]) })) }, "Collections updated")}>Save collections</Button>
          </div>
        }
      >
        {collections.length === 0 && <p className="text-sm text-muted-foreground">No collections. Add one, or ask the AI to “add a … form”.</p>}
        {collections.map((c, i) => (
          <details key={c.id} className="rounded-lg border p-3" open={collections.length <= 2}>
            <summary className="flex cursor-pointer items-center gap-2 text-sm font-medium">
              {c.name} <Badge>{c.fields.length} fields</Badge> <Badge color="blue">{ws.data.records[c.id]?.length ?? 0} records</Badge>
            </summary>
            <div className="mt-3 space-y-3">
              <div className="flex gap-2">
                <Input className="h-8" value={c.name} onChange={(e) => setCollections(collections.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} aria-label="Collection name" />
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive"
                  onClick={async () => {
                    if (await confirm({ title: `Remove “${c.name}”?`, description: "Widgets using it are removed. Records stay in local storage.", destructive: true, confirmLabel: "Remove" })) setCollections(collections.filter((_, j) => j !== i));
                  }}
                >
                  <Trash2 /> Remove
                </Button>
              </div>
              <FieldsEditor fields={c.fields} onChange={(fields) => setCollections(collections.map((x, j) => (j === i ? { ...x, fields } : x)))} reserved={["createdAt", "createdBy", "id"]} />
            </div>
          </details>
        ))}
      </Section>

      <Section title="Configuration JSON" description="Advanced: the exact JSON the dashboard is rendered from. Edits are validated with Zod and the component registry before saving.">
        <Textarea rows={14} value={json} onChange={(e) => setJson(e.target.value)} className="font-mono text-xs" spellCheck={false} />
        {jsonErrors.length > 0 && <ul className="list-disc pl-5 text-xs text-destructive">{jsonErrors.map((e, i) => <li key={i}>{e}</li>)}</ul>}
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            onClick={() => {
              let parsed: unknown;
              try {
                parsed = JSON.parse(json);
              } catch (e) {
                setJsonErrors([(e as Error).message]);
                return;
              }
              const v = validateConfig(parsed);
              setJsonErrors(v.errors);
              if (v.ok) {
                actions.setConfig(v.config!, "Configuration edited as JSON");
                toast.success("Configuration applied");
              }
            }}
          >
            Validate & apply
          </Button>
          <Button size="sm" variant="outline" onClick={() => { setJson(JSON.stringify(config, null, 2)); setJsonErrors([]); }}>Reset</Button>
          <Button size="sm" variant="outline" onClick={download}><Download /> Export workspace</Button>
          <ImportWorkspaceButton />
        </div>
      </Section>

      <Section title="AI provider & token spend">
        <div className="space-y-3 text-sm">
          <p>
            Mode: <Badge color={status?.mode === "live" ? "green" : "amber"}>{status?.mode ?? "…"}</Badge> · Provider: <span className="font-medium">{status?.provider}</span> · Model: <span className="font-medium">{status?.model}</span>
            {status?.reasoning && <> · Thinking: <span className="font-medium">{status.reasoning === "none" ? "off" : status.reasoning}</span></>}
          </p>
          {status?.pricing && (
            <p className="text-xs text-muted-foreground">
              Current rate ({status.pricing.peak ? "peak" : "off-peak"}): input ${status.pricing.rates.cacheMiss.toFixed(3)}/M · cached input ${status.pricing.rates.cacheHit.toFixed(4)}/M · output ${status.pricing.rates.output.toFixed(3)}/M. Peak = 01–04 &amp; 06–10 UTC Mon–Fri. Source: {status.pricing.source}.
            </p>
          )}
          <div className="grid gap-2 sm:grid-cols-2">
            {[
              { title: "This workspace", t: usageTotals.workspace },
              { title: "All workspaces (this browser)", t: usageTotals.all },
            ].map(({ title, t }) => (
              <div key={title} className="rounded-lg border p-3">
                <p className="text-xs font-medium text-muted-foreground">{title}</p>
                <p className="text-lg font-semibold tabular-nums">{formatUsd(t?.costUsd ?? 0)}{t?.partial && "+"}</p>
                <p className="text-xs tabular-nums text-muted-foreground">
                  {(t?.requests ?? 0).toLocaleString()} requests · {(t?.totalTokens ?? 0).toLocaleString()} tokens ({(t?.promptTokens ?? 0).toLocaleString()} in / {(t?.completionTokens ?? 0).toLocaleString()} out{t?.cacheHitTokens ? `, ${t.cacheHitTokens.toLocaleString()} cached` : ""})
                </p>
              </div>
            ))}
          </div>
          <Button size="sm" variant="outline" onClick={async () => (await confirm({ title: "Reset the token spend counters?", description: "Only the local counters are reset — this does not affect your DeepSeek bill.", confirmLabel: "Reset" })) && resetUsage()}>
            Reset spend counters
          </Button>
          <p className="text-xs text-muted-foreground">Costs are estimates from DeepSeek’s published rates; your DeepSeek dashboard is the source of truth.</p>
          <p className="text-xs text-muted-foreground">The API key is read on the server from <code>DEEPSEEK_API_KEY</code> in <code>.env.local</code> and is never sent to the browser. Without a key the app runs a clearly-labelled rule-based demo generator.</p>
          <p className="text-xs text-muted-foreground">Local storage used: {(storageSize() / 1024).toFixed(1)} KB</p>
        </div>
      </Section>

      <Section title="Danger zone">
        <div className="flex flex-wrap gap-2">
          <Button
            variant="destructive"
            size="sm"
            onClick={async () => {
              if (await confirm({ title: `Delete “${config.name}”?`, description: "All its tasks, records and work logs are permanently removed from this browser.", destructive: true, confirmLabel: "Delete workspace" })) {
                removeWorkspace(ws.id);
                router.push("/");
              }
            }}
          >
            <Trash2 /> Delete workspace
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              if (await confirm({ title: "Clear ALL local data?", description: "Every workspace and chat history in this browser is permanently deleted.", destructive: true, confirmLabel: "Clear everything" })) {
                clearAll();
                window.location.href = "/";
              }
            }}
          >
            Clear all local data
          </Button>
        </div>
      </Section>
    </div>
  );
}

export default function SettingsPage() {
  return <RequireWorkspace>{(ws) => <SettingsView key={ws.id} ws={ws} />}</RequireWorkspace>;
}
