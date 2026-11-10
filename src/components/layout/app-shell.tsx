"use client";
import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { BarChart3, Check, ChevronsUpDown, LayoutDashboard, ListChecks, Menu, Moon, Plus, Settings, Sparkles, Sun, Users, Wand2, X } from "lucide-react";
import { useStore } from "@/lib/workspace/store";
import { useAssistant } from "./providers";
import { AssistantPanel } from "@/components/ai/assistant-panel";
import { UsageTotalPill, useUsageTotals } from "@/components/ai/usage-badge";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/primitives";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/tasks", label: "Tasks & Work log", icon: ListChecks },
  { href: "/team", label: "Team", icon: Users },
  { href: "/reports", label: "Reports", icon: BarChart3 },
  { href: "/settings", label: "Settings", icon: Settings },
];

function WorkspaceSwitcher({ onNavigate }: { onNavigate?: () => void }) {
  const { workspaces, active, setActive } = useStore();
  const router = useRouter();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex w-full items-center gap-2.5 rounded-xl border bg-muted/50 px-2.5 py-2 text-left hover:bg-muted">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-accent text-xs font-bold text-accent-foreground">{active?.config.name.slice(0, 1) ?? "?"}</span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium">{active?.config.name ?? "No workspace"}</span>
            <span className="block truncate text-[11px] text-muted-foreground">{active ? `${active.config.team.members.length} members · ${active.config.pages.length} pages` : "Create one with AI"}</span>
          </span>
          <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel>Workspaces</DropdownMenuLabel>
        {workspaces.map((w) => (
          <DropdownMenuItem
            key={w.id}
            onSelect={() => {
              setActive(w.id);
              router.push("/dashboard");
              onNavigate?.();
            }}
          >
            <span className="min-w-0 flex-1 truncate">{w.config.name}</span>
            {w.isDemo && <Badge color="amber">demo</Badge>}
            {w.id === active?.id && <Check />}
          </DropdownMenuItem>
        ))}
        {workspaces.length === 0 && <p className="px-2 py-1.5 text-xs text-muted-foreground">No workspaces yet</p>}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => { router.push("/"); onNavigate?.(); }}>
          <Plus /> New workspace with AI
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Light ⇄ dark, one click. Shows the sun in light mode, the moon in dark mode. */
function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  const dark = mounted && resolvedTheme === "dark";
  return (
    <Button variant="outline" size="icon" className="rounded-full" onClick={() => setTheme(dark ? "light" : "dark")} aria-label={dark ? "Switch to light mode" : "Switch to dark mode"} title={dark ? "Light mode" : "Dark mode"}>
      {dark ? <Moon /> : <Sun />}
    </Button>
  );
}

function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { active } = useStore();
  return (
    <div className="flex h-full flex-col gap-5 p-4">
      <Link href="/" onClick={onNavigate} className="group flex items-center gap-2.5 px-1.5 pt-1">
        <span className="flex size-8 items-center justify-center rounded-xl bg-gradient-to-br from-primary via-indigo-600 to-purple-600 text-white shadow-md shadow-primary/25 transition-transform group-hover:scale-105">
          <Sparkles className="size-4 animate-pulse" />
        </span>
        <span className="font-bold tracking-tight text-foreground">Kajflow AI</span>
        <span className="ml-auto rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">3D</span>
      </Link>
      <WorkspaceSwitcher onNavigate={onNavigate} />
      <nav className="flex flex-col gap-0.5">
        <Link href="/" onClick={onNavigate} className={cn("flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors", pathname === "/" ? "bg-accent font-semibold text-accent-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground")}>
          <Wand2 className="size-4" /> AI Workspace Generator
        </Link>
        <div className="my-1.5 h-px bg-border" />
        {NAV.map(({ href, label, icon: Icon }) => {
          const on = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={active ? href : "/"}
              onClick={onNavigate}
              aria-disabled={!active}
              className={cn("flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors", on ? "bg-accent font-semibold text-accent-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground", !active && "pointer-events-none opacity-40")}
            >
              <Icon className="size-4" /> {label}
            </Link>
          );
        })}
      </nav>
      {active && (
        <div className="mt-auto space-y-1 rounded-xl bg-muted/60 p-3 text-xs">
          <p className="font-medium">Stored locally</p>
          <p className="text-muted-foreground">
            {active.data.tasks.length} tasks · {Object.values(active.data.records).reduce((n, r) => n + r.length, 0)} records · {active.data.worklogs.length} work logs
          </p>
        </div>
      )}
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { open, setOpen, status } = useAssistant();
  const { hydrated, storageError } = useStore();
  const [mobileNav, setMobileNav] = useState(false);
  const allUsage = useUsageTotals(null);

  return (
    <div className="flex h-dvh overflow-hidden">
      <aside className="hidden w-64 shrink-0 border-r bg-sidebar lg:block">
        <Sidebar />
      </aside>
      {mobileNav && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileNav(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 border-r bg-sidebar shadow-xl">
            <button className="absolute right-3 top-3 rounded p-1 hover:bg-muted" onClick={() => setMobileNav(false)} aria-label="Close menu"><X className="size-4" /></button>
            <Sidebar onNavigate={() => setMobileNav(false)} />
          </aside>
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 shrink-0 items-center gap-2 border-b bg-card/90 px-3 backdrop-blur sm:px-6">
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setMobileNav(true)} aria-label="Open menu"><Menu /></Button>
          <div className="flex-1" />
          {status && (
            <Badge color={status.mode === "live" ? "green" : "amber"} title={status.model}>
              <span className={cn("size-1.5 rounded-full", status.mode === "live" ? "bg-green-500" : "bg-amber-500")} />
              {status.mode === "live" ? `AI: ${status.provider} (${status.model})` : "Demo mode — no API key"}
            </Badge>
          )}
          <span className="hidden sm:inline-flex"><UsageTotalPill totals={allUsage.all} title="Total AI spend in this browser" /></span>
          <ThemeToggle />
          <Button variant={open ? "secondary" : "default"} size="sm" className="rounded-full px-4" onClick={() => setOpen(!open)}>
            <Sparkles /> AI Assistant
          </Button>
        </header>
        {storageError && <div className="bg-destructive/10 px-4 py-1.5 text-xs text-destructive">Could not save to LocalStorage: {storageError}</div>}
        <div className="flex min-h-0 flex-1">
          <main className="min-w-0 flex-1 overflow-y-auto scrollbar-thin">
            {hydrated ? children : <div className="p-6 text-sm text-muted-foreground">Loading workspaces…</div>}
          </main>
          {open && <AssistantPanel onClose={() => setOpen(false)} />}
        </div>
      </div>
    </div>
  );
}
