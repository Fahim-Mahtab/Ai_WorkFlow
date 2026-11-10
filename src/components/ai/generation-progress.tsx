"use client";
import { useEffect, useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export const GENERATE_STEPS = [
  "Language understanding",
  "Requirement analysis",
  "Workspace planning",
  "JSON configuration generation",
  "Zod schema validation",
  "Component registry validation",
];

export const EDIT_STEPS = ["Reading current configuration", "Applying your instruction", "Zod schema validation", "Registry validation & diff"];

/** Animated pipeline progress. Steps advance on a timer while waiting; `done` completes them all. */
export function GenerationProgress({ steps, running, done, live, compact }: { steps: string[]; running: boolean; done: boolean; live: boolean; compact?: boolean }) {
  const [idx, setIdx] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!running) return;
    setIdx(0);
    setElapsed(0);
    const per = live ? 4500 : 350;
    const a = setInterval(() => setIdx((i) => Math.min(i + 1, steps.length - 3)), per);
    const b = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => {
      clearInterval(a);
      clearInterval(b);
    };
  }, [running, live, steps.length]);
  const current = done ? steps.length : idx;
  return (
    <div className={cn("space-y-1.5", compact && "space-y-1")}>
      {steps.map((s, i) => {
        const state = i < current ? "done" : i === current && running ? "active" : "todo";
        return (
          <div key={s} className={cn("flex items-center gap-2.5 text-sm", compact && "text-xs", state === "todo" && "text-muted-foreground/60")}>
            <span className={cn("flex size-5 items-center justify-center rounded-full border", state === "done" && "border-transparent bg-[var(--series-3)] text-white", state === "active" && "border-primary text-primary")}>
              {state === "done" ? <Check className="size-3" /> : state === "active" ? <Loader2 className="size-3 animate-spin" /> : <span className="size-1 rounded-full bg-current" />}
            </span>
            {s}
          </div>
        );
      })}
      {running && live && <p className="pl-7 text-xs text-muted-foreground">{elapsed}s — large workspaces can take 30–90s with DeepSeek…</p>}
    </div>
  );
}
