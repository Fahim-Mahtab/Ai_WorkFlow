/**
 * DEMO MODE generator (used when DEEPSEEK_API_KEY is not set).
 * A deterministic, rule-based stand-in for the LLM: it reads the prompt,
 * detects domain/team size/fields and emits the SAME JSON contract the LLM
 * must produce. Output still goes through Zod + registry validation.
 */
import type { Language } from "../../config/types";
import { detectLanguage } from "../language";
import { extractFieldList, extractRoleCount, extractTeamSize, fieldId, guessFieldType, names, normalizePrompt, pick } from "./helpers";
import { slugify } from "../../utils";

type Json = Record<string, unknown>;

export interface MockGenerateResult {
  message: string;
  analysis: Json;
  needsClarification: boolean;
  questions: string[];
  config: Json | null;
}

const say = (lang: Language, bn: string, banglish: string, en: string) => (lang === "bn" ? bn : lang === "banglish" ? banglish : en);
const PEOPLE_Q = (lang: Language) => say(lang, "টিমে কারা আছেন (নাম ও পদ)? নতুন কাউকে যোগ করতে হবে?", "Team e kara ache (nam ar role)? Notun kauke add korte hobe?", "Who's on the team (names and roles)? Anyone new to add?");

function priorities(lang: Language) {
  const L = pick(lang);
  return [
    { id: "low", label: L("নিম্ন", "Low") },
    { id: "medium", label: L("মাঝারি", "Medium") },
    { id: "high", label: L("উচ্চ", "High") },
    { id: "urgent", label: L("জরুরি", "Urgent") },
  ];
}

export function detectDomain(prompt: string): "municipality" | "software" | "generic" {
  const p = normalizePrompt(prompt);
  if (/পৌরসভা|পৌর|municipal|pouroshova|pourashava|citizen|নাগরিক|nid|ward|ওয়ার্ড|data entry|ডাটা এন্ট্রি|ডেটা এন্ট্রি/.test(p)) return "municipality";
  if (/software|সফটওয়্যার|developer|ডেভেলপার|bug|বাগ|sprint|স্প্রিন্ট|deploy|tester|qa\b|code|api|devops/.test(p)) return "software";
  return "generic";
}

export function mockGenerate(prompt: string, forceGenerate = false): MockGenerateResult {
  const lang = detectLanguage(prompt);
  const domain = detectDomain(prompt);
  const words = prompt.trim().split(/\s+/).filter(Boolean);
  if (domain === "generic" && words.length < 5 && !forceGenerate) {
    return {
      message: say(lang, "আরও একটু তথ্য দিলে আমি ভালো dashboard বানাতে পারব।", "Aro ektu details dile ami valo dashboard banate parbo.", "I need a bit more detail to build a useful dashboard."),
      analysis: { language: lang, businessContext: prompt, roles: [], sections: [], dataFields: [], tasks: [], suggestedReports: [] },
      needsClarification: true,
      questions: [
        say(lang, "এটা কোন ধরনের কাজ বা প্রতিষ্ঠানের জন্য?", "Eta kon dhoroner kaj ba protishthan er jonno?", "What kind of work or organisation is this for?"),
        say(lang, "কতজন সদস্য কাজ করবেন এবং তাদের ভূমিকা কী?", "Koto jon member kaj korbe ar tader role ki?", "How many people will work on it and what are their roles?"),
        say(lang, "কোন তথ্য সংগ্রহ বা ট্র্যাক করতে চান?", "Kon data collect ba track korte chan?", "What information do you need to collect or track?"),
      ],
      config: null,
    };
  }
  if (domain === "municipality") return municipality(prompt, lang);
  if (domain === "software") return software(prompt, lang);
  return generic(prompt, lang);
}

/* ------------------------------------------------------------------ */
/* Municipality data-entry                                            */
/* ------------------------------------------------------------------ */
function municipality(prompt: string, lang: Language): MockGenerateResult {
  const L = pick(lang);
  const count = extractTeamSize(prompt) ?? 10;
  const staff = names(lang, count, { bn: "অপারেটর", en: "Operator" });
  const managerName = L("ম্যানেজার", "Manager");
  const members = [
    { id: "m0", name: managerName, roleId: "manager" },
    ...staff.map((n, i) => ({ id: `m${i + 1}`, name: n, roleId: "operator" })),
  ];
  const wards = Array.from({ length: 9 }, (_, i) => L(`ওয়ার্ড ${"১২৩৪৫৬৭৮৯"[i]}`, `Ward ${i + 1}`));
  const reviewOpts = [L("অপেক্ষমাণ", "Pending"), L("অনুমোদিত", "Approved"), L("সংশোধন প্রয়োজন", "Needs correction")];

  const listed = extractFieldList(prompt);
  const baseFields =
    listed.length >= 3
      ? listed.map((label, i) => {
          const g = guessFieldType(label);
          const id = fieldId(label, i);
          return { id, label: localizeCitizenLabel(label, lang), type: id === "ward_no" ? "select" : g.type, required: i < 3 || id === "mobile", ...(id === "ward_no" ? { options: wards } : g.options ? { options: g.options } : {}), ...(id === "nid" ? { placeholder: L("১০ বা ১৭ ডিজিট", "10 or 17 digits") } : {}) };
        })
      : [
          { id: "citizen_name", label: L("নাগরিকের নাম", "Citizen Name"), type: "text", required: true },
          { id: "nid", label: "NID", type: "text", required: true, placeholder: L("১০ বা ১৭ ডিজিট", "10 or 17 digits") },
          { id: "ward_no", label: L("ওয়ার্ড নম্বর", "Ward Number"), type: "select", options: wards, required: true },
          { id: "mobile", label: L("মোবাইল নম্বর", "Mobile Number"), type: "phone", required: true },
          { id: "address", label: L("ঠিকানা", "Address"), type: "textarea" },
        ];
  const citizenFields = [
    ...baseFields,
    { id: "review_status", label: L("রিভিউ অবস্থা", "Review Status"), type: "select", options: reviewOpts },
  ];
  const wardField = citizenFields.find((f) => f.id === "ward_no") ? "ward_no" : citizenFields[0].id;
  const nameField = citizenFields.find((f) => f.id === "citizen_name")?.id ?? citizenFields[0].id;

  const citizenNames = lang === "bn" ? ["আব্দুল কাদের", "রোকেয়া বেগম", "মোহাম্মদ সেলিম", "পারভীন আক্তার", "হাবিবুর রহমান", "জান্নাতুল ফেরদৌস"] : ["Abdul Kader", "Rokeya Begum", "Mohammad Selim", "Parvin Akter", "Habibur Rahman", "Jannatul Ferdous"];
  const records = citizenNames.map((n, i) => ({
    [nameField]: n,
    nid: String(1990000000000 + i * 7919).slice(0, i % 2 ? 10 : 13),
    [wardField]: wards[i % 4],
    mobile: `017${(11223344 + i * 1111).toString().slice(0, 8)}`,
    address: L(`বাড়ি ${i + 3}, রোড ${i + 1}, ${wards[i % 4]}`, `House ${i + 3}, Road ${i + 1}, ${wards[i % 4]}`),
    review_status: reviewOpts[i % 3],
    createdBy: `m${(i % count) + 1}`,
  }));

  const config = {
    version: 1,
    name: L("পৌরসভা ডাটা এন্ট্রি ব্যবস্থাপনা", "Municipality Data Entry Management"),
    description: L(`${count} জন কর্মীর নাগরিক তথ্য এন্ট্রি, কাজ বণ্টন, দৈনিক অগ্রগতি ও ম্যানেজার রিভিউ`, `Citizen information entry by ${count} staff with task assignment, daily progress and manager review`),
    language: lang,
    team: {
      roles: [
        { id: "manager", name: L("ম্যানেজার", "Manager"), description: L("কাজ বণ্টন ও এন্ট্রি রিভিউ করেন", "Assigns work and reviews entries") },
        { id: "operator", name: L("ডাটা এন্ট্রি অপারেটর", "Data Entry Operator"), description: L("নাগরিক তথ্য এন্ট্রি করেন", "Enters citizen information") },
      ],
      members,
    },
    taskStatuses: [
      { id: "todo", label: L("বাকি", "To Do"), color: "slate" },
      { id: "in_progress", label: L("চলমান", "In Progress"), color: "blue" },
      { id: "review", label: L("রিভিউতে", "In Review"), color: "amber" },
      { id: "returned", label: L("সংশোধনে ফেরত", "Returned"), color: "red" },
      { id: "approved", label: L("অনুমোদিত", "Approved"), color: "green", isDone: true },
    ],
    priorities: priorities(lang),
    taskFields: [
      { id: "ward", label: L("ওয়ার্ড", "Ward"), type: "select", options: wards },
      { id: "target_entries", label: L("লক্ষ্য এন্ট্রি", "Target entries"), type: "number" },
    ],
    collections: [{ id: "citizens", name: L("নাগরিক তথ্য", "Citizen Records"), description: L("নাগরিক নিবন্ধন ফর্মের মাধ্যমে সংগৃহীত তথ্য", "Data collected through the citizen registration form"), fields: citizenFields }],
    pages: [
      {
        id: "overview", title: L("ড্যাশবোর্ড", "Dashboard"), icon: "dashboard",
        widgets: [
          { id: "m_total", type: "metric", title: L("মোট নাগরিক এন্ট্রি", "Total citizen entries"), width: 1, source: "citizens", aggregate: "count", color: "blue" },
          { id: "m_today", type: "metric", title: L("আজকের এন্ট্রি", "Entries today"), width: 1, source: "citizens", aggregate: "count", dateRange: "today", color: "green" },
          { id: "m_pending", type: "metric", title: L("রিভিউ অপেক্ষমাণ", "Pending review"), width: 1, source: "citizens", aggregate: "count", filter: { field: "review_status", op: "eq", value: reviewOpts[0] }, color: "amber" },
          { id: "m_tasks", type: "metric", title: L("চলমান কাজ", "Open tasks"), width: 1, source: "tasks", aggregate: "count", filter: { field: "status", op: "neq", value: "approved" }, color: "violet" },
          { id: "c_daily", type: "lineChart", title: L("দৈনিক এন্ট্রি অগ্রগতি", "Daily entry progress"), width: 2, source: "citizens", dateField: "createdAt", dateBucket: "day", aggregate: "count", periods: 14 },
          { id: "c_by_op", type: "barChart", title: L("কর্মী অনুযায়ী এন্ট্রি", "Entries per operator"), width: 2, source: "citizens", groupBy: "createdBy", aggregate: "count" },
          { id: "p_members", type: "progress", title: L("কর্মীদের কাজের অগ্রগতি", "Staff task progress"), width: 2, source: "tasks", mode: "byMember" },
          { id: "feed", type: "activity", title: L("সাম্প্রতিক কার্যক্রম", "Recent activity"), width: 2, limit: 8 },
        ],
      },
      {
        id: "registration", title: L("নাগরিক নিবন্ধন", "Citizen Registration"), icon: "form",
        widgets: [
          { id: "f_citizen", type: "form", title: L("নাগরিক নিবন্ধন ফর্ম", "Citizen Registration Form"), width: 2, collectionId: "citizens", submitLabel: L("এন্ট্রি জমা দিন", "Submit entry"), successMessage: L("নাগরিক তথ্য সংরক্ষিত হয়েছে", "Citizen record saved") },
          { id: "t_citizen", type: "table", title: L("নাগরিক তালিকা", "Citizen list"), width: 2, source: "citizens", columns: [nameField, "nid", wardField, "mobile", "review_status"].filter((c, i, a) => citizenFields.some((f) => f.id === c) && a.indexOf(c) === i), pageSize: 8 },
        ],
      },
      {
        id: "tasks", title: L("কাজ বণ্টন", "Employee Task Management"), icon: "kanban",
        widgets: [
          { id: "k_tasks", type: "kanban", title: L("কাজের বোর্ড", "Task board"), width: 4 },
          { id: "tl_open", type: "taskList", title: L("চলমান কাজের তালিকা", "Open task list"), width: 2, showCompleted: false, limit: 8 },
          { id: "cal", type: "calendar", title: L("শেষ তারিখের ক্যালেন্ডার", "Deadline calendar"), width: 2, source: "tasks", dateField: "dueDate", titleField: "title" },
        ],
      },
      {
        id: "daily", title: L("দৈনিক রিপোর্ট", "Daily Reports"), icon: "clipboard",
        widgets: [
          { id: "wl", type: "worklog", title: L("আজকের কাজের রিপোর্ট", "Today's work report"), width: 2, showRecent: 5 },
          { id: "c_wl_member", type: "barChart", title: L("কর্মী অনুযায়ী দৈনিক রিপোর্ট", "Daily reports per staff"), width: 2, source: "worklogs", groupBy: "memberId", aggregate: "count" },
          { id: "t_wl", type: "table", title: L("দৈনিক কাজের লগ", "Daily work log"), width: 4, source: "worklogs", columns: ["date", "memberId", "description", "category", "status"], pageSize: 10 },
        ],
      },
      {
        id: "review", title: L("ম্যানেজার রিভিউ", "Manager Review"), icon: "review",
        widgets: [
          { id: "pie_review", type: "pieChart", title: L("রিভিউ অবস্থা", "Review status"), width: 2, source: "citizens", groupBy: "review_status", aggregate: "count" },
          { id: "pie_task", type: "pieChart", title: L("কাজের অবস্থা", "Task status"), width: 2, source: "tasks", groupBy: "status", aggregate: "count" },
          { id: "t_pending", type: "table", title: L("রিভিউয়ের অপেক্ষায় এন্ট্রি", "Entries awaiting review"), width: 4, source: "citizens", columns: [nameField, "nid", wardField, "createdBy", "review_status"].filter((c, i, a) => (citizenFields.some((f) => f.id === c) || c === "createdBy") && a.indexOf(c) === i), filter: { field: "review_status", op: "eq", value: reviewOpts[0] } },
        ],
      },
      {
        id: "analytics", title: L("অগ্রগতি বিশ্লেষণ", "Progress Analytics"), icon: "chart",
        widgets: [
          { id: "p_target", type: "progress", title: L("মোট লক্ষ্য অগ্রগতি", "Overall target progress"), width: 2, source: "citizens", mode: "target", target: 5000 },
          { id: "p_done", type: "progress", title: L("কাজ সম্পন্নের হার", "Task completion rate"), width: 2, source: "tasks", mode: "completion" },
          { id: "c_ward", type: "barChart", title: L("ওয়ার্ড অনুযায়ী এন্ট্রি", "Entries by ward"), width: 2, source: "citizens", groupBy: wardField, aggregate: "count" },
          { id: "c_weekly", type: "lineChart", title: L("সাপ্তাহিক এন্ট্রি", "Weekly entries"), width: 2, source: "citizens", dateField: "createdAt", dateBucket: "week", aggregate: "count", periods: 8 },
        ],
      },
    ],
    reports: [L("দৈনিক কর্মী-ভিত্তিক এন্ট্রি রিপোর্ট", "Daily per-operator entry report"), L("ওয়ার্ড-ভিত্তিক অগ্রগতি", "Ward-wise progress"), L("রিভিউ অনুমোদন হার", "Review approval rate")],
    seed: {
      tasks: Array.from({ length: Math.min(count, 10) }, (_, i) => ({
        title: L(`${wards[i % 9]}-এর নাগরিক তথ্য এন্ট্রি`, `Citizen data entry — ${wards[i % 9]}`),
        description: L("নির্ধারিত ওয়ার্ডের সকল নাগরিকের তথ্য ফর্মে এন্ট্রি করুন", "Enter all citizen records of the assigned ward"),
        status: ["todo", "in_progress", "in_progress", "review", "approved", "returned"][i % 6],
        priority: ["medium", "high", "medium", "urgent", "low"][i % 5],
        assigneeIds: [`m${i + 1}`],
        dueInDays: (i % 5) - 1,
        custom: { ward: wards[i % 9], target_entries: 300 + i * 50 },
        ...(i < 3 ? { subtasks: [L("কাগজপত্র সংগ্রহ", "Collect paper forms"), L("তথ্য এন্ট্রি", "Enter data"), L("দ্বিতীয়বার যাচাই", "Double-check entries")] } : {}),
      })).concat([{ title: L("সাপ্তাহিক এন্ট্রি রিভিউ", "Weekly entry review"), description: L("সকল অপেক্ষমাণ এন্ট্রি যাচাই ও অনুমোদন", "Verify and approve pending entries"), status: "in_progress", priority: "high", assigneeIds: ["m0"], dueInDays: 2, custom: {} } as never]),
      records: { citizens: records },
    },
  };

  return {
    message: say(
      lang,
      `${count} জন কর্মীর জন্য ডাটা এন্ট্রি ড্যাশবোর্ড তৈরি। রিভিউয়ের জন্য একজন ম্যানেজার যোগ করেছি।`,
      `${count} jon staff er data entry dashboard ready. Review er jonno ekjon Manager add korechi.`,
      `Data-entry workspace ready for ${count} staff. I added a Manager to review entries.`,
    ),
    analysis: {
      language: lang,
      businessContext: L("পৌরসভার নাগরিক তথ্য ডিজিটাইজেশন প্রকল্প", "Municipality citizen-information digitisation project"),
      roles: [L("ম্যানেজার (রিভিউয়ার)", "Manager (reviewer)"), L(`ডাটা এন্ট্রি অপারেটর × ${count}`, `Data entry operator × ${count}`)],
      sections: config.pages.map((p) => p.title),
      dataFields: citizenFields.map((f) => f.label),
      tasks: [L("ওয়ার্ডভিত্তিক এন্ট্রি কাজ বণ্টন", "Ward-wise entry assignments"), L("এন্ট্রি যাচাই ও রিভিউ", "Entry verification & review")],
      deadlinesAndPriorities: L("প্রতিটি ওয়ার্ডের কাজের শেষ তারিখ ও অগ্রাধিকার নির্ধারণযোগ্য", "Each ward assignment has a due date and priority"),
      suggestedReports: config.reports,
    },
    needsClarification: false,
    questions: [PEOPLE_Q(lang), say(lang, "দৈনিক এন্ট্রির লক্ষ্য কত? (বর্তমানে মোট লক্ষ্য ৫০০০ ধরা হয়েছে)", "Daily entry target koto? (ekhon total target 5000 dhora hoyeche)", "What is the entry target? (I assumed 5,000 total)")],
    config,
  };
}

function localizeCitizenLabel(label: string, lang: Language): string {
  if (lang !== "bn") return label;
  const map: [RegExp, string][] = [
    [/citizen\s*name/i, "নাগরিকের নাম"],
    [/^nid$/i, "NID"],
    [/ward/i, "ওয়ার্ড নম্বর"],
    [/mobile|phone/i, "মোবাইল নম্বর"],
    [/address/i, "ঠিকানা"],
  ];
  for (const [re, bn] of map) if (re.test(label)) return bn;
  return label;
}

/* ------------------------------------------------------------------ */
/* Software development                                               */
/* ------------------------------------------------------------------ */
function software(prompt: string, lang: Language): MockGenerateResult {
  const L = pick(lang);
  const devs = extractRoleCount(prompt, ["developer", "dev", "ডেভেলপার", "engineer", "programmer"]) ?? (extractTeamSize(prompt) ? Math.max(1, (extractTeamSize(prompt) ?? 5) - 1) : 4);
  const explicitDevs = extractRoleCount(prompt, ["developer", "dev", "ডেভেলপার", "engineer", "programmer"]) !== undefined;
  const testers = extractRoleCount(prompt, ["tester", "qa", "টেস্টার"]) ?? (explicitDevs ? 0 : 1);
  const devNames = names(lang, devs, { bn: "ডেভেলপার", en: "Developer" });
  const testerNames = names(lang, testers, { bn: "টেস্টার", en: "Tester" });
  const members = [
    ...devNames.map((n, i) => ({ id: `dev${i + 1}`, name: n, roleId: "developer" })),
    ...testerNames.map((n, i) => ({ id: `qa${i + 1}`, name: n, roleId: "tester" })),
  ];
  const devIds = members.filter((m) => m.roleId === "developer").map((m) => m.id);
  const qaIds = members.filter((m) => m.roleId === "tester").map((m) => m.id);
  const sprints = ["Sprint 1", "Sprint 2", "Sprint 3"];
  const severities = [L("সাধারণ", "Low"), L("মাঝারি", "Medium"), L("গুরুতর", "High"), L("জরুরি", "Critical")];
  const bugStatuses = [L("খোলা", "Open"), L("চলমান", "In Progress"), L("ঠিক হয়েছে", "Fixed"), L("বন্ধ", "Closed")];
  const envs = ["Development", "Staging", "Production"];
  const depStatus = [L("সফল", "Success"), L("ব্যর্থ", "Failed"), L("চলমান", "In Progress"), L("রোলব্যাক", "Rolled back")];
  const modules = ["Auth", "Payments", "Dashboard", "API", "Mobile App"];

  const taskTitles = lang === "bn"
    ? ["লগইন API তৈরি", "পেমেন্ট গেটওয়ে ইন্টিগ্রেশন", "ড্যাশবোর্ড UI রিডিজাইন", "ডাটাবেস ইনডেক্স অপ্টিমাইজেশন", "পুশ নোটিফিকেশন", "রিগ্রেশন টেস্ট স্যুট", "রিপোর্ট এক্সপোর্ট ফিচার", "CI/CD পাইপলাইন সেটআপ", "ইউজার প্রোফাইল পেজ", "লোড টেস্টিং"]
    : ["Build login API", "Payment gateway integration", "Dashboard UI redesign", "Optimize database indexes", "Push notifications", "Regression test suite", "Report export feature", "Set up CI/CD pipeline", "User profile page", "Load testing"];

  const config = {
    version: 1,
    name: L("সফটওয়্যার ডেভেলপমেন্ট ড্যাশবোর্ড", "Software Development Dashboard"),
    description: L(`${devs} জন ডেভেলপার${testers ? ` ও ${testers} জন টেস্টারের` : "-এর"} স্প্রিন্ট, বাগ, ডিপ্লয়মেন্ট ও দৈনিক রিপোর্ট`, `Sprints, bugs, deployments and daily reports for ${devs} developers${testers ? ` and ${testers} testers` : ""}`),
    language: lang,
    team: {
      roles: [
        { id: "developer", name: L("ডেভেলপার", "Developer"), description: L("ফিচার তৈরি ও বাগ ফিক্স", "Builds features and fixes bugs") },
        { id: "tester", name: L("টেস্টার (QA)", "Tester (QA)"), description: L("টেস্টিং ও বাগ রিপোর্ট", "Tests and reports bugs") },
      ],
      members,
    },
    taskStatuses: [
      { id: "backlog", label: L("ব্যাকলগ", "Backlog"), color: "slate" },
      { id: "todo", label: L("করণীয়", "To Do"), color: "cyan" },
      { id: "in_progress", label: L("চলমান", "In Progress"), color: "blue" },
      { id: "code_review", label: L("কোড রিভিউ", "Code Review"), color: "violet" },
      { id: "testing", label: L("টেস্টিং", "Testing"), color: "amber" },
      { id: "done", label: L("সম্পন্ন", "Done"), color: "green", isDone: true },
    ],
    priorities: priorities(lang),
    taskFields: [
      { id: "sprint", label: L("স্প্রিন্ট", "Sprint"), type: "select", options: sprints },
      { id: "story_points", label: L("স্টোরি পয়েন্ট", "Story points"), type: "number" },
      { id: "task_type", label: L("ধরন", "Type"), type: "select", options: ["Feature", "Bug", "Chore"] },
    ],
    collections: [
      {
        id: "bugs", name: L("বাগ রিপোর্ট", "Bug Reports"),
        fields: [
          { id: "bug_title", label: L("বাগের শিরোনাম", "Bug title"), type: "text", required: true },
          { id: "module", label: L("মডিউল", "Module"), type: "select", options: modules },
          { id: "severity", label: L("গুরুত্ব", "Severity"), type: "select", options: severities, required: true },
          { id: "bug_status", label: L("অবস্থা", "Status"), type: "select", options: bugStatuses },
          { id: "steps", label: L("পুনরুৎপাদনের ধাপ", "Steps to reproduce"), type: "textarea" },
          { id: "assigned_to", label: L("দায়িত্বপ্রাপ্ত ডেভেলপার", "Assigned developer"), type: "member" },
          { id: "found_on", label: L("শনাক্তের তারিখ", "Found on"), type: "date" },
        ],
      },
      {
        id: "deployments", name: L("ডিপ্লয়মেন্ট", "Deployments"),
        fields: [
          { id: "version", label: L("ভার্সন", "Version"), type: "text", required: true, placeholder: "v1.4.0" },
          { id: "environment", label: L("এনভায়রনমেন্ট", "Environment"), type: "select", options: envs, required: true },
          { id: "deploy_status", label: L("ডিপ্লয় অবস্থা", "Deploy status"), type: "select", options: depStatus, required: true },
          { id: "deploy_date", label: L("ডিপ্লয়ের তারিখ", "Deploy date"), type: "date" },
          { id: "notes", label: L("রিলিজ নোট", "Release notes"), type: "textarea" },
        ],
      },
    ],
    pages: [
      {
        id: "overview", title: L("ওভারভিউ", "Overview"), icon: "dashboard",
        widgets: [
          { id: "m_open", type: "metric", title: L("চলমান টাস্ক", "Open tasks"), width: 1, source: "tasks", aggregate: "count", filter: { field: "status", op: "neq", value: "done" }, color: "blue" },
          { id: "m_bugs", type: "metric", title: L("খোলা বাগ", "Open bugs"), width: 1, source: "bugs", aggregate: "count", filter: { field: "bug_status", op: "eq", value: bugStatuses[0] }, color: "red" },
          { id: "m_points", type: "metric", title: L("মোট স্টোরি পয়েন্ট", "Total story points"), width: 1, source: "tasks", aggregate: "sum", field: "story_points", color: "violet" },
          { id: "m_deploy", type: "metric", title: L("এই সপ্তাহের ডিপ্লয়", "Deploys this week"), width: 1, source: "deployments", aggregate: "count", dateRange: "week", color: "green" },
          { id: "c_status", type: "barChart", title: L("অবস্থা অনুযায়ী টাস্ক", "Tasks by status"), width: 2, source: "tasks", groupBy: "status", aggregate: "count" },
          { id: "c_sev", type: "pieChart", title: L("গুরুত্ব অনুযায়ী বাগ", "Bugs by severity"), width: 2, source: "bugs", groupBy: "severity", aggregate: "count" },
          { id: "p_dev", type: "progress", title: L("ডেভেলপার অগ্রগতি", "Developer progress"), width: 2, source: "tasks", mode: "byMember" },
          { id: "feed", type: "activity", title: L("সাম্প্রতিক কার্যক্রম", "Recent activity"), width: 2, limit: 8 },
        ],
      },
      {
        id: "sprint", title: L("স্প্রিন্ট বোর্ড", "Sprint Board"), icon: "kanban",
        widgets: [
          { id: "p_sprint", type: "progress", title: L("স্প্রিন্ট সম্পন্নের হার", "Sprint completion"), width: 2, source: "tasks", mode: "completion" },
          { id: "c_sprint", type: "barChart", title: L("স্প্রিন্ট অনুযায়ী পয়েন্ট", "Story points per sprint"), width: 2, source: "tasks", groupBy: "sprint", aggregate: "sum", valueField: "story_points" },
          { id: "k_sprint", type: "kanban", title: L("স্প্রিন্ট বোর্ড", "Sprint board"), width: 4 },
        ],
      },
      {
        id: "bugs", title: L("বাগ ট্র্যাকিং", "Bug Tracking"), icon: "bug",
        widgets: [
          { id: "f_bug", type: "form", title: L("বাগ রিপোর্ট ফর্ম", "Bug Tracking Form"), width: 2, collectionId: "bugs", submitLabel: L("বাগ রিপোর্ট করুন", "Report bug") },
          { id: "c_bug_status", type: "pieChart", title: L("বাগের অবস্থা", "Bug status"), width: 2, source: "bugs", groupBy: "bug_status", aggregate: "count" },
          { id: "t_bugs", type: "table", title: L("বাগ তালিকা", "Bug list"), width: 4, source: "bugs", columns: ["bug_title", "module", "severity", "bug_status", "assigned_to", "found_on"], pageSize: 8 },
        ],
      },
      {
        id: "dev_tasks", title: L("ডেভেলপার টাস্ক", "Developer Tasks"), icon: "tasks",
        widgets: [
          { id: "t_tasks", type: "table", title: L("টাস্ক অ্যাসাইনমেন্ট", "Task assignment"), width: 4, source: "tasks", columns: ["title", "assignees", "status", "priority", "sprint", "story_points", "dueDate"], pageSize: 10 },
          { id: "c_member", type: "barChart", title: L("সদস্য অনুযায়ী টাস্ক", "Tasks per member"), width: 2, source: "tasks", groupBy: "assignees", aggregate: "count" },
          { id: "cal_due", type: "calendar", title: L("ডেডলাইন", "Deadlines"), width: 2, source: "tasks", dateField: "dueDate", titleField: "title" },
        ],
      },
      {
        id: "deploy", title: L("ডিপ্লয়মেন্ট স্ট্যাটাস", "Deployment Status"), icon: "rocket",
        widgets: [
          { id: "f_deploy", type: "form", title: L("নতুন ডিপ্লয়মেন্ট", "Log deployment"), width: 2, collectionId: "deployments", submitLabel: L("সংরক্ষণ", "Save deployment") },
          { id: "c_env", type: "barChart", title: L("এনভায়রনমেন্ট অনুযায়ী ডিপ্লয়", "Deploys by environment"), width: 2, source: "deployments", groupBy: "environment", aggregate: "count" },
          { id: "t_deploy", type: "table", title: L("ডিপ্লয়মেন্ট ইতিহাস", "Deployment history"), width: 4, source: "deployments", columns: ["version", "environment", "deploy_status", "deploy_date", "notes"] },
        ],
      },
      {
        id: "daily", title: L("দৈনিক কাজের রিপোর্ট", "Daily Work Reports"), icon: "clipboard",
        widgets: [
          { id: "wl", type: "worklog", title: L("আজকের কাজ লিখুন", "Report today's work"), width: 2, showRecent: 5 },
          { id: "c_hours", type: "barChart", title: L("সদস্য অনুযায়ী ঘণ্টা", "Hours per member"), width: 2, source: "worklogs", groupBy: "memberId", aggregate: "sum", valueField: "hours" },
          { id: "t_wl", type: "table", title: L("দৈনিক রিপোর্ট লগ", "Daily report log"), width: 4, source: "worklogs", columns: ["date", "memberId", "description", "category", "hours"] },
        ],
      },
    ],
    reports: [L("স্প্রিন্ট বার্নডাউন", "Sprint burndown"), L("বাগ রেজোলিউশন টাইম", "Bug resolution time"), L("ডেভেলপার ভেলোসিটি", "Developer velocity")],
    seed: {
      tasks: taskTitles.map((title, i) => ({
        title,
        status: ["in_progress", "code_review", "todo", "done", "testing", "backlog", "in_progress", "done", "todo", "testing"][i],
        priority: ["high", "urgent", "medium", "medium", "low", "high", "medium", "high", "low", "medium"][i],
        assigneeIds: title.match(/test|টেস্ট/i) && qaIds.length ? [qaIds[i % qaIds.length]] : [devIds[i % devIds.length]],
        dueInDays: (i % 7) - 2,
        custom: { sprint: sprints[i % 2], story_points: [5, 8, 3, 2, 5, 8, 3, 5, 2, 3][i], task_type: i === 3 ? "Chore" : "Feature" },
        ...(i < 2 ? { subtasks: [L("ডিজাইন রিভিউ", "Design review"), L("ইমপ্লিমেন্টেশন", "Implementation"), L("ইউনিট টেস্ট", "Unit tests")] } : {}),
      })),
      records: {
        bugs: [
          { bug_title: L("লগইন পেজে ভুল এরর মেসেজ", "Wrong error message on login"), module: "Auth", severity: severities[1], bug_status: bugStatuses[0], assigned_to: devIds[0] },
          { bug_title: L("পেমেন্ট টাইমআউট", "Payment request times out"), module: "Payments", severity: severities[3], bug_status: bugStatuses[1], assigned_to: devIds[1 % devIds.length] },
          { bug_title: L("চার্ট মোবাইলে ভেঙে যায়", "Chart breaks on mobile"), module: "Dashboard", severity: severities[0], bug_status: bugStatuses[2], assigned_to: devIds[2 % devIds.length] },
          { bug_title: L("API রেট লিমিট কাজ করে না", "API rate limit not applied"), module: "API", severity: severities[2], bug_status: bugStatuses[0], assigned_to: devIds[3 % devIds.length] },
        ],
        deployments: [
          { version: "v1.2.0", environment: "Production", deploy_status: depStatus[0], notes: L("পেমেন্ট মডিউল রিলিজ", "Payments module release") },
          { version: "v1.3.0-rc1", environment: "Staging", deploy_status: depStatus[0] },
          { version: "v1.3.0-rc2", environment: "Staging", deploy_status: depStatus[1], notes: L("মাইগ্রেশন ব্যর্থ", "Migration failed") },
        ],
      },
    },
  };

  return {
    message: say(
      lang,
      `${devs} জন ডেভেলপার${testers ? ` ও ${testers} জন টেস্টারের` : "-এর"} জন্য সফটওয়্যার ড্যাশবোর্ড তৈরি।`,
      `${devs} jon developer${testers ? ` ar ${testers} jon tester` : ""} er Software Dashboard ready.`,
      `Software workspace ready for ${devs} developers${testers ? ` and ${testers} testers` : ""}.`,
    ),
    analysis: {
      language: lang,
      businessContext: L("সফটওয়্যার টিমের স্প্রিন্ট-ভিত্তিক ডেভেলপমেন্ট", "Sprint-based software team delivery"),
      roles: [`${L("ডেভেলপার", "Developer")} × ${devs}`, ...(testers ? [`${L("টেস্টার", "Tester")} × ${testers}`] : [])],
      sections: config.pages.map((p) => p.title),
      dataFields: ["Sprint", "Story points", "Severity", "Module", "Environment", "Version"],
      tasks: taskTitles.slice(0, 4),
      deadlinesAndPriorities: L("প্রতিটি টাস্কে স্প্রিন্ট, ডেডলাইন ও অগ্রাধিকার", "Each task carries sprint, due date and priority"),
      suggestedReports: config.reports,
    },
    needsClarification: false,
    questions: [PEOPLE_Q(lang), say(lang, "আপনার স্প্রিন্ট কত দিনের?", "Apnader sprint koto din er?", "How long are your sprints?")],
    config,
  };
}

/* ------------------------------------------------------------------ */
/* Generic project / office work                                      */
/* ------------------------------------------------------------------ */
function generic(prompt: string, lang: Language): MockGenerateResult {
  const L = pick(lang);
  const count = extractTeamSize(prompt) ?? 6;
  const n = [L("ম্যানেজার", "Manager"), ...names(lang, count - 1, { bn: "কর্মী", en: "Employee" })];
  const members = n.map((name, i) => ({ id: `m${i + 1}`, name, roleId: i === 0 ? "manager" : "employee" }));
  const listed = extractFieldList(prompt);
  const hasRecords = listed.length >= 3;
  const p = normalizePrompt(prompt);
  const domainName = /sales|বিক্রয়|crm|customer|গ্রাহক/.test(p)
    ? L("বিক্রয় ও গ্রাহক ব্যবস্থাপনা", "Sales & Customer Management")
    : /school|স্কুল|student|ছাত্র|শিক্ষার্থী/.test(p)
      ? L("শিক্ষা প্রতিষ্ঠান ব্যবস্থাপনা", "School Management")
      : /event|ইভেন্ট|অনুষ্ঠান/.test(p)
        ? L("ইভেন্ট ব্যবস্থাপনা", "Event Management")
        : L("প্রজেক্ট ম্যানেজমেন্ট", "Project Management");

  const recordFields = hasRecords
    ? listed.map((label, i) => ({ id: fieldId(label, i), label, required: i === 0, ...guessFieldType(label) }))
    : [];
  const collections = hasRecords ? [{ id: "records", name: L("এন্ট্রি", "Records"), fields: recordFields }] : [];

  const taskTitles = lang === "bn"
    ? ["সাপ্তাহিক পরিকল্পনা তৈরি", "ক্লায়েন্ট মিটিং", "রিপোর্ট প্রস্তুত", "বাজেট পর্যালোচনা", "টিম ট্রেনিং", "ডকুমেন্টেশন আপডেট", "মাসিক রিভিউ"]
    : ["Prepare weekly plan", "Client meeting", "Prepare report", "Budget review", "Team training", "Update documentation", "Monthly review"];

  const pages: Json[] = [
    {
      id: "overview", title: L("ড্যাশবোর্ড", "Dashboard"), icon: "dashboard",
      widgets: [
        { id: "m_total", type: "metric", title: L("মোট কাজ", "Total tasks"), width: 1, source: "tasks", aggregate: "count", color: "blue" },
        { id: "m_open", type: "metric", title: L("চলমান কাজ", "Open tasks"), width: 1, source: "tasks", aggregate: "count", filter: { field: "status", op: "neq", value: "done" }, color: "amber" },
        { id: "m_done", type: "metric", title: L("সম্পন্ন কাজ", "Completed"), width: 1, source: "tasks", aggregate: "count", filter: { field: "status", op: "eq", value: "done" }, color: "green" },
        { id: "m_logs", type: "metric", title: L("আজকের রিপোর্ট", "Reports today"), width: 1, source: "worklogs", aggregate: "count", dateRange: "today", color: "violet" },
        { id: "c_status", type: "pieChart", title: L("কাজের অবস্থা", "Task status"), width: 2, source: "tasks", groupBy: "status", aggregate: "count" },
        { id: "p_member", type: "progress", title: L("সদস্যদের অগ্রগতি", "Progress by member"), width: 2, source: "tasks", mode: "byMember" },
        { id: "k", type: "kanban", title: L("কাজের বোর্ড", "Task board"), width: 4 },
      ],
    },
    ...(hasRecords
      ? [{
          id: "entries", title: L("ডাটা এন্ট্রি", "Data Entry"), icon: "form",
          widgets: [
            { id: "f_rec", type: "form", title: L("এন্ট্রি ফর্ম", "Entry form"), width: 2, collectionId: "records" },
            { id: "t_rec", type: "table", title: L("এন্ট্রি তালিকা", "Entries"), width: 2, source: "records", columns: recordFields.slice(0, 5).map((f) => f.id) },
          ],
        }]
      : []),
    {
      id: "work", title: L("কাজ বণ্টন", "Task Assignment"), icon: "tasks",
      widgets: [
        { id: "t_tasks", type: "table", title: L("সব কাজ", "All tasks"), width: 4, source: "tasks", columns: ["title", "assignees", "status", "priority", "dueDate"] },
        { id: "cal", type: "calendar", title: L("ক্যালেন্ডার", "Calendar"), width: 4, source: "tasks", dateField: "dueDate", titleField: "title" },
      ],
    },
    {
      id: "reports", title: L("রিপোর্ট", "Reports"), icon: "chart",
      widgets: [
        { id: "wl", type: "worklog", title: L("দৈনিক কাজের রিপোর্ট", "Daily work report"), width: 2, showRecent: 5 },
        { id: "c_member", type: "barChart", title: L("সদস্য অনুযায়ী কাজ", "Tasks per member"), width: 2, source: "tasks", groupBy: "assignees", aggregate: "count" },
        { id: "c_trend", type: "lineChart", title: L("দৈনিক রিপোর্ট প্রবণতা", "Daily report trend"), width: 2, source: "worklogs", dateField: "date", dateBucket: "day", aggregate: "count" },
        { id: "files", type: "attachments", title: L("ফাইল ও লিংক", "Files & links"), width: 2 },
      ],
    },
  ];

  const config = {
    version: 1,
    name: domainName,
    description: prompt.slice(0, 300),
    language: lang,
    team: {
      roles: [
        { id: "manager", name: L("ম্যানেজার", "Manager") },
        { id: "employee", name: L("কর্মী", "Employee") },
      ],
      members,
    },
    taskStatuses: [
      { id: "todo", label: L("করণীয়", "To Do"), color: "slate" },
      { id: "in_progress", label: L("চলমান", "In Progress"), color: "blue" },
      { id: "review", label: L("রিভিউ", "Review"), color: "amber" },
      { id: "done", label: L("সম্পন্ন", "Done"), color: "green", isDone: true },
    ],
    priorities: priorities(lang),
    taskFields: [],
    collections,
    pages,
    reports: [L("সাপ্তাহিক কাজের সারাংশ", "Weekly work summary"), L("সদস্যভিত্তিক কাজের চাপ", "Workload per member")],
    seed: {
      tasks: taskTitles.map((title, i) => ({
        title,
        status: ["todo", "in_progress", "review", "done", "in_progress", "todo", "done"][i],
        priority: ["medium", "high", "medium", "low", "urgent", "low", "medium"][i],
        assigneeIds: [members[(i + 1) % members.length].id],
        dueInDays: i - 2,
        ...(i === 0 ? { subtasks: [L("লক্ষ্য নির্ধারণ", "Set goals"), L("কাজ ভাগ", "Split work")] } : {}),
      })),
    },
  };
  void slugify;

  return {
    message: say(
      lang,
      `${count} জনের জন্য "${domainName}" ওয়ার্কস্পেস তৈরি।`,
      `${count} jon er "${domainName}" workspace ready.`,
      `"${domainName}" workspace ready for ${count} people.`,
    ),
    analysis: {
      language: lang,
      businessContext: domainName,
      roles: [L("ম্যানেজার", "Manager"), `${L("কর্মী", "Employee")} × ${count - 1}`],
      sections: pages.map((pg) => String(pg.title)),
      dataFields: listed,
      tasks: taskTitles.slice(0, 3),
      suggestedReports: config.reports,
    },
    needsClarification: false,
    questions: [PEOPLE_Q(lang), say(lang, "কাজের জন্য কোনো নির্দিষ্ট ফর্ম বা তথ্য সংগ্রহ লাগবে?", "Kono specific form ba data collect korte hobe?", "Do you need a specific data-entry form?")],
    config,
  };
}
