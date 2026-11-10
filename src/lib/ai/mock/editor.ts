/**
 * DEMO MODE editor: understands a handful of common edit instructions in
 * Bengali / Banglish / English so AI-editing can be tried without an API key.
 * (With DEEPSEEK_API_KEY set, any instruction is handled by the LLM.)
 */
import type { Language, Page, Widget, WorkspaceConfig } from "../../config/types";
import { deepClone, slugify } from "../../utils";
import { detectLanguage } from "../language";
import { pick } from "./helpers";

export interface MockEditResult {
  message: string;
  summary: string[];
  config: WorkspaceConfig;
  understood: boolean;
}

const RE = {
  weekly: /weekly|saptahik|shaptahik|সাপ্তাহিক|week/i,
  daily: /daily|doinik|প্রতিদিন|দৈনিক|day\b|din/i,
  monthly: /monthly|mashik|masik|মাসিক|month/i,
  chart: /chart|graph|report|রিপোর্ট|চার্ট|গ্রাফ/i,
  pie: /pie|পাই/i,
  remove: /remove|delete|bad dao|baad|sorao|soriye|মুছে|বাদ|সরিয়ে|সরাও|hatao/i,
  add: /add|jog|যোগ|যুক্ত|create|banao|তৈরি|new|notun|নতুন/i,
  status: /status|স্ট্যাটাস|অবস্থা/i,
  form: /form|ফর্ম/i,
  metric: /metric|card|kpi|কার্ড/i,
  kanban: /kanban|board|বোর্ড/i,
  calendar: /calendar|ক্যালেন্ডার/i,
  table: /table|টেবিল|list|তালিকা/i,
};

function uniqueId(base: string, used: Set<string>): string {
  let id = slugify(base, "w");
  let n = 2;
  while (used.has(id)) id = `${slugify(base, "w")}_${n++}`;
  used.add(id);
  return id;
}

function allWidgetIds(c: WorkspaceConfig) {
  return new Set(c.pages.flatMap((p) => p.widgets.map((w) => w.id)));
}

function bestPage(c: WorkspaceConfig, re: RegExp): Page {
  return c.pages.find((p) => re.test(p.title) || p.widgets.some((w) => re.test(w.title))) ?? c.pages[0];
}

function trendSource(c: WorkspaceConfig): { source: string; dateField: string } {
  const col = c.collections[0];
  if (col) return { source: col.id, dateField: "createdAt" };
  return { source: "tasks", dateField: "createdAt" };
}

const PERSON_WORDS = /(developer|tester|designer|manager|employee|staff|operator|member|officer|intern|কর্মী|সদস্য|ডেভেলপার|টেস্টার|ম্যানেজার|অপারেটর|people|person|lok|jon\b|জন)/i;
const NUM_WORDS: Record<string, number> = { ek: 1, ekjon: 1, one: 1, dui: 2, two: 2, tin: 3, three: 3, char: 4, four: 4, pach: 5, five: 5, "এক": 1, "দুই": 2, "তিন": 3, "চার": 4, "পাঁচ": 5 };
const BN_DIGITS = "০১২৩৪৫৬৭৮৯";

/** Detects "add N <role>" / "add <role>: Name, Name" in any of the three languages. */
function matchPeople(text: string, config: WorkspaceConfig): { count: number; role: string; names: string[] } | null {
  if (!PERSON_WORDS.test(text)) return null;
  const roleHit = text.match(/(developer|tester|designer|manager|employee|staff|operator|officer|intern|ডেভেলপার|টেস্টার|ম্যানেজার|অপারেটর|কর্মী)/i)?.[1];
  const role = roleHit ?? config.team.roles[config.team.roles.length - 1]?.name ?? "Member";
  const norm = text.replace(/[০-৯]/g, (d) => String(BN_DIGITS.indexOf(d)));
  const n = norm.match(/(\d+)\s*(?:jon|জন|ta|টা|new|notun|নতুন)?/i)?.[1];
  const word = Object.keys(NUM_WORDS).find((w) => new RegExp(`(^|\\s)${w}(\\s|jon|$)`, "i").test(norm));
  // names after ":" or "name/nam/named/নাম"
  const list = norm.split(/[:：]|\b(?:named|name|nam)\b|নাম/i)[1];
  const names = list
    ? list.split(/,|\band\b|\bar\b|ও|এবং|\//i).map((s) => s.replace(/\b(add|koro|kore|dao|please)\b|যোগ করো|যোগ করুন/gi, "").trim()).filter((s) => s && s.length <= 40 && !/\d/.test(s))
    : [];
  const count = names.length || (n ? Math.min(Number(n), 20) : word ? NUM_WORDS[word] : 1);
  return count > 0 ? { count, role, names } : null;
}

export function mockEdit(instruction: string, current: WorkspaceConfig): MockEditResult {
  const config = deepClone(current);
  const lang: Language = config.language ?? detectLanguage(instruction);
  const L = pick(lang);
  const summary: string[] = [];
  const ids = allWidgetIds(config);
  const text = instruction;

  // 1) Remove widgets ("Monthly report ta remove kore…")
  if (RE.remove.test(text)) {
    const target = RE.monthly.test(text) ? "month" : RE.weekly.test(text) && !RE.daily.test(text) ? "week" : null;
    for (const page of config.pages) {
      const before = page.widgets.length;
      page.widgets = page.widgets.filter((w) => {
        const bucket = "dateBucket" in w ? w.dateBucket : undefined;
        const titleHit = target === "month" ? RE.monthly.test(w.title) : target === "week" ? RE.weekly.test(w.title) : false;
        const kill = target ? bucket === target || titleHit : false;
        if (kill) summary.push(L(`"${w.title}" সরানো হয়েছে`, `Removed "${w.title}"`));
        return !kill;
      });
      void before;
    }
    if (!target) {
      // remove by quoted/explicit title words
      const words = text.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
      for (const page of config.pages) {
        page.widgets = page.widgets.filter((w) => {
          const hit = words.some((word) => w.title.toLowerCase().includes(word));
          if (hit && !RE.add.test(text)) summary.push(L(`"${w.title}" সরানো হয়েছে`, `Removed "${w.title}"`));
          return !(hit && !RE.add.test(text));
        });
      }
    }
  }

  // 1b) Add people ("2 jon notun developer add koro: Rahim, Karim")
  const people = !RE.form.test(text) && !RE.chart.test(text) && RE.add.test(text) ? matchPeople(text, config) : null;
  if (people) {
    const used = new Set(config.team.members.map((m) => m.id));
    let role: (typeof config.team.roles)[number] | undefined = config.team.roles.find((r) => r.name.toLowerCase().includes(people.role.toLowerCase()) || people.role.toLowerCase().includes(r.name.toLowerCase()));
    if (!role) {
      role = { id: uniqueId(people.role, new Set(config.team.roles.map((r) => r.id))), name: people.role.charAt(0).toUpperCase() + people.role.slice(1) };
      config.team.roles.push(role);
    }
    const r0 = role;
    const names = people.names.length ? people.names : Array.from({ length: people.count }, (_, i) => `${r0.name} ${config.team.members.length + i + 1}`);
    for (const name of names) config.team.members.push({ id: uniqueId(`m_${name}`, used), name, roleId: r0.id });
    summary.push(L(`${names.length} জন নতুন ${r0.name} যোগ হয়েছে: ${names.join(", ")}`, `Added ${names.length} new ${r0.name}: ${names.join(", ")}`));
    if (!people.names.length) summary.push(L("নামগুলো জানালে বদলে দেব", "Tell me their names and I'll rename them"));
  }

  // 2) Add status ("Task board e ekta Review status add koro")
  else if (RE.status.test(text) && RE.add.test(text)) {
    const m = text.match(/([\p{L}\p{M}]+)\s+(?:status|স্ট্যাটাস)/iu);
    const label = m?.[1] && !/ekta|একটি|a|an|new|notun|নতুন/i.test(m[1]) ? m[1] : L("রিভিউ", "Review");
    const id = slugify(label, "status_new");
    if (!config.taskStatuses.some((s) => s.id === id || s.label.toLowerCase() === label.toLowerCase())) {
      const doneIdx = config.taskStatuses.findIndex((s) => s.isDone);
      const insertAt = doneIdx === -1 ? config.taskStatuses.length : doneIdx;
      config.taskStatuses.splice(insertAt, 0, { id: config.taskStatuses.some((s) => s.id === id) ? `${id}_2` : id, label: label.charAt(0).toUpperCase() + label.slice(1), color: "violet" });
      summary.push(L(`কাজের বোর্ডে "${label}" স্ট্যাটাস যোগ হয়েছে`, `Added "${label}" status to the task board`));
    } else {
      summary.push(L(`"${label}" স্ট্যাটাস আগে থেকেই আছে — কোনো পরিবর্তন নেই`, `"${label}" status already exists — nothing to change`));
    }
  }

  // 3) Add a form ("Employee der jonno daily work submission form add koro")
  else if (RE.form.test(text) && RE.add.test(text)) {
    const m = text.match(/(?:jonno|জন্য|for)\s+(.+?)\s+(?:form|ফর্ম)/i) ?? text.match(/(?:ekta|একটি|a|an)\s+(.+?)\s+(?:form|ফর্ম)/i);
    let name = (m?.[1] ?? L("নতুন", "New")).replace(/^(ekta|একটি|a|an)\s+/i, "").trim();
    if (name.split(/\s+/).length > 5) name = name.split(/\s+/).slice(-4).join(" ");
    const formName = `${name.charAt(0).toUpperCase()}${name.slice(1)} ${L("ফর্ম", "Form")}`;
    const isWork = RE.daily.test(text) || /work|kaj|কাজ/i.test(text);
    let colId = slugify(name, "form_entries");
    while (config.collections.some((c) => c.id === colId) || colId === "tasks" || colId === "worklogs") colId += "_2";
    config.collections.push({
      id: colId,
      name: formName.replace(/ (Form|ফর্ম)$/, ""),
      fields: isWork
        ? [
            { id: "employee", label: L("কর্মী", "Employee"), type: "member", required: true },
            { id: "work_date", label: L("তারিখ", "Date"), type: "date", required: true },
            { id: "work_done", label: L("আজকের কাজ", "Work done today"), type: "textarea", required: true },
            { id: "hours", label: L("ঘণ্টা", "Hours"), type: "number" },
            { id: "blockers", label: L("সমস্যা / বাধা", "Blockers"), type: "textarea" },
          ]
        : [
            { id: "name", label: L("নাম", "Name"), type: "text", required: true },
            { id: "details", label: L("বিবরণ", "Details"), type: "textarea" },
            { id: "entry_date", label: L("তারিখ", "Date"), type: "date" },
          ],
    });
    const pageId = uniqueId(colId + "_page", new Set(config.pages.map((p) => p.id)));
    config.pages.push({
      id: pageId,
      title: formName.replace(/ (Form|ফর্ম)$/, ""),
      icon: "form",
      widgets: [
        { id: uniqueId(colId + "_form", ids), type: "form", title: formName, width: 2, collectionId: colId },
        { id: uniqueId(colId + "_table", ids), type: "table", title: L("জমা দেওয়া এন্ট্রি", "Submissions"), width: 2, source: colId, columns: isWork ? ["employee", "work_date", "work_done", "hours"] : ["name", "details", "entry_date"] },
      ],
    });
    summary.push(L(`নতুন "${formName}" ও তার টেবিল সহ একটি পেজ যোগ হয়েছে`, `Added "${formName}" with a submissions table on a new page`));
  }

  // 4) Add a time-based report chart (weekly/daily/monthly)
  else if (RE.add.test(text) && (RE.chart.test(text) || RE.weekly.test(text) || RE.daily.test(text) || RE.monthly.test(text))) {
    const addPart = text.split(RE.remove).pop() ?? text; // "remove X kore daily add" → part after remove
    const bucket = RE.weekly.test(addPart) ? "week" : RE.monthly.test(addPart) ? "month" : RE.daily.test(addPart) ? "day" : "week";
    const label = { day: L("দৈনিক", "Daily"), week: L("সাপ্তাহিক", "Weekly"), month: L("মাসিক", "Monthly") }[bucket];
    const page = bestPage(config, /dashboard|overview|ড্যাশবোর্ড|ওভারভিউ|report|রিপোর্ট/i);
    const { source, dateField } = trendSource(config);
    if (RE.pie.test(addPart)) {
      page.widgets.push({ id: uniqueId("pie_status", ids), type: "pieChart", title: L("কাজের অবস্থা", "Task status"), width: 2, source: "tasks", groupBy: "status", aggregate: "count" });
      summary.push(L("পাই চার্ট যোগ হয়েছে", "Added a pie chart of task status"));
    } else {
      const w: Widget = { id: uniqueId(`${bucket}_report`, ids), type: "lineChart", title: `${label} ${L("রিপোর্ট", "report")}`, width: 2, source, dateField, dateBucket: bucket as "day" | "week" | "month", aggregate: "count", periods: bucket === "day" ? 14 : bucket === "week" ? 8 : 6 };
      page.widgets.push(w);
      summary.push(L(`"${page.title}" পেজে ${label} রিপোর্ট চার্ট যোগ হয়েছে`, `Added a ${label.toLowerCase()} report chart to "${page.title}"`));
    }
  }

  // 5) Other quick adds
  else if (RE.add.test(text) && RE.kanban.test(text)) {
    bestPage(config, /task|কাজ/i).widgets.push({ id: uniqueId("kanban", ids), type: "kanban", title: L("কাজের বোর্ড", "Task board"), width: 4 });
    summary.push(L("কাজের বোর্ড যোগ হয়েছে", "Added a task board"));
  } else if (RE.add.test(text) && RE.calendar.test(text)) {
    bestPage(config, /task|কাজ/i).widgets.push({ id: uniqueId("calendar", ids), type: "calendar", title: L("ক্যালেন্ডার", "Calendar"), width: 4, source: "tasks", dateField: "dueDate", titleField: "title" });
    summary.push(L("ক্যালেন্ডার যোগ হয়েছে", "Added a calendar"));
  } else if (RE.add.test(text) && RE.metric.test(text)) {
    config.pages[0].widgets.unshift({ id: uniqueId("metric", ids), type: "metric", title: L("মোট কাজ", "Total tasks"), width: 1, source: "tasks", aggregate: "count" });
    summary.push(L("মেট্রিক কার্ড যোগ হয়েছে", "Added a metric card"));
  }

  const understood = summary.length > 0;
  return {
    understood,
    summary,
    config,
    message: understood
      ? L("প্রস্তুত। প্রিভিউ দেখে প্রয়োগ করুন।", lang === "banglish" ? "Ready. Preview dekhe apply koro." : "Ready. Check the preview and apply.")
      : L(
          "ডেমো মোডে এই নির্দেশনা বুঝতে পারিনি। উদাহরণ: \"সাপ্তাহিক রিপোর্ট চার্ট যোগ করো\", \"Review status add koro\", \"daily work submission form add koro\"। যেকোনো নির্দেশনার জন্য DEEPSEEK_API_KEY সেট করুন।",
          "Demo mode didn't understand this instruction. Try: \"add a weekly report chart\", \"add a Review status\", \"add a daily work submission form\". Set DEEPSEEK_API_KEY for free-form edits.",
        ),
  };
}
