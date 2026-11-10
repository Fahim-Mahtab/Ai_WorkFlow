import "server-only";
/**
 * Conversational layer. Before anything is built or changed, the AI talks with
 * the user to understand what they need:
 *  - "intake":    no workspace yet. Ask about the work, team, data and reports,
 *                 one question at a time, then hand a complete brief to the generator.
 *  - "workspace": inside a workspace. Answer questions, ask when a change is unclear,
 *                 and hand a precise instruction to the edit pipeline when it is clear.
 * The reply is small JSON, so a chat turn costs a fraction of a generation.
 */
import { z } from "zod";
import { getProvider } from "./providers";
import { detectLanguage } from "./language";
import { extractJson } from "./json";
import { languageRule } from "./prompts";
import { PipelineError, UsageMeter } from "./pipeline";
import { mockChat } from "./mock/chat";
import type { Language, WorkspaceConfig } from "../config/types";
import type { UsageReport } from "./pricing";

export type ChatMode = "intake" | "workspace";
export type ChatIntent = "chat" | "build" | "edit";

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

export interface ChatResult {
  mode: "live" | "demo";
  language: Language;
  reply: string;
  quickReplies: string[];
  intent: ChatIntent;
  /** intake → complete requirement description for the generator */
  brief?: string;
  /** workspace → precise, self-contained change for the edit pipeline */
  instruction?: string;
  usage?: UsageReport | null;
}

const responseSchema = z.object({
  reply: z.string().min(1).max(1500),
  quickReplies: z.array(z.string().min(1).max(120)).max(5).catch([]),
  intent: z.enum(["chat", "build", "edit"]).catch("chat"),
  brief: z.string().max(4000).optional().catch(undefined),
  instruction: z.string().max(2000).optional().catch(undefined),
});

const CAPABILITIES = `What the platform can build: pages with metric cards, tables, task boards (kanban), task lists, data-entry forms with fields (text, number, date, select, phone, email, member…), bar/line/pie charts (daily/weekly/monthly), calendars, progress bars, activity feed, file/link references, and daily self-reported work logs. Tasks have statuses, priorities, assignees, deadlines, subtasks and comments. People are team members with roles.
Creating and assigning tasks (title, people, deadline, description) IS possible, and so is changing existing tasks (move to another status, reassign, new deadline, priority): treat both as an "edit".
It CANNOT: send SMS/email/notifications, take payments, user logins/permissions, real file upload, PDF/Excel export, maps, Gantt charts, integrations or automation. Say so briefly only if the user asks for these, and offer the closest alternative.`;

function intakePrompt(lang: Language): string {
  return `You are a friendly work-setup consultant inside a work-management app used by offices in Bangladesh. You are talking with the user to understand their needs BEFORE building their workspace (dashboard).

LANGUAGE: ${languageRule(lang)} Always reply in the language of the user's latest message.

UNDERSTAND THESE (skip anything already known):
1. What work / organisation it is for and the main goal.
2. Who is on the team: how many people, their names and roles, and who reviews or approves.
3. What information they need to record (forms and fields).
4. How work is assigned and tracked (statuses, approvals, deadlines, daily reports).
5. What they want to see at a glance (reports, charts, targets).

HOW TO TALK:
- Talk like a helpful colleague: warm, natural and short. 1-3 sentences.
- Briefly reflect what you understood when useful ("So 5 people enter citizen data and a manager reviews it.").
- Ask ONE clear question at a time (at most two closely related ones). Never a long questionnaire.
- ALWAYS offer 2-4 "quickReplies" when you ask a question: short likely answers the user can tap, in their language (e.g. "Ha, manager review korbe", "Daily report lagbe"). For the team question, include an option like "Nam pore dibo" (I'll add names later).
- If the user is unsure, suggest what similar offices usually use.
- ${CAPABILITIES}

WHEN TO BUILD:
- When you know the work + at least two of (team, data, tracking, reports), OR after about 4 questions, OR whenever the user says to build/start ("banao", "build", "start", "ঠিক আছে বানাও"), set intent "build".
- With intent "build": "reply" says in 1-2 sentences what you will build and asks them to confirm or change anything. "brief" is a COMPLETE requirement description in the user's language that a builder can follow without seeing this chat: the work, every person's name and role (or the count), forms and their fields, statuses/approval flow, deadlines, daily reports and the reports/charts wanted. Include assumptions you made.
- If the user's FIRST message is already detailed (work + team + data or reports), go straight to intent "build".

RESPONSE (JSON only): { "reply": string, "quickReplies": [string], "intent": "chat" | "build", "brief"?: string }`;
}

function workspacePrompt(lang: Language, summary: string): string {
  return `You are the AI assistant inside the user's work-management workspace. You talk with the user, understand what they need, and decide what to do.

LANGUAGE: ${languageRule(lang)} Always reply in the language of the user's latest message.

CURRENT WORKSPACE:
${summary}

${CAPABILITIES}

DECIDE THE INTENT:
- "edit": the user clearly wants a change to the workspace (add/remove/rename a chart, form, field, status, page, person, etc.) and you know enough to do it. Put a precise, self-contained "instruction" (user's language, naming exact pages/widgets/fields/people from the workspace above). "reply" is one short line like "Thik ache, Rafi ke Developer hisebe add korchi." The app will then show the change for approval.
- "chat": anything else. Answer questions about the workspace or how to use it, give advice, or ask ONE short question when a change is unclear (e.g. which page, which fields, daily or weekly). ALWAYS offer 2-4 tappable "quickReplies" for likely answers or next steps.
- If the user mentions new people joining, plan to add them (ask names/roles if missing).
- If the request is impossible, say so in one line and suggest the closest thing you can do.

STYLE: like a helpful colleague. Short: 1-3 sentences. Plain words, no technical names (never "lineChart", "kanban widget", ids).

- If your reply says you are doing/adding/changing something, intent MUST be "edit" with an "instruction". Never claim to make a change with intent "chat".

RESPONSE (JSON only): { "reply": string, "quickReplies": [string], "intent": "chat" | "edit", "instruction": string (REQUIRED when intent is "edit") }`;
}

/** Compact description of the workspace for the chat model (far smaller than the full config). */
export function summarizeWorkspace(c: WorkspaceConfig, tasks: string[] = []): string {
  const role = (id: string) => c.team.roles.find((r) => r.id === id)?.name ?? id;
  const lines = [
    `Name: ${c.name}${c.description ? ` — ${c.description}` : ""}`,
    `People: ${c.team.members.map((m) => `${m.name} (${role(m.roleId)})`).join(", ") || "none yet"}`,
    `Task statuses: ${c.taskStatuses.map((s) => s.label).join(" → ")}`,
    ...c.collections.map((col) => `Form "${col.name}": ${col.fields.map((f) => f.label).join(", ")}`),
    ...c.pages.map((p) => `Page "${p.title}": ${p.widgets.map((w) => w.title).join("; ")}`),
    `Tasks (${tasks.length}): ${tasks.length ? "\n  " + tasks.slice(0, 40).join("\n  ") : "none yet"}`,
  ];
  return lines.join("\n").slice(0, 6000);
}

function transcriptPrompt(messages: ChatTurn[]): string {
  const turns = messages.slice(-16);
  const last = turns[turns.length - 1];
  const earlier = turns.slice(0, -1).map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content.slice(0, 2000)}`).join("\n");
  return `${earlier ? `CONVERSATION SO FAR:\n${earlier}\n\n` : ""}LATEST USER MESSAGE:\n${last?.content.slice(0, 3000) ?? ""}\n\nReply with the complete JSON object (all fields of the response format).`;
}

export async function runChat(input: { mode: ChatMode; messages: ChatTurn[]; config?: WorkspaceConfig; existingTasks?: string[]; forceDemo?: boolean }): Promise<ChatResult> {
  // short answers ("5", "ok") carry no language signal, so look at the last few user messages
  const userText = input.messages.filter((m) => m.role === "user").slice(-3).map((m) => m.content).join("\n");
  const language = detectLanguage(userText || input.config?.name || "");
  const provider = input.forceDemo ? null : getProvider();
  if (!provider) return { mode: "demo", language, ...mockChat(input.mode, input.messages, language, input.config), usage: null };

  const system = input.mode === "intake" ? intakePrompt(language) : workspacePrompt(language, summarizeWorkspace(input.config!, input.existingTasks));
  const meter = new UsageMeter();
  const raw = await meter.run(provider, {
    // The history goes in as one transcript: if earlier turns are sent as separate assistant
    // messages, the model copies their plain shape and drops "intent"/"instruction".
    messages: [
      { role: "system", content: system },
      { role: "user", content: transcriptPrompt(input.messages) },
    ],
    json: true,
    temperature: 0.5,
    maxTokens: 2000,
    timeoutMs: 60_000,
  });
  let obj: unknown;
  try {
    obj = extractJson(raw);
  } catch {
    // a plain-text answer is still a usable conversational reply
    const text = raw.trim();
    if (!text || text.length > 1500) throw new PipelineError("The AI reply was not valid JSON", "invalid_json", [], meter.report());
    obj = { reply: text, intent: "chat" };
  }
  const parsed = responseSchema.safeParse(obj);
  if (!parsed.success) throw new PipelineError("The AI reply was malformed", "validation", parsed.error.issues.map((i) => i.message), meter.report());
  const r = parsed.data;
  // keep intents consistent with the mode, and never act without the text needed to act
  let intent: ChatIntent = r.intent;
  if (input.mode === "intake" && intent === "edit") intent = "chat";
  if (input.mode === "workspace" && intent === "build") intent = "chat";
  const lastUser = [...input.messages].reverse().find((m) => m.role === "user")?.content ?? "";
  // the model sometimes decides to act but leaves out the text to act on: fall back to what the user said
  const brief = r.brief?.trim() || (intent === "build" ? input.messages.filter((m) => m.role === "user").map((m) => m.content).join("\n") : undefined);
  const instruction = r.instruction?.trim() || (intent === "edit" ? lastUser : undefined);
  return { mode: "live", language, reply: r.reply, quickReplies: intent === "chat" ? r.quickReplies : [], intent, brief, instruction, usage: meter.report() };
}
