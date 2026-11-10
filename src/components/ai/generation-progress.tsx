"use client";
import { useEffect, useState, useMemo } from "react";
import { BarChart3, Check, CheckCircle2, Cpu, KanbanSquare, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export const GENERATE_STEPS = [
  "Language & Intent Analysis",
  "Entity & Role Synthesis",
  "Dynamic Registry Blueprinting",
  "JSON Schema Contract Generation",
  "Zod Structural Validation",
  "Seeding Records & Live Verification",
];

export const EDIT_STEPS = [
  "Reading Workspace State",
  "Synthesizing Transformation Instruction",
  "Contract Schema Hardening",
  "Applying Visual Diff & Registry Validation",
];

interface Props {
  steps: string[];
  running: boolean;
  done: boolean;
  live: boolean;
  compact?: boolean;
}

export function GenerationProgress({ steps, running, done, live, compact }: Props) {
  const [idx, setIdx] = useState(0);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!running) return;
    setIdx(0);
    setElapsed(0);
    const per = live ? 3800 : 450;
    const a = setInterval(() => setIdx((i) => Math.min(i + 1, steps.length - 1)), per);
    const b = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => {
      clearInterval(a);
      clearInterval(b);
    };
  }, [running, live, steps.length]);

  const currentIdx = done ? steps.length : idx;

  // Calculate smooth progress percentage
  const percent = useMemo(() => {
    if (done) return 100;
    if (!running) return 0;
    const base = ((currentIdx + 0.3) / steps.length) * 100;
    return Math.min(96, Math.max(12, Math.round(base)));
  }, [done, running, currentIdx, steps.length]);

  if (compact) {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs font-medium">
          <span className="flex items-center gap-1.5 text-primary">
            <Loader2 className="size-3 animate-spin" />
            {steps[Math.min(currentIdx, steps.length - 1)]}
          </span>
          <span className="font-mono text-muted-foreground">{percent}%</span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-gradient-to-r from-primary to-purple-500 transition-all duration-300"
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* 3D Blueprint Assembly Stage */}
      <div className="perspective-1000 relative overflow-hidden rounded-2xl border border-primary/30 bg-card/70 p-4 backdrop-blur-2xl shadow-2xl">
        {/* Laser Scanner Beam */}
        {running && !done && (
          <div className="animate-laser-sweep pointer-events-none absolute inset-x-0 z-30 h-1 bg-gradient-to-r from-transparent via-cyan-400 to-transparent shadow-[0_0_15px_#22d3ee]" />
        )}

        {/* Top Neural HUD Bar */}
        <div className="flex items-center justify-between border-b border-border/40 pb-3">
          <div className="flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary shadow-xs">
              <Cpu className={cn("size-4", running && "animate-pulse")} />
            </span>
            <div>
              <p className="text-xs font-bold text-foreground">
                {done ? "Dashboard Synthesis Complete" : "Assembling Dynamic 3D Workspace"}
              </p>
              <p className="text-[10px] text-muted-foreground">
                {steps[Math.min(currentIdx, steps.length - 1)]}
              </p>
            </div>
          </div>

          {/* Circular Progress Gauge */}
          <div className="flex items-center gap-3">
            <div className="relative flex size-10 items-center justify-center">
              <svg className="size-full -rotate-90" viewBox="0 0 36 36">
                <circle cx="18" cy="18" r="14" fill="none" className="stroke-muted" strokeWidth="3" />
                <circle
                  cx="18"
                  cy="18"
                  r="14"
                  fill="none"
                  className={cn("transition-all duration-500", done ? "stroke-emerald-500" : "stroke-primary")}
                  strokeWidth="3"
                  strokeDasharray="88"
                  strokeDashoffset={88 - (88 * percent) / 100}
                  strokeLinecap="round"
                />
              </svg>
              <span className="absolute font-mono text-[10px] font-extrabold text-foreground">{percent}%</span>
            </div>
            {running && <span className="font-mono text-xs text-muted-foreground">{elapsed}s</span>}
          </div>
        </div>

        {/* 3D Virtual Dashboard Wireframe Simulator */}
        <div className="preserve-3d relative mt-4 h-48 w-full rounded-xl border border-dashed border-border/60 bg-muted/20 p-3 transition-transform">
          {/* Background Blueprint Grid */}
          <div className="absolute inset-0 bg-[radial-gradient(#6366f1_0.8px,transparent_0.8px)] [background-size:14px_14px] opacity-25" />

          {/* Phase 1: Metric KPI Blocks (Appear >= 15%) */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: "Metrics", val: "1,420+", color: "text-blue-500", min: 15 },
              { label: "Records", val: "Verified", color: "text-emerald-500", min: 25 },
              { label: "Team", val: "12 Staff", color: "text-purple-500", min: 35 },
            ].map((m, i) => {
              const active = percent >= m.min;
              return (
                <div
                  key={i}
                  className={cn(
                    "card-3d rounded-lg border p-2 backdrop-blur-md transition-all duration-500",
                    active
                      ? "border-primary/30 bg-card/90 shadow-md translate-y-0 opacity-100"
                      : "border-border/30 bg-card/20 translate-y-2 opacity-30"
                  )}
                >
                  <p className="text-[10px] text-muted-foreground">{m.label}</p>
                  <p className={cn("text-xs font-bold", m.color)}>{active ? m.val : "---"}</p>
                </div>
              );
            })}
          </div>

          {/* Phase 2: Live Middle Section - Kanban & Tables (Appear >= 45%) */}
          <div className="mt-2.5 grid grid-cols-12 gap-2">
            {/* Kanban Columns Wireframe */}
            <div
              className={cn(
                "col-span-7 rounded-lg border p-2 transition-all duration-500",
                percent >= 45
                  ? "border-primary/30 bg-card/85 opacity-100 shadow-sm"
                  : "border-border/20 bg-card/10 opacity-20"
              )}
            >
              <div className="flex items-center justify-between text-[10px] font-semibold text-muted-foreground">
                <span className="flex items-center gap-1">
                  <KanbanSquare className="size-3 text-primary" />
                  Task Pipeline
                </span>
                <span className="text-[9px] text-primary">{percent >= 60 ? "3 Lanes" : "Mapping..."}</span>
              </div>

              {/* Dynamic Task Cards Dropping In */}
              <div className="mt-1.5 flex gap-1.5">
                {percent >= 55 && (
                  <div className="animate-card-drop flex-1 rounded bg-muted/80 p-1 text-[9px] font-medium shadow-xs">
                    <span className="line-clamp-1">Data Entry #1</span>
                  </div>
                )}
                {percent >= 70 && (
                  <div className="animate-card-drop flex-1 rounded bg-primary/10 p-1 text-[9px] font-medium text-primary shadow-xs">
                    <span className="line-clamp-1">Manager Review</span>
                  </div>
                )}
                {percent >= 85 && (
                  <div className="animate-card-drop flex-1 rounded bg-emerald-500/10 p-1 text-[9px] font-medium text-emerald-500 shadow-xs">
                    <span className="line-clamp-1">Approved ✓</span>
                  </div>
                )}
              </div>
            </div>

            {/* Dynamic Real-time Chart Simulator (Appear >= 65%) */}
            <div
              className={cn(
                "col-span-5 rounded-lg border p-2 transition-all duration-500",
                percent >= 65
                  ? "border-primary/30 bg-card/85 opacity-100 shadow-sm"
                  : "border-border/20 bg-card/10 opacity-20"
              )}
            >
              <div className="flex items-center justify-between text-[10px] font-semibold text-muted-foreground">
                <span className="flex items-center gap-1">
                  <BarChart3 className="size-3 text-purple-500" />
                  Analytics
                </span>
                <span className="text-[9px] text-emerald-500">Live</span>
              </div>

              {/* Animated Growing Bars */}
              <div className="mt-2 flex h-7 items-end justify-between gap-1 px-1">
                {[40, 75, 55, 95, 65, 85].map((h, i) => (
                  <div
                    key={i}
                    className="animate-bar-grow w-2 rounded-t bg-gradient-to-t from-primary to-purple-400 shadow-xs"
                    style={{
                      height: percent >= 75 ? `${h}%` : "15%",
                      animationDelay: `${i * 80}ms`,
                    }}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Phase 3: Completion Holographic Overlay */}
          {done && (
            <div className="animate-card-drop absolute inset-2 z-20 flex flex-col items-center justify-center rounded-xl bg-card/95 backdrop-blur-md shadow-2xl border border-emerald-500/40">
              <div className="flex size-11 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-500 shadow-lg shadow-emerald-500/20">
                <CheckCircle2 className="size-6 animate-pulse" />
              </div>
              <p className="mt-2 text-sm font-extrabold text-foreground">Workspace Successfully Synthesized</p>
              <p className="text-[11px] text-muted-foreground">All 13 registry components validated & ready</p>
            </div>
          )}
        </div>

        {/* Milestone Steps Pills */}
        <div className="mt-4 flex flex-wrap gap-1.5">
          {steps.map((s, i) => {
            const isDone = i < currentIdx || done;
            const isActive = i === currentIdx && running && !done;
            return (
              <span
                key={s}
                className={cn(
                  "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-medium transition-all",
                  isDone
                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-500"
                    : isActive
                    ? "border-primary bg-primary/10 text-primary shadow-xs"
                    : "border-border/40 text-muted-foreground/50 opacity-60"
                )}
              >
                {isDone ? (
                  <Check className="size-2.5" />
                ) : isActive ? (
                  <Loader2 className="size-2.5 animate-spin" />
                ) : (
                  <span className="size-1 rounded-full bg-current" />
                )}
                {s}
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}
