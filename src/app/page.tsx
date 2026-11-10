"use client";
import Link from "next/link";
import { Boxes, ChevronRight, Layers, ShieldCheck, Sparkles } from "lucide-react";
import { WorkspaceGenerator } from "@/components/ai/workspace-generator";
import { useStore } from "@/lib/workspace/store";
import { Badge, Card } from "@/components/ui/primitives";

export default function HomePage() {
  const { workspaces, setActive } = useStore();

  return (
    <div className="relative mx-auto max-w-6xl space-y-12 px-4 py-8 sm:px-6 sm:py-12">
      {/* 3D Atmospheric Ambient Lighting */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-24 left-1/2 -z-10 h-[500px] w-full max-w-4xl -translate-x-1/2 opacity-60 blur-3xl"
        style={{
          background: "radial-gradient(ellipse at 50% 20%, rgba(99, 102, 241, 0.25), rgba(168, 85, 247, 0.12) 40%, transparent 70%)",
        }}
      />

      {/* Hero Header with 3D Spatial Framing */}
      <section className="relative space-y-5 text-center sm:text-left">
        <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-medium text-primary shadow-sm shadow-primary/10 backdrop-blur-md">
            <Sparkles className="size-3.5 animate-pulse text-primary" />
            <span>AI Dynamic Work Platform</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="rounded-md border bg-card/60 px-2 py-0.5 font-medium shadow-xs">বাংলা</span>
            <span className="rounded-md border bg-card/60 px-2 py-0.5 font-medium shadow-xs">Banglish</span>
            <span className="rounded-md border bg-card/60 px-2 py-0.5 font-medium shadow-xs">English</span>
          </div>
        </div>

        <div className="grid items-center gap-8 lg:grid-cols-12">
          <div className="space-y-4 lg:col-span-7">
            <h1 className="text-3xl font-extrabold tracking-tight sm:text-5xl lg:text-5xl text-foreground">
              Work at the Speed of{" "}
              <span className="bg-gradient-to-r from-primary via-indigo-500 to-purple-500 bg-clip-text text-transparent">
                Natural Thought
              </span>
            </h1>
            <p className="max-w-xl text-base text-muted-foreground sm:text-lg">
              Speak your requirement. AI constructs functional, editable dashboards in real time — with zero code generation.
            </p>
          </div>

          {/* 3D Interactive Floating Mockup */}
          <div className="perspective-1000 hidden lg:col-span-5 lg:block">
            <div className="preserve-3d relative flex h-48 w-full items-center justify-center">
              {/* Backglow Aura */}
              <div className="animate-pulse-ring absolute size-44 rounded-full bg-primary/20 blur-2xl" />

              {/* Floating 3D Kanban Card */}
              <div className="card-3d animate-float-slow glass-panel absolute -left-2 top-2 z-20 w-52 rounded-xl p-3 shadow-xl">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-semibold text-primary">Sprint Board</span>
                  <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-500">Live</span>
                </div>
                <p className="mt-2 text-xs font-medium">Data Entry Verification</p>
                <div className="mt-2 flex items-center justify-between text-[10px] text-muted-foreground">
                  <span>12 Operators</span>
                  <span className="flex size-4 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-white">✓</span>
                </div>
              </div>

              {/* Floating 3D Metric Card */}
              <div className="card-3d animate-float-delayed glass-panel absolute -bottom-2 -right-2 z-10 w-48 rounded-xl p-3 shadow-xl">
                <div className="text-[11px] font-medium text-muted-foreground">Daily Progress</div>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="text-xl font-extrabold text-foreground">94.8%</span>
                  <span className="text-[10px] font-semibold text-emerald-500">+12%</span>
                </div>
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div className="h-full w-[94%] rounded-full bg-gradient-to-r from-primary to-purple-500" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Main AI Workspace Generator Surface */}
      <section className="relative">
        <div className="card-3d rounded-2xl border border-primary/20 bg-card/60 p-1 shadow-2xl shadow-primary/5 backdrop-blur-xl">
          <WorkspaceGenerator />
        </div>
      </section>

      {/* 3D Bento Feature Cards */}
      <section className="grid gap-4 sm:grid-cols-3">
        {[
          {
            icon: Layers,
            title: "Spatial Registry",
            badge: "13 Widgets",
            text: "Dashboards are dynamically assembled from approved UI components.",
            gradient: "from-blue-500/10 to-indigo-500/10",
          },
          {
            icon: ShieldCheck,
            title: "Zero Code Gen",
            badge: "Safe Zod",
            text: "AI produces strict schema JSON. No arbitrary code execution.",
            gradient: "from-emerald-500/10 to-teal-500/10",
          },
          {
            icon: Boxes,
            title: "Living & Editable",
            badge: "Real-time",
            text: "Persisted locally. Modify manually or converse with the AI.",
            gradient: "from-purple-500/10 to-pink-500/10",
          },
        ].map(({ icon: Icon, title, badge, text, gradient }) => (
          <div
            key={title}
            className={`card-3d group relative flex flex-col justify-between overflow-hidden rounded-2xl border bg-gradient-to-br ${gradient} p-5 shadow-sm transition-all`}
          >
            <div className="flex items-center justify-between">
              <span className="flex size-9 items-center justify-center rounded-xl bg-card/80 text-primary shadow-xs backdrop-blur-md">
                <Icon className="size-4.5" />
              </span>
              <span className="rounded-full border border-border/60 bg-card/60 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                {badge}
              </span>
            </div>
            <div className="mt-4 space-y-1">
              <h3 className="font-semibold text-foreground">{title}</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">{text}</p>
            </div>
          </div>
        ))}
      </section>

      {/* Workspaces Grid */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold tracking-tight text-foreground">Active Workspaces</h2>
          <span className="text-xs text-muted-foreground">{workspaces.length} saved</span>
        </div>

        {workspaces.length === 0 ? (
          <Card className="card-3d border-dashed p-8 text-center text-sm text-muted-foreground backdrop-blur-sm">
            No workspaces yet. Enter a prompt above to create your first dynamic dashboard.
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {workspaces.map((w) => (
              <Link
                key={w.id}
                href="/dashboard"
                onClick={() => setActive(w.id)}
                className="card-3d group flex flex-col justify-between rounded-2xl border bg-card/80 p-5 backdrop-blur-md transition-all hover:border-primary/50"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-semibold leading-snug text-foreground group-hover:text-primary transition-colors">
                      {w.config.name}
                    </p>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {w.isDemo && <Badge color="amber">demo</Badge>}
                      <Badge color="violet">{w.config.language}</Badge>
                    </div>
                  </div>
                  <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{w.config.description}</p>
                </div>

                <div className="mt-4 flex items-center justify-between border-t pt-3 text-[11px] text-muted-foreground">
                  <span>{w.config.pages.length} pages · {w.data.tasks.length} tasks</span>
                  <span className="flex items-center gap-1 text-primary font-medium opacity-80 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all">
                    Open <ChevronRight className="size-3.5" />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
