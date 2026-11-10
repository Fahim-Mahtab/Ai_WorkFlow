"use client";
/** "Who's on the team?" — rename or add people before the workspace is created. No AI call, no cost. */
import { Plus, Trash2, Users } from "lucide-react";
import type { Language, WorkspaceConfig } from "@/lib/config/types";
import { Button } from "@/components/ui/button";
import { Input, NativeSelect } from "@/components/ui/primitives";

type Team = WorkspaceConfig["team"];

const T = {
  bn: { title: "টিমে কারা আছেন?", hint: "আসল নামগুলো লিখুন, বা নতুন কাউকে যোগ করুন।", add: "নতুন ব্যক্তি", name: "নাম" },
  banglish: { title: "Team e kara ache?", hint: "Asol nam gula likho, ba notun kauke add koro.", add: "Notun person", name: "Nam" },
  en: { title: "Who's on the team?", hint: "Type their real names, or add anyone new.", add: "Add person", name: "Name" },
};

export function TeamSetup({ team, lang, onChange }: { team: Team; lang: Language; onChange: (t: Team) => void }) {
  const t = T[lang] ?? T.en;
  const setMember = (i: number, patch: Partial<Team["members"][number]>) =>
    onChange({ ...team, members: team.members.map((m, j) => (j === i ? { ...m, ...patch } : m)) });
  const add = () => {
    const used = new Set(team.members.map((m) => m.id));
    let n = team.members.length + 1;
    while (used.has(`m_new_${n}`)) n++;
    const roleId = team.roles[team.roles.length - 1].id;
    onChange({ ...team, members: [...team.members, { id: `m_new_${n}`, name: "", roleId }] });
  };
  return (
    <div className="space-y-3 rounded-xl border bg-muted/40 p-4">
      <div className="flex items-start gap-2">
        <Users className="mt-0.5 size-4 text-primary" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">{t.title}</p>
          <p className="text-xs text-muted-foreground">{t.hint}</p>
        </div>
        <Button size="sm" variant="outline" onClick={add} disabled={team.members.length >= 100}><Plus /> {t.add}</Button>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {team.members.map((m, i) => (
          <div key={m.id} className="flex items-center gap-1.5">
            <Input value={m.name} placeholder={t.name} aria-label={t.name} maxLength={60} onChange={(e) => setMember(i, { name: e.target.value })} className="h-8 min-w-0 flex-1" autoFocus={!m.name} />
            <NativeSelect value={m.roleId} aria-label="Role" onChange={(e) => setMember(i, { roleId: e.target.value })} className="h-8 w-32 shrink-0">
              {team.roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </NativeSelect>
            <Button size="icon" variant="ghost" className="size-8 shrink-0" aria-label="Remove" disabled={team.members.length <= 1}
              onClick={() => onChange({ ...team, members: team.members.filter((_, j) => j !== i) })}>
              <Trash2 />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Blank names would fail validation — fill them before saving. */
export function finalizeTeam(team: Team): Team {
  return { ...team, members: team.members.map((m, i) => ({ ...m, name: m.name.trim() || `Member ${i + 1}` })) };
}
