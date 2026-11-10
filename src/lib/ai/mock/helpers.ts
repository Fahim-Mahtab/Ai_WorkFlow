import type { Language } from "../../config/types";
import { bnToEnDigits, slugify } from "../../utils";

const BN_DIGITS = "০১২৩৪৫৬৭৮৯";

/** Numbered role placeholders ("Developer 1", "ডেভেলপার ১"). Real names come from the user — never invented. */
export function names(lang: Language, count: number, role: { bn: string; en: string }): string[] {
  return Array.from({ length: count }, (_, i) => {
    const n = i + 1;
    return lang === "bn" ? `${role.bn} ${String(n).replace(/[0-9]/g, (d) => BN_DIGITS[Number(d)])}` : `${role.en} ${n}`;
  });
}

/** Pick Bengali vs English label. Banglish dashboards use English labels. */
export const pick = (lang: Language) => (bn: string, en: string) => (lang === "bn" ? bn : en);

export function normalizePrompt(p: string): string {
  return bnToEnDigits(p).toLowerCase();
}

/** Total team size like "12 jon", "১২ জন কর্মী", "10 employees". */
export function extractTeamSize(prompt: string): number | undefined {
  const p = normalizePrompt(prompt);
  const m = p.match(/(\d{1,3})\s*(?:jon|জন|people|persons|person|members|member|employees|employee|staff|কর্মী|কর্মচারী|lok|জনের)/);
  if (m) return Math.min(60, Math.max(1, Number(m[1])));
  return undefined;
}

/** Role counts like "4 jon developer and 2 jon tester". */
export function extractRoleCount(prompt: string, roleWords: string[]): number | undefined {
  const p = normalizePrompt(prompt);
  for (const w of roleWords) {
    const re = new RegExp(`(\\d{1,3})\\s*(?:jon|জন|ta|টি|জন\\s+)?\\s*${w}`);
    const m = p.match(re);
    if (m) return Math.min(30, Number(m[1]));
  }
  return undefined;
}

/**
 * Find an explicit list of form fields, e.g.
 * "Citizen Name, NID, Ward Number, Mobile Number এবং Address দিয়ে…"
 */
export function extractFieldList(prompt: string): string[] {
  const candidates = prompt.split(/[।.\n]/);
  for (const sentence of candidates) {
    if ((sentence.match(/,|،|、/g) ?? []).length < 2) continue;
    const parts = sentence
      .split(/,|\s+(?:এবং|ও|আর|and|ar|o|&)\s+/i)
      .map((s) => s.trim())
      .filter(Boolean);
    if (parts.length < 3) continue;
    // trim leading/trailing filler words from first and last parts
    const cleaned = parts.map((s, i) => {
      let x = s;
      if (i === 0) {
        const after = x.split(/\b(?:with|including|like|containing|fields?)\b|:/i).pop() ?? x;
        x = after.trim().split(/\s+/).slice(-3).join(" ");
      }
      if (i === parts.length - 1) {
        const ws = x.split(/\s+/);
        // "Address দিয়ে একটি…" → keep the leading Latin words only
        const latinPrefix = ws.findIndex((w) => /[ঀ-৿]/.test(w));
        x = (latinPrefix > 0 ? ws.slice(0, latinPrefix) : ws.slice(0, 3)).join(" ");
      }
      return x.replace(/\s*(দিয়ে|দিয়ে|diye|with|field|fields|সহ)\s*.*$/i, "").trim();
    });
    const result = cleaned.filter((s) => s.length > 1 && s.length < 40);
    if (result.length >= 3) return result.slice(0, 15);
  }
  return [];
}

export function guessFieldType(label: string): { type: "text" | "textarea" | "number" | "date" | "email" | "phone" | "url" | "select" | "member"; options?: string[] } {
  const l = label.toLowerCase();
  if (/mobile|phone|মোবাইল|ফোন|contact/.test(l)) return { type: "phone" };
  if (/email|ই-?মেইল/.test(l)) return { type: "email" };
  if (/address|ঠিকানা|details|বিবরণ|description|note|মন্তব্য/.test(l)) return { type: "textarea" };
  if (/date|তারিখ|deadline/.test(l)) return { type: "date" };
  if (/ward|ওয়ার্ড/.test(l)) return { type: "select", options: Array.from({ length: 9 }, (_, i) => `Ward ${i + 1}`) };
  if (/amount|price|qty|quantity|number of|count|age|বয়স|টাকা|পরিমাণ|hours|ঘণ্টা/.test(l)) return { type: "number" };
  if (/url|link|website|লিংক/.test(l)) return { type: "url" };
  if (/assignee|employee|staff|কর্মী/.test(l)) return { type: "member" };
  return { type: "text" };
}

export function fieldId(label: string, i: number): string {
  const known: [RegExp, string][] = [
    [/citizen.*name|নাগরিকের নাম|নাম/i, "citizen_name"],
    [/nid|জাতীয় পরিচয়/i, "nid"],
    [/ward|ওয়ার্ড/i, "ward_no"],
    [/mobile|phone|মোবাইল|ফোন/i, "mobile"],
    [/address|ঠিকানা/i, "address"],
    [/email|ইমেইল/i, "email"],
  ];
  for (const [re, id] of known) if (re.test(label)) return id;
  return slugify(label, `field_${i + 1}`);
}
