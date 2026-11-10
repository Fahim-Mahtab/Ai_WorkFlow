"use client";
/** In-app notifications: what automation rules did. Unread = newer than the last time the bell was opened. */
import { useEffect, useState } from "react";
import Link from "next/link";
import { Bell, Workflow } from "lucide-react";
import { useStore } from "@/lib/workspace/store";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown";
import { relativeTime } from "@/lib/utils";

const seenKey = (id: string) => `awp:v1:seen:${id}`;

export function NotificationBell() {
  const { active } = useStore();
  const [seen, setSeen] = useState("");
  useEffect(() => {
    if (!active) return;
    try {
      setSeen(localStorage.getItem(seenKey(active.id)) ?? "");
    } catch {
      setSeen("");
    }
  }, [active?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!active) return null;
  const items = active.data.activity.filter((a) => a.kind === "rule").slice(0, 12);
  const unread = items.filter((a) => a.at > seen).length;

  const markSeen = (open: boolean) => {
    if (!open || !items[0]) return;
    setSeen(items[0].at);
    try {
      localStorage.setItem(seenKey(active.id), items[0].at);
    } catch {
      /* ignore */
    }
  };

  return (
    <DropdownMenu onOpenChange={markSeen}>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon" className="relative rounded-full" aria-label={unread ? `${unread} new notifications` : "Notifications"}>
          <Bell />
          {unread > 0 && <span className="absolute -right-0.5 -top-0.5 flex min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white">{unread > 9 ? "9+" : unread}</span>}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel>Notifications</DropdownMenuLabel>
        {items.length === 0 ? (
          <p className="px-2 py-3 text-xs text-muted-foreground">Nothing yet. Automations post here when they run.</p>
        ) : (
          <div className="max-h-80 overflow-y-auto scrollbar-thin">
            {items.map((a) => (
              <div key={a.id} className="flex gap-2 rounded-md px-2 py-1.5 text-xs">
                <Workflow className="mt-0.5 size-3.5 shrink-0 text-primary" />
                <span className="min-w-0 flex-1">{a.text}</span>
                <span className="shrink-0 text-muted-foreground">{relativeTime(a.at)}</span>
              </div>
            ))}
          </div>
        )}
        <DropdownMenuSeparator />
        <Link href="/automations" className="block rounded-md px-2 py-1.5 text-xs font-medium text-primary hover:bg-muted">Manage automations</Link>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
