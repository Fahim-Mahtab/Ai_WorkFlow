import "server-only";
/**
 * Small AI helpers with tiny prompts (a fraction of a dashboard edit):
 *  - ruleFromText: "deadline par hole priority urgent koro" → an automation rule
 *  - briefing:     facts the browser computed → a short manager briefing
 */
import { getProvider } from "./providers";
import { extractJson } from "./json";
import { languageRule } from "./prompts";
import { detectLanguage } from "./language";
import { PipelineError, UsageMeter } from "./pipeline";
import { sanitizeRule, type Rule } from "../automation/rules";
import { briefingSchema, plainBriefing, type Briefing, type BriefingFacts } from "../insights/briefing";
import type { Language, WorkspaceConfig } from "../config/types";
import type { UsageReport } from "./pricing";
import { todayISO } from "../utils";

type RuleDraft = Omit<Rule, "id" | "createdAt" | "enabled" | "runs">;

export interface RuleResult {
  mode: "live" | "demo";
  rule: RuleDraft | null;
  /** why it could not be made, or a short note */
  message: string;
  usage: UsageReport | null;
}

export interface BriefingResult {
  mode: "live" | "demo";
  briefing: Briefing;
  usage: UsageReport | null;
}

const RULE_FORMAT = `RULE JSON:
{ "name": short plain sentence of the rule in the user's language,
  "trigger": one of
    { "type": "task_created" }
    { "type": "status_changed", "to"?: status id }      (omit "to" = any status change)
    { "type": "assignee_changed" }
    { "type": "priority_changed", "to"?: "low"|"medium"|"high"|"urgent" }
    { "type": "subtasks_done" }                         (all checklist items ticked)
    { "type": "overdue" }                               (deadline passed and not done)
    { "type": "due_soon", "days": 0-30 }                (deadline within N days; 0 = today)
  "conditions"?: { "statuses"?: [status id], "priorities"?: [..], "assigneeIds"?: [member id], "titleContains"?: string },
  "actions": 1-6 of
    { "type": "set_status", "status": status id }
    { "type": "set_priority", "priority": "low"|"medium"|"high"|"urgent" }
    { "type": "assign", "memberIds": [member id], "mode": "add"|"replace" }
    { "type": "add_comment", "text": string }
    { "type": "add_subtasks", "items": [string] }
    { "type": "set_due_in_days", "days": number }
    { "type": "notify", "text": string }                (an in-app notification; there is NO SMS/email)
}`;

function rulePrompt(lang: Language, cfg: WorkspaceConfig): string {
  return `You turn one plain-language automation request into a rule for a task-management workspace.
${languageRule(lang)}
TODAY: ${todayISO()}
STATUSES (id: label): ${cfg.taskStatuses.map((s) => `${s.id}: ${s.label}${s.isDone ? " (done)" : ""}`).join(", ")}
PEOPLE (id: name, role): ${cfg.team.members.map((m) => `${m.id}: ${m.name} (${cfg.team.roles.find((r) => r.id === m.roleId)?.name ?? ""})`).join(", ") || "none"}

${RULE_FORMAT}

Use only the ids above. If a person or status the user names does not exist, or the request needs something rules cannot do (SMS, email, payments, other apps), set "rule": null and explain in "message" in one short sentence, offering the closest rule that IS possible.
"message" says what the rule WILL do once the user turns it on (e.g. "Deadline par hole priority urgent hobe."). Never say it is already set, saved or active: the user still has to approve it.
RESPONSE (JSON only): { "rule": RULE | null, "message": "one short sentence in the user's language" }`;
}

/** Demo mode: understands a few common shapes so the feature can be tried without a key. */
function demoRule(text: string, cfg: WorkspaceConfig): RuleDraft | null {
  const t = text.toLowerCase();
  const person = cfg.team.members.find((m) => m.name && t.includes(m.name.toLowerCase()));
  const status = cfg.taskStatuses.find((s) => t.includes(s.label.toLowerCase()));
  const days = Number((t.match(/(\d+)\s*(din|day|দিন)/) ?? [])[1] ?? NaN);
  let trigger: RuleDraft["trigger"] | null = null;
  if (/overdue|deadline (par|miss)|deri|দেরি|late/.test(t)) trigger = { type: "overdue" };
  else if (!Number.isNaN(days) && /deadline|due|ডেডলাইন/.test(t)) trigger = { type: "due_soon", days };
  else if (status && /(e gele|e jay|moved?|hole|হলে|গেলে)/.test(t)) trigger = { type: "status_changed", to: status.id };
  else if (/new task|notun task|নতুন কাজ|created/.test(t)) trigger = { type: "task_created" };
  if (!trigger) return null;
  const actions: RuleDraft["actions"] = [];
  if (/urgent|joruri|জরুরি/.test(t)) actions.push({ type: "set_priority", priority: "urgent" });
  else if (/\bhigh\b/.test(t)) actions.push({ type: "set_priority", priority: "high" });
  if (person && /assign|dao|ke de|কে দাও|দিয়ে/.test(t)) actions.push({ type: "assign", memberIds: [person.id], mode: "add" });
  if (/notify|janao|জানাও|alert|remind/.test(t)) actions.push({ type: "notify", text: text.slice(0, 120) });
  if (!actions.length) return null;
  return { name: text.slice(0, 200), trigger, actions };
}

export async function ruleFromText(input: { text: string; config: WorkspaceConfig; forceDemo?: boolean }): Promise<RuleResult> {
  const lang = detectLanguage(input.text);
  const provider = input.forceDemo ? null : getProvider();
  if (!provider) {
    const rule = demoRule(input.text, input.config);
    return { mode: "demo", rule, message: rule ? "" : "Demo mode understands only simple rules. Use the rule builder below, or add an AI key.", usage: null };
  }
  const meter = new UsageMeter();
  const raw = await meter.run(provider, {
    messages: [
      { role: "system", content: rulePrompt(lang, input.config) },
      { role: "user", content: input.text },
    ],
    json: true,
    temperature: 0.1,
    maxTokens: 800,
    timeoutMs: 45_000,
  });
  let obj: Record<string, unknown>;
  try {
    obj = extractJson(raw) as Record<string, unknown>;
  } catch {
    throw new PipelineError("The AI reply was not valid JSON", "invalid_json", [], meter.report());
  }
  const rule = obj.rule ? sanitizeRule(obj.rule, input.config) : null;
  const message = typeof obj.message === "string" ? obj.message.slice(0, 300) : "";
  return { mode: "live", rule, message: rule ? message : message || "I couldn't turn that into a rule. Try naming the trigger and what should happen.", usage: meter.report() };
}

function briefingPrompt(lang: Language): string {
  return `You are an operations assistant writing a short daily briefing for a team manager in Bangladesh.
${languageRule(lang)}
Use ONLY the facts given. Never invent tasks, people, numbers or dates.
- "headline": one sentence with the overall state.
- "items": 3-7 short points, worst first. tone "risk" = late work, "warn" = deadline at risk or overload, "good" = progress worth praising, "info" = other useful notes (who has no work, who has not logged work).
- "actions": 1-3 concrete next steps for the manager (e.g. move a task from the busiest person to someone free, agree a new deadline).
Plain words, max 25 words per point.
RESPONSE (JSON only): { "headline": string, "items": [{ "tone": "risk"|"warn"|"good"|"info", "text": string }], "actions": [string] }`;
}

export async function briefing(input: { facts: BriefingFacts; forceDemo?: boolean }): Promise<BriefingResult> {
  const f = input.facts;
  const provider = input.forceDemo ? null : getProvider();
  if (!provider) return { mode: "demo", briefing: plainBriefing(f), usage: null };
  const meter = new UsageMeter();
  const raw = await meter.run(provider, {
    messages: [
      { role: "system", content: briefingPrompt(f.language) },
      { role: "user", content: `FACTS:\n${JSON.stringify(f)}` },
    ],
    json: true,
    temperature: 0.3,
    maxTokens: 900,
    timeoutMs: 45_000,
  });
  let obj: unknown;
  try {
    obj = extractJson(raw);
  } catch {
    throw new PipelineError("The AI reply was not valid JSON", "invalid_json", [], meter.report());
  }
  const p = briefingSchema.safeParse(obj);
  if (!p.success) throw new PipelineError("The AI briefing was malformed", "validation", p.error.issues.map((i) => i.message), meter.report());
  return { mode: "live", briefing: p.data, usage: meter.report() };
}
