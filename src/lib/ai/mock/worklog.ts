/** DEMO MODE: split a self-report like "Ajke API integration korechi, database optimize korechi and 2 ta bug fix korechi". */
import type { WorkEntry } from "../../config/types";
import { detectLanguage } from "../language";
import { bnToEnDigits } from "../../utils";

const CATEGORIES: [RegExp, string, string][] = [
  [/bug|fix|বাগ|ফিক্স/i, "Bug fix", "বাগ ফিক্স"],
  [/test|qa|টেস্ট/i, "Testing", "টেস্টিং"],
  [/meeting|মিটিং|call|কল/i, "Meeting", "মিটিং"],
  [/review|রিভিউ|যাচাই/i, "Review", "রিভিউ"],
  [/entry|এন্ট্রি|ডাটা|form|ফর্ম/i, "Data Entry", "ডাটা এন্ট্রি"],
  [/deploy|release|ডিপ্লয়/i, "Deployment", "ডিপ্লয়মেন্ট"],
  [/design|ui|ডিজাইন/i, "Design", "ডিজাইন"],
  [/doc|report|রিপোর্ট|ডকুমেন্ট/i, "Documentation", "ডকুমেন্টেশন"],
  [/api|code|develop|integration|database|optimi|feature|implement|ডেভেলপ|কোড/i, "Development", "ডেভেলপমেন্ট"],
];

export function mockWorklog(text: string): { message: string; entries: WorkEntry[] } {
  const lang = detectLanguage(text);
  const cleaned = text.replace(/^\s*(ajke|aj|today|আজকে|আজ)\s*(ami)?\s*/i, "");
  const parts = cleaned
    .split(/[,;।\n]|\s+(?:and|ar|abong|o|then|এবং|ও|আর|তারপর)\s+|\.\s+/i)
    .map((s) => s.trim().replace(/[.।]+$/, ""))
    .filter((s) => s.length > 2);
  const entries: WorkEntry[] = parts.slice(0, 20).map((p) => {
    const cat = CATEGORIES.find(([re]) => re.test(p));
    const hrs = bnToEnDigits(p).match(/(\d+(?:\.\d+)?)\s*(?:ghonta|ghanta|hours?|hrs?|h\b|ঘণ্টা)/i);
    const ongoing = /cholche|চলছে|in progress|ongoing|korchi|করছি|baki|বাকি/i.test(p);
    return {
      description: p.charAt(0).toUpperCase() + p.slice(1),
      ...(cat ? { category: lang === "bn" ? cat[2] : cat[1] } : {}),
      ...(hrs ? { hours: Math.min(24, Number(hrs[1])) } : {}),
      status: ongoing ? "in_progress" : "done",
    };
  });
  const message =
    lang === "bn"
      ? `${entries.length}টি কাজের এন্ট্রি পাওয়া গেছে। যাচাই করে সংরক্ষণ করুন।`
      : lang === "banglish"
        ? `${entries.length} ta work entry pawa geche. Check kore save koro.`
        : `Found ${entries.length} work entries. Review and save them.`;
  return { message, entries };
}
