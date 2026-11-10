/**
 * Capability awareness for DEMO MODE (the live LLM gets the same rules via its prompt):
 *  - detectUnsupported: spot requests the component registry cannot build and explain
 *    them honestly with the closest workable alternative.
 *  - suggestionsFor: relevant next-step instructions the user can click — phrased so the
 *    demo editor can actually execute them.
 */
import type { Language, Unsupported, WorkspaceConfig } from "../../config/types";
import { detectDomain } from "./generator";

const say = (lang: Language, bn: string, banglish: string, en: string) => (lang === "bn" ? bn : lang === "banglish" ? banglish : en);

interface Rule {
  re: RegExp;
  build: (lang: Language) => Unsupported;
}

const RULES: Rule[] = [
  {
    re: /gantt|timeline|টাইমলাইন|গ্যান্ট/i,
    build: (l) => ({
      request: say(l, "গ্যান্ট / টাইমলাইন চার্ট", "Gantt / timeline chart", "Gantt / timeline chart"),
      reason: say(l, "টাইমলাইন চার্ট এখনও কম্পোনেন্ট রেজিস্ট্রিতে নেই।", "Timeline chart ekhono component registry te nai.", "Timeline charts aren't in the component registry yet."),
      alternative: say(l, "শেষ তারিখ অনুযায়ী ক্যালেন্ডার এবং ডেডলাইনসহ কাজের টেবিল ব্যবহার করুন।", "Deadline onujayi Calendar ar due date shoho Task table use korun.", "Use a deadline calendar plus a task table sorted by due date."),
    }),
  },
  {
    re: /\bmaps?\b|gis|ম্যাপ|মানচিত্র|google map|location tracking|লোকেশন/i,
    build: (l) => ({
      request: say(l, "ম্যাপ / লোকেশন", "Map / location", "Map / location view"),
      reason: say(l, "ম্যাপ দেখানোর কম্পোনেন্ট এখনও নেই।", "Map dekhanor component ekhono nai.", "There's no map component yet."),
      alternative: say(l, "এলাকা/ওয়ার্ড অনুযায়ী বার চার্ট দিয়ে অঞ্চলভিত্তিক তথ্য দেখা যাবে।", "Area/Ward onujayi bar chart diye elaka-bhittik data dekha jabe.", "A bar chart grouped by area/ward shows the same breakdown by location."),
    }),
  },
  {
    re: /org ?chart|organogram|অর্গানোগ্রাম|সাংগঠনিক কাঠামো|hierarchy/i,
    build: (l) => ({
      request: say(l, "অর্গানোগ্রাম", "Org chart", "Org chart"),
      reason: say(l, "সাংগঠনিক চার্ট আঁকার কম্পোনেন্ট নেই।", "Org chart er component nai.", "There's no org-chart component."),
      alternative: say(l, "Team পেজে প্রত্যেকের ভূমিকা (Role) ও কাজের চাপ দেখা যায়।", "Team page e shobar Role ar workload dekha jay.", "The Team page lists everyone by role with their workload."),
    }),
  },
  {
    re: /\bsms\b|whats ?app|notification|notify|নোটিফিকেশন|reminder|রিমাইন্ডার|alert pathao|(send|pathao|পাঠা)\S*\s+(\S+\s+){0,3}(e-?mail|ইমেইল|message|মেসেজ)|(e-?mail|ইমেইল)\s+(pathao|send|পাঠাও|পাঠান)/i,
    build: (l) => ({
      request: say(l, "SMS / ইমেইল / নোটিফিকেশন পাঠানো", "SMS / email / notification pathano", "Sending SMS, email or notifications"),
      reason: say(l, "এই PoC বাইরে কোনো বার্তা পাঠাতে পারে না।", "Ei PoC baire kono message pathate pare na.", "This PoC can't send messages outside the app."),
      alternative: say(l, "ড্যাশবোর্ডের কার্যক্রম ফিড ও কাজের তালিকায় মেয়াদোত্তীর্ণ কাজ লাল রঙে দেখায়।", "Dashboard er Activity feed ar task list e overdue kaj lal rong e dekhay.", "The activity feed and task lists highlight overdue work in red."),
    }),
  },
  {
    re: /payment|bkash|বিকাশ|nagad|নগদ|invoice|পেমেন্ট|ইনভয়েস|billing/i,
    build: (l) => ({
      request: say(l, "অনলাইন পেমেন্ট / ইনভয়েস", "Online payment / invoice", "Online payments / invoices"),
      reason: say(l, "পেমেন্ট গেটওয়ে বা ইনভয়েস তৈরি এই প্ল্যাটফর্মে নেই।", "Payment gateway ba invoice toiri ei platform e nai.", "Payment gateways and invoice generation aren't supported."),
      alternative: say(l, "টাকার পরিমাণ ও পেমেন্ট অবস্থা ফিল্ডসহ একটি ফর্ম এবং মোট টাকার মেট্রিক দিয়ে হিসাব রাখা যায়।", "Amount ar Payment status field shoho ekta form ar total amount metric diye hisab rakha jay.", "Track payments with a form (amount + status fields) and a total-amount metric card."),
    }),
  },
  {
    // "login API" is a normal dev task, so only flag account/permission *features*
    re: /(user|ইউজার|employee|কর্মী)\S*\s+(login|account|লগইন)|login system|লগইন সিস্টেম|password|পাসওয়ার্ড|permission|পারমিশন|access control|অনুমতি|role.based access/i,
    build: (l) => ({
      request: say(l, "লগইন / ব্যবহারকারী অনুমতি", "Login / user permission", "Login / per-user permissions"),
      reason: say(l, "এই PoC-তে ব্যবহারকারী অ্যাকাউন্ট বা অনুমতি ব্যবস্থা নেই।", "Ei PoC te user account ba permission system nai.", "This PoC has no user accounts or permission system."),
      alternative: say(l, "Team পেজে ভূমিকা (Manager, Operator ইত্যাদি) নির্ধারণ করা যায় এবং কাজ সেই অনুযায়ী বণ্টন করা যায়।", "Team page e Role (Manager, Operator) set kore shei onujayi kaj assign kora jay.", "Define roles (Manager, Operator…) on the Team page and assign work by role."),
    }),
  },
  {
    re: /\bpdf\b|excel|xlsx|\bcsv\b|export|\bprint\b|প্রিন্ট|এক্সপোর্ট|download report|রিপোর্ট ডাউনলোড/i,
    build: (l) => ({
      request: say(l, "PDF / Excel এক্সপোর্ট বা প্রিন্ট", "PDF / Excel export ba print", "PDF / Excel export or printing"),
      reason: say(l, "রিপোর্ট ফাইল হিসেবে এক্সপোর্ট এখনও নেই।", "Report file hishebe export ekhono nai.", "Exporting reports as files isn't available yet."),
      alternative: say(l, "চার্টের টেবিল ভিউ ও Settings → Export workspace (JSON) ব্যবহার করুন।", "Chart er table view ar Settings → Export workspace (JSON) use korun.", "Use the chart table view, or Settings → Export workspace (JSON)."),
    }),
  },
  {
    re: /upload|আপলোড|scan|স্ক্যান|photo|ছবি|picture|image capture|signature|স্বাক্ষর/i,
    build: (l) => ({
      request: say(l, "ফাইল / ছবি আপলোড", "File / photo upload", "File or photo upload"),
      reason: say(l, "ফাইল সংরক্ষণের সার্ভার নেই — শুধু রেফারেন্স রাখা যায়।", "File rakhar server nai — shudhu reference rakha jay.", "There's no file storage — only references are kept."),
      alternative: say(l, "সংযুক্তি উইজেটে ফাইলের নাম/লিংক রাখুন, বা ফর্মে একটি লিংক (URL) ফিল্ড যোগ করুন।", "Attachments widget e file er naam/link rakhun, ba form e ekta URL field add korun.", "Keep file names/links in the Files & links widget, or add a URL field to the form."),
    }),
  },
  {
    re: /colou?r|theme|logo|brand|font|রং|লোগো|থিম|ডিজাইন পরিবর্তন|custom design/i,
    build: (l) => ({
      request: say(l, "কাস্টম রং / লোগো / ডিজাইন", "Custom color / logo / design", "Custom colors, logo or design"),
      reason: say(l, "AI এখনও ভিজ্যুয়াল ডিজাইন পরিবর্তন করতে পারে না।", "AI ekhono visual design change korte pare na.", "The AI can't change the visual design yet."),
      alternative: say(l, "লাইট/ডার্ক মোড বদলানো যায়, এবং উইজেটের আকার, ক্রম ও শিরোনাম সম্পাদনা করা যায়।", "Light/Dark mode change kora jay, ar widget er size, order, title edit kora jay.", "You can switch light/dark mode and edit widget size, order and titles."),
    }),
  },
  {
    re: /auto.?assign|automatic(ally)?|automation|স্বয়ংক্রিয়|schedule job|cron|প্রতি মাসে নিজে/i,
    build: (l) => ({
      request: say(l, "স্বয়ংক্রিয় কাজ বণ্টন / অটোমেশন", "Auto assign / automation", "Automatic assignment / automation"),
      reason: say(l, "নিয়মভিত্তিক অটোমেশন এখনও নেই।", "Rule-based automation ekhono nai.", "Rule-based automation isn't supported yet."),
      alternative: say(l, "কাজের বোর্ড থেকে ড্র্যাগ করে বা টাস্ক খুলে দ্রুত দায়িত্ব দিন; সদস্যভিত্তিক অগ্রগতি চার্টে কাজের চাপ দেখুন।", "Task board theke drag kore ba task khule assign korun; member-wise progress chart e workload dekhun.", "Assign quickly from the task board, and watch workload in the per-member progress chart."),
    }),
  },
  {
    re: /live chat|chat system|চ্যাট|messenger|video call|zoom|meet\b/i,
    build: (l) => ({
      request: say(l, "চ্যাট / ভিডিও কল", "Chat / video call", "Chat / video calls"),
      reason: say(l, "রিয়েল-টাইম চ্যাট বা কল এই প্ল্যাটফর্মে নেই।", "Real-time chat ba call ei platform e nai.", "Real-time chat and calls aren't part of this platform."),
      alternative: say(l, "প্রতিটি কাজে মন্তব্য (comment) লেখা যায়; মিটিং লিংক সংযুক্তিতে রাখা যায়।", "Protiti task e comment kora jay; meeting link attachments e rakha jay.", "Use task comments for discussion and keep meeting links in Files & links."),
    }),
  },
];

export function detectUnsupported(text: string, lang: Language): Unsupported[] {
  return RULES.filter((r) => r.re.test(text)).map((r) => r.build(lang));
}

/**
 * Remove clauses that ask for unsupported things so the demo editor doesn't
 * misread e.g. "Gantt chart add koro" as "add a chart".
 */
export function stripUnsupported(text: string): string {
  return text
    .split(/[,;।\n]|\s+(?:and|ar|abong|এবং|আর)\s+/i)
    .filter((clause) => !RULES.some((r) => r.re.test(clause)))
    .join(", ")
    .trim();
}

/** Relevant next steps for the user's goal — phrased so even demo mode can execute them. */
export function suggestionsFor(text: string, lang: Language, config?: WorkspaceConfig): string[] {
  const domain = config ? detectDomain(`${config.name} ${config.description ?? ""} ${config.collections.map((c) => c.name).join(" ")}`) : detectDomain(text);
  const hasBucket = (b: string) => !!config?.pages.some((p) => p.widgets.some((w) => "dateBucket" in w && w.dateBucket === b));
  const hasStatus = (s: string) => !!config?.taskStatuses.some((x) => x.label.toLowerCase() === s.toLowerCase() || x.id === s.toLowerCase());
  const hasCalendar = !!config?.pages.some((p) => p.widgets.some((w) => w.type === "calendar"));

  const out: { text: string; skip?: boolean }[] = [];
  if (domain === "municipality") {
    out.push(
      { text: say(lang, "সাপ্তাহিক রিপোর্ট চার্ট যোগ করো", "Dashboard e ekta weekly report chart add koro", "Add a weekly report chart"), skip: hasBucket("week") },
      { text: say(lang, "যাচাইকৃত স্ট্যাটাস যোগ করো", "Task board e ekta Verified status add koro", "Add a Verified status"), skip: hasStatus("verified") || hasStatus("যাচাইকৃত") },
      { text: say(lang, "নাগরিক অভিযোগের জন্য একটি অভিযোগ ফর্ম যোগ করো", "Citizen der jonno complaint form add koro", "Add a citizen complaint form") },
      { text: say(lang, "মাসিক রিপোর্ট চার্ট যোগ করো", "Monthly report chart add koro", "Add a monthly report chart"), skip: hasBucket("month") },
    );
  } else if (domain === "software") {
    out.push(
      { text: say(lang, "Blocked স্ট্যাটাস যোগ করো", "Task board e ekta Blocked status add koro", "Add a Blocked status to the task board"), skip: hasStatus("blocked") },
      { text: say(lang, "একটি sprint retrospective ফর্ম যোগ করো", "Ekta sprint retrospective form add koro", "Add a sprint retrospective form") },
      { text: say(lang, "সাপ্তাহিক রিপোর্ট চার্ট যোগ করো", "Dashboard e ekta weekly report chart add koro", "Add a weekly report chart"), skip: hasBucket("week") },
      { text: say(lang, "ডেডলাইন ক্যালেন্ডার যোগ করো", "Deadline calendar add koro", "Add a deadline calendar"), skip: hasCalendar },
    );
  } else {
    out.push(
      { text: say(lang, "সাপ্তাহিক রিপোর্ট চার্ট যোগ করো", "Dashboard e ekta weekly report chart add koro", "Add a weekly report chart"), skip: hasBucket("week") },
      { text: say(lang, "Blocked স্ট্যাটাস যোগ করো", "Task board e ekta Blocked status add koro", "Add a Blocked status to the task board"), skip: hasStatus("blocked") },
      { text: say(lang, "কর্মীদের জন্য দৈনিক কাজ জমার ফর্ম যোগ করো", "Employee der jonno daily work submission form add koro", "Add a daily work submission form for employees") },
      { text: say(lang, "ডেডলাইন ক্যালেন্ডার যোগ করো", "Deadline calendar add koro", "Add a deadline calendar"), skip: hasCalendar },
    );
  }
  return out.filter((s) => !s.skip).map((s) => s.text).slice(0, 3);
}
