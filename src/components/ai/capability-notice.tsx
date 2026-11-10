"use client";
/** Honest "can't do that yet → here's what I did instead" notice + clickable next-step suggestions. */
import { ArrowRight, Info, Lightbulb } from "lucide-react";
import type { Language, Unsupported } from "@/lib/config/types";
import { cn } from "@/lib/utils";

const T = {
  title: { bn: "এখনও সম্ভব নয়", banglish: "Ekhono shombhob na", en: "Not available yet" },
  instead: { bn: "বিকল্প", banglish: "Bikolpo", en: "Instead" },
  next: { bn: "পরবর্তী পরামর্শ", banglish: "Porer suggestion", en: "Suggested next steps" },
};
const tr = (k: keyof typeof T, lang?: Language) => T[k][lang ?? "en"];

export function UnsupportedNotice({ items, lang, compact }: { items: Unsupported[]; lang?: Language; compact?: boolean }) {
  if (!items.length) return null;
  return (
    <div className={cn("rounded-lg border border-amber-500/30 bg-amber-500/5", compact ? "p-2.5 text-xs" : "p-3 text-sm")}>
      <p className="mb-1.5 flex items-center gap-1.5 font-medium text-amber-800 dark:text-amber-300">
        <Info className="size-4 shrink-0" /> {tr("title", lang)}
      </p>
      <ul className="space-y-2">
        {items.map((u, i) => (
          <li key={i}>
            <p className="font-medium">{u.request}</p>
            {u.reason && <p className="text-muted-foreground">{u.reason}</p>}
            {u.alternative && (
              <p className="mt-0.5 flex gap-1">
                <ArrowRight className="mt-0.5 size-3.5 shrink-0 text-[var(--series-3)]" />
                <span><span className="font-medium">{tr("instead", lang)}:</span> {u.alternative}</span>
              </p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function SuggestionChips({ items, lang, onPick, disabled, label }: { items: string[]; lang?: Language; onPick: (s: string) => void; disabled?: boolean; label?: string }) {
  if (!items.length) return null;
  return (
    <div className="space-y-1.5">
      <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <Lightbulb className="size-3.5 text-amber-500" /> {label ?? tr("next", lang)}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {items.map((s) => (
          <button
            key={s}
            disabled={disabled}
            onClick={() => onPick(s)}
            className="rounded-full border border-primary/30 bg-accent px-3 py-1 text-left text-xs text-accent-foreground transition-colors hover:border-primary disabled:opacity-50"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}
