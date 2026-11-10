"use client";
import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { PageHeader, RequireWorkspace } from "@/components/layout/page-header";
import { useWorkspaceActions } from "@/lib/workspace/store";
import { Avatar } from "@/components/tasks/task-bits";
import { Button } from "@/components/ui/button";
import { Card, Input, NativeSelect } from "@/components/ui/primitives";
import { useConfirm } from "@/components/ui/dialog";
import type { Workspace } from "@/lib/config/types";
import { slugify, todayISO } from "@/lib/utils";

function uniqueId(base: string, used: string[]) {
  let id = slugify(base, "m");
  let n = 2;
  while (used.includes(id)) id = `${slugify(base, "m")}_${n++}`;
  return id;
}

function TeamView({ ws }: { ws: Workspace }) {
  const actions = useWorkspaceActions(ws.id);
  const confirm = useConfirm();
  const { config, data } = ws;
  const [name, setName] = useState("");
  const [roleId, setRoleId] = useState(config.team.roles[0]?.id ?? "");
  const [roleName, setRoleName] = useState("");
  const doneIds = new Set(config.taskStatuses.filter((s) => s.isDone).map((s) => s.id));
  const today = todayISO();

  const setTeam = (team: Workspace["config"]["team"], note?: string) => actions.updateConfig((c) => ({ ...c, team }), note);

  return (
    <div className="mx-auto max-w-6xl space-y-5 px-4 py-6 sm:px-6">
      <PageHeader title="Team" description={`${config.team.members.length} members · ${config.team.roles.length} roles`} />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 font-medium">Member</th>
                  <th className="px-2 py-2 font-medium">Role</th>
                  <th className="px-2 py-2 font-medium">Open tasks</th>
                  <th className="px-2 py-2 font-medium">Completed</th>
                  <th className="px-2 py-2 font-medium">Logs today</th>
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody>
                {config.team.members.map((m) => {
                  const mine = data.tasks.filter((t) => t.assigneeIds.includes(m.id));
                  const done = mine.filter((t) => doneIds.has(t.status)).length;
                  return (
                    <tr key={m.id} className="border-b last:border-0">
                      <td className="px-4 py-2">
                        <div className="flex items-center gap-2">
                          <Avatar member={m} size={28} />
                          <Input className="h-8 max-w-52 border-transparent bg-transparent shadow-none hover:border-input" defaultValue={m.name} onBlur={(e) => e.target.value.trim() && e.target.value !== m.name && setTeam({ ...config.team, members: config.team.members.map((x) => (x.id === m.id ? { ...x, name: e.target.value.trim() } : x)) })} aria-label="Member name" />
                        </div>
                      </td>
                      <td className="px-2 py-2">
                        <NativeSelect className="h-8 w-44" value={m.roleId} onChange={(e) => setTeam({ ...config.team, members: config.team.members.map((x) => (x.id === m.id ? { ...x, roleId: e.target.value } : x)) })}>
                          {config.team.roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                        </NativeSelect>
                      </td>
                      <td className="px-2 py-2 tabular-nums">{mine.length - done}</td>
                      <td className="px-2 py-2 tabular-nums">{done}</td>
                      <td className="px-2 py-2 tabular-nums">{data.worklogs.filter((w) => w.memberId === m.id && w.date === today).length}</td>
                      <td className="px-2">
                        <Button
                          variant="ghost"
                          size="iconSm"
                          aria-label="Remove member"
                          onClick={async () => {
                            if (await confirm({ title: `Remove ${m.name}?`, description: "They will be unassigned from tasks. Their history is kept.", destructive: true, confirmLabel: "Remove" })) {
                              setTeam({ ...config.team, members: config.team.members.filter((x) => x.id !== m.id) }, `Member removed: ${m.name}`);
                              data.tasks.filter((t) => t.assigneeIds.includes(m.id)).forEach((t) => actions.updateTask(t.id, { assigneeIds: t.assigneeIds.filter((a) => a !== m.id) }));
                            }
                          }}
                        >
                          <Trash2 />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <form
            className="flex flex-wrap gap-2 border-t p-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (!name.trim()) return;
              const id = uniqueId(name, config.team.members.map((m) => m.id));
              setTeam({ ...config.team, members: [...config.team.members, { id, name: name.trim(), roleId }] }, `Member added: ${name.trim()}`);
              setName("");
            }}
          >
            <Input className="h-8 min-w-40 flex-1" placeholder="New member name" value={name} onChange={(e) => setName(e.target.value)} />
            <NativeSelect className="h-8 w-44" value={roleId} onChange={(e) => setRoleId(e.target.value)}>
              {config.team.roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </NativeSelect>
            <Button size="sm" type="submit"><Plus /> Add member</Button>
          </form>
        </Card>

        <Card className="space-y-3 p-4">
          <h3 className="text-sm font-semibold">Roles</h3>
          <ul className="space-y-2">
            {config.team.roles.map((r) => (
              <li key={r.id} className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{r.name}</p>
                  {r.description && <p className="text-xs text-muted-foreground">{r.description}</p>}
                  <p className="text-[11px] text-muted-foreground">{config.team.members.filter((m) => m.roleId === r.id).length} members</p>
                </div>
                <Button variant="ghost" size="iconSm" disabled={config.team.roles.length <= 1 || config.team.members.some((m) => m.roleId === r.id)} title="Only empty roles can be removed" aria-label="Remove role" onClick={() => setTeam({ ...config.team, roles: config.team.roles.filter((x) => x.id !== r.id) })}>
                  <Trash2 />
                </Button>
              </li>
            ))}
          </ul>
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (!roleName.trim()) return;
              setTeam({ ...config.team, roles: [...config.team.roles, { id: uniqueId(roleName, config.team.roles.map((r) => r.id)), name: roleName.trim() }] });
              setRoleName("");
            }}
          >
            <Input className="h-8" placeholder="New role" value={roleName} onChange={(e) => setRoleName(e.target.value)} />
            <Button size="sm" variant="outline" type="submit"><Plus /> Add</Button>
          </form>
        </Card>
      </div>
    </div>
  );
}

export default function TeamPage() {
  return <RequireWorkspace>{(ws) => <TeamView key={ws.id} ws={ws} />}</RequireWorkspace>;
}
