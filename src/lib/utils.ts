import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function uid(prefix = "id"): string {
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${Date.now().toString(36)}${rand}`;
}

/** Turn any label (incl. Bengali) into a schema-safe id. */
export function slugify(input: string, fallback = "item"): string {
  const s = input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
  return s || `${fallback}_${Math.random().toString(36).slice(2, 6)}`;
}

export function todayISO(d = new Date()): string {
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 10);
}

export function addDays(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + days);
  return todayISO(d);
}

export function nowISO(): string {
  return new Date().toISOString();
}

const BN_DIGITS = "০১২৩৪৫৬৭৮৯";
export function bnToEnDigits(s: string): string {
  return s.replace(/[০-৯]/g, (c) => String(BN_DIGITS.indexOf(c)));
}
export function enToBnDigits(s: string): string {
  return s.replace(/[0-9]/g, (c) => BN_DIGITS[Number(c)]);
}

export function formatNumber(n: number, lang: "bn" | "en" | "banglish" = "en"): string {
  const rounded = Math.round(n * 10) / 10;
  const s = rounded.toLocaleString("en-US");
  return lang === "bn" ? enToBnDigits(s) : s;
}

export function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.round(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  return `${d}d ago`;
}

export function deepClone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}
