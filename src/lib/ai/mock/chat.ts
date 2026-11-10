/**
 * DEMO MODE conversation (no API key): a fixed interview that asks about the
 * team, data, tracking and reports one at a time, then hands the whole chat to
 * the demo generator. Inside a workspace it routes clear change requests to the
 * demo editor and answers everything else with what it can do.
 */
import type { Language, WorkspaceConfig } from "../../config/types";
import { normalizePrompt } from "./helpers";

interface Turn {
  role: "user" | "assistant";
  content: string;
}
interface MockChat {
  reply: string;
  quickReplies: string[];
  intent: "chat" | "build" | "edit";
  brief?: string;
  instruction?: string;
}

const say = (lang: Language, bn: string, banglish: string, en: string) => (lang === "bn" ? bn : lang === "banglish" ? banglish : en);
type Tri = [string, string, string];
const tri = (lang: Language, t: Tri) => say(lang, ...t);

const TOPICS: { id: string; re: RegExp; q: Tri; quick: Tri[] }[] = [
  {
    id: "team",
    re: /\d+\s*(jon|জন|people|staff|employee|member|person|developer|কর্মী)|\bteam\b|টিম|কর্মী|developer|manager|ম্যানেজার|nam pore|names later|নাম পরে/i,
    q: ["আপনার টিমে কতজন আছেন, আর কে কী কাজ করেন? কেউ কি অন্যদের কাজ রিভিউ বা অনুমোদন করেন?", "Apnar team e koto jon ache, ar ke ki kaj kore? Keu ki review ba approve kore?", "How many people are on your team, and what does each do? Does anyone review or approve the work?"],
    quick: [["৫ জন কর্মী, ১ জন ম্যানেজার রিভিউ করবেন", "5 jon staff, 1 jon manager review korbe", "5 staff, 1 manager reviews"], ["নাম পরে দেব", "Nam pore dibo", "I'll add names later"]],
  },
  {
    id: "data",
    re: /form|ফর্ম|field|তথ্য|tottho|info|\bnid\b|record|এন্ট্রি|entry|customer|গ্রাহক|data/i,
    q: ["কোন কোন তথ্য সংগ্রহ বা এন্ট্রি করতে হবে? যেমন নাম, মোবাইল, ঠিকানা…", "Kon kon tottho entry korte hobe? Jemon nam, mobile, address…", "What information do you need to record? For example name, phone, address…"],
    quick: [["নাম, মোবাইল, ঠিকানা", "Nam, mobile, address", "Name, phone, address"], ["শুধু কাজের তালিকা", "Shudhu kajer list", "Just a task list"]],
  },
  {
    id: "tracking",
    re: /status|review|approve|অনুমোদন|রিভিউ|deadline|ডেডলাইন|daily|doinik|দৈনিক|assign|বণ্টন/i,
    q: ["কাজ কীভাবে ট্র্যাক করবেন? প্রতিদিন রিপোর্ট, ডেডলাইন, নাকি রিভিউ ধাপ লাগবে?", "Kaj kivabe track korben? Daily report, deadline, naki review step lagbe?", "How should work be tracked? Daily reports, deadlines, or a review step?"],
    quick: [["দৈনিক রিপোর্ট + রিভিউ", "Daily report + review", "Daily reports + review"], ["শুধু ডেডলাইন", "Shudhu deadline", "Just deadlines"]],
  },
  {
    id: "reports",
    re: /report|chart|রিপোর্ট|চার্ট|graph|গ্রাফ|overview|target|লক্ষ্য/i,
    q: ["এক নজরে কী দেখতে চান? যেমন সাপ্তাহিক অগ্রগতি, কার কত কাজ বাকি…", "Ek nojore ki dekhte chan? Jemon weekly progress, kar koto kaj baki…", "What do you want to see at a glance? For example weekly progress, who has work pending…"],
    quick: [["সাপ্তাহিক অগ্রগতি চার্ট", "Weekly progress chart", "Weekly progress chart"], ["কার কত কাজ বাকি", "Kar koto kaj baki", "Pending work per person"]],
  },
];

const BUILD_NOW = /\b(build|banao|banan|start|shuru|enough|go ahead|thik ache|ok)\b|বানাও|বানান|তৈরি করো|শুরু করো|ঠিক আছে/i;
const BUILD_CHIP: Tri = ["এখনই বানাও", "Ekhon banao", "Build it now"];

function intake(messages: Turn[], lang: Language): MockChat {
  const users = messages.filter((m) => m.role === "user").map((m) => m.content);
  const all = normalizePrompt(users.join("\n"));
  const asked = messages.filter((m) => m.role === "assistant").length;
  const missing = TOPICS.filter((t) => !t.re.test(all));
  const known = TOPICS.length - missing.length;
  const last = users[users.length - 1] ?? "";
  const wantsBuild = users.length > 1 && BUILD_NOW.test(last);

  if (wantsBuild || known >= 3 || asked >= 4 || !missing.length) {
    return {
      intent: "build",
      reply: say(lang, "বুঝেছি! নিচের সারাংশ দেখে নিন — ঠিক থাকলে বানিয়ে দিই?", "Bujhechi! Nicher summary ta dekhen — thik thakle baniye dei?", "Got it! Check the summary below — shall I build it?"),
      quickReplies: [],
      brief: users.join("\n"),
    };
  }
  const next = missing[0];
  const ack = users.length > 1 ? say(lang, "ধন্যবাদ, বুঝেছি। ", "Thanks, bujhechi. ", "Thanks, got it. ") : say(lang, "দারুণ! কয়েকটা ছোট প্রশ্ন করি। ", "Darun! Koyekta choto proshno kori. ", "Great! A few quick questions. ");
  return { intent: "chat", reply: ack + tri(lang, next.q), quickReplies: [...next.quick.map((q) => tri(lang, q)), tri(lang, BUILD_CHIP)] };
}

const CHANGE = /add|jog|যোগ|যুক্ত|remove|delete|bad dao|baad|sorao|মুছে|বাদ|সরাও|hatao|create|banao|তৈরি|new|notun|নতুন|rename|change|bodlao|বদলাও/i;

function workspace(messages: Turn[], lang: Language, config?: WorkspaceConfig): MockChat {
  const last = [...messages].reverse().find((m) => m.role === "user")?.content ?? "";
  if (CHANGE.test(last)) {
    return { intent: "edit", instruction: last, reply: say(lang, "ঠিক আছে, পরিবর্তনটা তৈরি করছি।", "Thik ache, change ta ready korchi.", "Okay, preparing that change."), quickReplies: [] };
  }
  const people = config?.team.members.length ?? 0;
  return {
    intent: "chat",
    reply: say(
      lang,
      `এই ওয়ার্কস্পেসে ${people} জন আছেন। আমি চার্ট, ফর্ম, স্ট্যাটাস, পেজ বা নতুন মানুষ যোগ/বাদ দিতে পারি। কী করতে চান?`,
      `Ei workspace e ${people} jon ache. Ami chart, form, status, page ba notun manush add/remove korte pari. Ki korte chan?`,
      `This workspace has ${people} people. I can add or remove charts, forms, statuses, pages or people. What would you like?`,
    ),
    quickReplies: [
      say(lang, "সাপ্তাহিক রিপোর্ট চার্ট যোগ করো", "Weekly report chart add koro", "Add a weekly report chart"),
      say(lang, "রিভিউ স্ট্যাটাস যোগ করো", "Review status add koro", "Add a Review status"),
      say(lang, "নতুন একজন কর্মী যোগ করো", "Notun ekjon staff add koro", "Add a new team member"),
    ],
  };
}

export function mockChat(mode: "intake" | "workspace", messages: Turn[], lang: Language, config?: WorkspaceConfig): MockChat {
  return mode === "intake" ? intake(messages, lang) : workspace(messages, lang, config);
}
