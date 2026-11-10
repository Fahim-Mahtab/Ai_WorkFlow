/** Structural diff between two configs — powers the "change preview" before applying AI edits. */
import type { WorkspaceConfig } from "../config/types";
import { CATALOG } from "../registry/catalog";

export interface Change {
  kind: "added" | "removed" | "modified";
  area: "page" | "widget" | "status" | "collection" | "field" | "member" | "taskField" | "workspace";
  label: string;
  detail?: string;
}

function byId<T extends { id: string }>(items: T[]) {
  return new Map(items.map((i) => [i.id, i]));
}

export function diffConfigs(a: WorkspaceConfig, b: WorkspaceConfig): Change[] {
  const out: Change[] = [];
  if (a.name !== b.name) out.push({ kind: "modified", area: "workspace", label: `Name: "${a.name}" → "${b.name}"` });

  const pa = byId(a.pages);
  const pb = byId(b.pages);
  for (const [id, p] of pb) if (!pa.has(id)) out.push({ kind: "added", area: "page", label: p.title, detail: `${p.widgets.length} widgets` });
  for (const [id, p] of pa) if (!pb.has(id)) out.push({ kind: "removed", area: "page", label: p.title, detail: `${p.widgets.length} widgets` });
  for (const [id, p] of pb) {
    const old = pa.get(id);
    if (old && old.title !== p.title) out.push({ kind: "modified", area: "page", label: `"${old.title}" → "${p.title}"` });
  }

  const wa = new Map(a.pages.flatMap((p) => p.widgets.map((w) => [w.id, { w, page: p.title }] as const)));
  const wb = new Map(b.pages.flatMap((p) => p.widgets.map((w) => [w.id, { w, page: p.title }] as const)));
  for (const [id, { w, page }] of wb) {
    const old = wa.get(id);
    if (!old) out.push({ kind: "added", area: "widget", label: w.title, detail: `${CATALOG[w.type].label} · ${page}` });
    else if (JSON.stringify(old.w) !== JSON.stringify(w) || old.page !== page) {
      const what = old.w.type !== w.type ? `${CATALOG[old.w.type].label} → ${CATALOG[w.type].label}` : old.w.title !== w.title ? `renamed from "${old.w.title}"` : old.page !== page ? `moved to ${page}` : "settings changed";
      out.push({ kind: "modified", area: "widget", label: w.title, detail: what });
    }
  }
  for (const [id, { w, page }] of wa) if (!wb.has(id)) out.push({ kind: "removed", area: "widget", label: w.title, detail: `${CATALOG[w.type].label} · ${page}` });

  const sa = byId(a.taskStatuses);
  const sb = byId(b.taskStatuses);
  for (const [id, s] of sb) if (!sa.has(id)) out.push({ kind: "added", area: "status", label: s.label });
  for (const [id, s] of sa) if (!sb.has(id)) out.push({ kind: "removed", area: "status", label: s.label, detail: "tasks in this status move to the first status" });
  for (const [id, s] of sb) {
    const o = sa.get(id);
    if (o && o.label !== s.label) out.push({ kind: "modified", area: "status", label: `"${o.label}" → "${s.label}"` });
  }

  const ca = byId(a.collections);
  const cb = byId(b.collections);
  for (const [id, c] of cb) {
    const o = ca.get(id);
    if (!o) {
      out.push({ kind: "added", area: "collection", label: c.name, detail: `${c.fields.length} fields` });
      continue;
    }
    const fa = byId(o.fields);
    const fb = byId(c.fields);
    for (const [fid, f] of fb) if (!fa.has(fid)) out.push({ kind: "added", area: "field", label: `${c.name} › ${f.label}` });
    for (const [fid, f] of fa) if (!fb.has(fid)) out.push({ kind: "removed", area: "field", label: `${c.name} › ${f.label}`, detail: "existing values are kept in storage" });
  }
  for (const [id, c] of ca) if (!cb.has(id)) out.push({ kind: "removed", area: "collection", label: c.name, detail: "records are kept in storage" });

  const tfa = byId(a.taskFields);
  const tfb = byId(b.taskFields);
  for (const [id, f] of tfb) if (!tfa.has(id)) out.push({ kind: "added", area: "taskField", label: f.label });
  for (const [id, f] of tfa) if (!tfb.has(id)) out.push({ kind: "removed", area: "taskField", label: f.label });

  const ma = byId(a.team.members);
  const mb = byId(b.team.members);
  for (const [id, m] of mb) if (!ma.has(id)) out.push({ kind: "added", area: "member", label: m.name });
  for (const [id, m] of ma) if (!mb.has(id)) out.push({ kind: "removed", area: "member", label: m.name });
  return out;
}

/** "Significant" = anything removed, or many changes. Small additive edits can still be previewed. */
export function isSignificant(changes: Change[]): boolean {
  return changes.some((c) => c.kind === "removed") || changes.length > 3;
}
