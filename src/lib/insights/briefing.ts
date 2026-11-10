/**
 * Manager briefing. The browser works out the facts (who is late, which deadlines are at risk,
 * who logged work); the AI only phrases them and suggests next steps. In demo mode the same
 * facts are turned into a plain briefing with no AI at all.
 */
import { z } from "zod";
import type { Language, Workspace } from "../config/types";
import { daysUntil } from "../automation/rules";
import { taskRisk, workload } from "../views/views";
import { todayISO } from "../utils";

export interface BriefingFacts {
  workspace: string;
  today: string;
  language: Language;
  totals: { tasks: number; open: number; done: number; late: number; atRisk: number; doneThisWeek: number };
  people: { name: string; role: string; open: number; late: number; atRisk: number; dueThisWeek: number; doneThisWeek: number; logs7d: number; hours7d: number }[];
  /** open tasks that need attention, worst first */
  attention: { title: string; people: string; due?: string; days?: number; status: string; risk: string }[];
  recentWork: string[];
}

export const briefingSchema = z.object({
  headline: z.string().min(1).max(300),
  items: z
    .array(z.object({ tone: z.enum(["risk", "warn", "good", "info"]).catch("info"), text: z.string().min(1).max(300) }))
    .max(10),
  actions: z.array(z.string().min(1).max(200)).max(5).catch([]),
});
export type Briefing = z.infer<typeof briefingSchema>;

const RISK_ORDER: Record<string, number> = { late: 0, at_risk: 1, watch: 2, ok: 3 };

export function buildFacts(ws: Workspace, today = todayISO()): BriefingFacts {
  const cfg = ws.config;
  const done = new Set(cfg.taskStatuses.filter((s) => s.isDone).map((s) => s.id));
  const name = (id: string) => cfg.team.members.find((m) => m.id === id)?.name ?? id;
  const status = (id: string) => cfg.taskStatuses.find((s) => s.id === id)?.label ?? id;
  const load = workload(ws, today);
  const open = ws.data.tasks.filter((t) => !done.has(t.status));
  const risky = open
    .map((t) => ({ t, risk: taskRisk(t, cfg, today) }))
    .filter((x) => x.risk !== "ok")
    .sort((a, b) => RISK_ORDER[a.risk] - RISK_ORDER[b.risk] || (a.t.dueDate ?? "").localeCompare(b.t.dueDate ?? ""));
  return {
    workspace: cfg.name,
    today,
    language: cfg.language,
    totals: {
      tasks: ws.data.tasks.length,
      open: open.length,
      done: ws.data.tasks.length - open.length,
      late: risky.filter((x) => x.risk === "late").length,
      atRisk: risky.filter((x) => x.risk === "at_risk").length,
      doneThisWeek: load.reduce((s, p) => s + p.doneThisWeek, 0),
    },
    people: load.map(({ name, role, open, late, atRisk, dueThisWeek, doneThisWeek, logs7d, hours7d }) => ({ name, role, open, late, atRisk, dueThisWeek, doneThisWeek, logs7d, hours7d })),
    attention: risky.slice(0, 12).map(({ t, risk }) => ({
      title: t.title,
      people: t.assigneeIds.map(name).join(", ") || "unassigned",
      due: t.dueDate,
      days: t.dueDate ? daysUntil(t.dueDate, today) : undefined,
      status: status(t.status),
      risk,
    })),
    recentWork: ws.data.worklogs.slice(0, 15).map((w) => `${w.date} ${name(w.memberId ?? "")}: ${w.description}`.slice(0, 160)),
  };
}

const say = (lang: Language, bn: string, banglish: string, en: string) => (lang === "bn" ? bn : lang === "banglish" ? banglish : en);

/** A briefing from the facts alone (demo mode: no AI). */
export function plainBriefing(f: BriefingFacts): Briefing {
  const L = f.language;
  const items: Briefing["items"] = [];
  for (const a of f.attention.filter((x) => x.risk === "late").slice(0, 4)) {
    items.push({ tone: "risk", text: say(L, `"${a.title}" (${a.people}) ${-(a.days ?? 0)} দিন দেরি।`, `"${a.title}" (${a.people}) ${-(a.days ?? 0)} din deri hoye geche.`, `"${a.title}" (${a.people}) is ${-(a.days ?? 0)} day(s) late.`) });
  }
  for (const a of f.attention.filter((x) => x.risk === "at_risk").slice(0, 4)) {
    items.push({ tone: "warn", text: say(L, `"${a.title}" ${a.days} দিনে ডেডলাইন, এখনো শুরু হয়নি (${a.people})।`, `"${a.title}" er deadline ${a.days} din por, ekhono shuru hoyni (${a.people}).`, `"${a.title}" is due in ${a.days} day(s) and not started (${a.people}).`) });
  }
  const busiest = [...f.people].sort((a, b) => b.open - a.open)[0];
  const idle = f.people.filter((p) => p.open === 0);
  if (busiest && busiest.open >= 3) items.push({ tone: "warn", text: say(L, `${busiest.name}-এর হাতে ${busiest.open}টি কাজ, সবচেয়ে বেশি।`, `${busiest.name} er hate ${busiest.open} ta kaj, shobcheye beshi.`, `${busiest.name} has the most open work (${busiest.open} tasks).`) });
  if (idle.length && f.totals.open) items.push({ tone: "info", text: say(L, `${idle.map((p) => p.name).join(", ")}-এর হাতে এখন কোনো কাজ নেই।`, `${idle.map((p) => p.name).join(", ")} er hate ekhon kono kaj nei.`, `${idle.map((p) => p.name).join(", ")} ${idle.length === 1 ? "has" : "have"} no open tasks.`) });
  const noLogs = f.people.filter((p) => p.logs7d === 0 && p.open > 0);
  if (noLogs.length) items.push({ tone: "info", text: say(L, `${noLogs.map((p) => p.name).join(", ")} গত ৭ দিনে কাজের রিপোর্ট দেননি।`, `${noLogs.map((p) => p.name).join(", ")} gato 7 dine kono kajer report dey ni.`, `No work log in 7 days from ${noLogs.map((p) => p.name).join(", ")}.`) });
  if (f.totals.doneThisWeek) items.push({ tone: "good", text: say(L, `এই সপ্তাহে ${f.totals.doneThisWeek}টি কাজ শেষ হয়েছে।`, `Ei shoptahe ${f.totals.doneThisWeek} ta kaj shesh hoyeche.`, `${f.totals.doneThisWeek} task(s) finished this week.`) });
  const actions: string[] = [];
  if (f.totals.late) actions.push(say(L, "দেরি হওয়া কাজগুলোর নতুন ডেডলাইন ঠিক করুন।", "Deri howa kaj gulor notun deadline thik korun.", "Agree new deadlines for the late tasks."));
  if (busiest && idle.length && busiest.open >= 3) actions.push(say(L, `${busiest.name}-এর একটি কাজ ${idle[0].name}-কে দিন।`, `${busiest.name} er ekta kaj ${idle[0].name} ke din.`, `Move one of ${busiest.name}'s tasks to ${idle[0].name}.`));
  if (f.totals.atRisk) actions.push(say(L, "ঝুঁকিতে থাকা কাজগুলো আজই শুরু করতে বলুন।", "Jhukite thaka kaj gulo ajkei shuru korte bolun.", "Ask for the at-risk tasks to start today."));
  const headline = f.totals.open === 0
    ? say(L, "সব কাজ শেষ, কোনো বাকি নেই।", "Shob kaj shesh, kichu baki nei.", "Everything is done. Nothing open.")
    : say(L, `${f.totals.open}টি কাজ চলছে: ${f.totals.late}টি দেরি, ${f.totals.atRisk}টি ঝুঁকিতে।`, `${f.totals.open} ta kaj cholche: ${f.totals.late} ta deri, ${f.totals.atRisk} ta jhukite.`, `${f.totals.open} open tasks: ${f.totals.late} late, ${f.totals.atRisk} at risk.`);
  if (!items.length) items.push({ tone: "good", text: say(L, "কোনো ঝুঁকি দেখা যাচ্ছে না।", "Kono jhuki dekha jacche na.", "No risks spotted.") });
  return { headline, items: items.slice(0, 8), actions };
}
