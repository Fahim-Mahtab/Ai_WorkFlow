"use client";
import { AlertTriangle, ArrowDown, ArrowUp, Minus } from "lucide-react";
import type { Member, PriorityId, WorkspaceConfig } from "@/lib/config/types";
import { Badge } from "@/components/ui/primitives";
import { cn, todayISO } from "@/lib/utils";

export function StatusBadge({ config, status }: { config: WorkspaceConfig; status: string }) {
  const s = config.taskStatuses.find((x) => x.id === status) ?? config.taskStatuses[0];
  return <Badge color={s?.color ?? "slate"}>{s?.label ?? status}</Badge>;
}

const PRIORITY_ICON: Record<PriorityId, React.ReactNode> = {
  low: <ArrowDown className="size-3" />,
  medium: <Minus className="size-3" />,
  high: <ArrowUp className="size-3" />,
  urgent: <AlertTriangle className="size-3" />,
};
const PRIORITY_COLOR = { low: "slate", medium: "blue", high: "orange", urgent: "red" } as const;

export function PriorityBadge({ config, priority }: { config: WorkspaceConfig; priority: PriorityId }) {
  const label = config.priorities.find((p) => p.id === priority)?.label ?? priority;
  return (
    <Badge color={PRIORITY_COLOR[priority]}>
      {PRIORITY_ICON[priority]}
      {label}
    </Badge>
  );
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return (parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "");
}

const AVATAR_BG = ["var(--series-1)", "var(--series-2)", "var(--series-3)", "var(--series-7)", "var(--series-5)", "var(--series-6)"];

export function Avatar({ member, size = 22, className }: { member: Member; size?: number; className?: string }) {
  const idx = Math.abs([...member.id].reduce((a, c) => a + c.charCodeAt(0), 0)) % AVATAR_BG.length;
  return (
    <span
      title={member.name}
      className={cn("inline-flex shrink-0 items-center justify-center rounded-full border-2 border-card font-semibold text-white", className)}
      style={{ width: size, height: size, fontSize: size * 0.4, background: AVATAR_BG[idx] }}
    >
      {initials(member.name)}
    </span>
  );
}

export function AssigneeStack({ config, ids, max = 3 }: { config: WorkspaceConfig; ids: string[]; max?: number }) {
  const members = ids.map((id) => config.team.members.find((m) => m.id === id)).filter((m): m is Member => !!m);
  if (!members.length) return null;
  return (
    <span className="flex -space-x-1.5">
      {members.slice(0, max).map((m) => (
        <Avatar key={m.id} member={m} />
      ))}
      {members.length > max && <span className="inline-flex size-[22px] items-center justify-center rounded-full border-2 border-card bg-muted text-[9px] font-medium">+{members.length - max}</span>}
    </span>
  );
}

export function DueDate({ date, done }: { date?: string; done?: boolean }) {
  if (!date) return null;
  const overdue = !done && date < todayISO();
  const today = date === todayISO();
  const label = new Date(date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return <span className={cn("text-[11px]", overdue ? "font-medium text-destructive" : today ? "font-medium text-amber-600 dark:text-amber-400" : "text-muted-foreground")}>{label}</span>;
}
