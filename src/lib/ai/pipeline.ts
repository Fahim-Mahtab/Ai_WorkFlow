import "server-only";
/**
 * Server-side AI pipeline:
 *   prompt → language understanding → requirement analysis + workspace planning (LLM)
 *   → JSON extraction → Zod validation → registry validation → (one repair retry) → response
 * Falls back to the rule-based demo generator when no API key is configured.
 */
import { getProvider } from "./providers";
import { AIProviderError, type AIProvider, type ChatMessage, type CompletionOptions } from "./providers/types";
import { costOf, emptyUsage, ratesFor, type TokenUsage, type UsageReport } from "./pricing";
import { detectLanguage } from "./language";
import { extractJson } from "./json";
import { editSystemPrompt, editUserPrompt, generateSystemPrompt, repairPrompt, worklogSystemPrompt } from "./prompts";
import { validateConfig } from "../config/validate";
import { analysisSchema, seedTaskSchema, taskUpdateSchema, unsupportedSchema, worklogResponseSchema } from "../config/schema";
import type { Analysis, Language, SeedTask, TaskUpdate, Unsupported, WorkEntry, WorkspaceConfig } from "../config/types";
import { detectUnsupported, stripUnsupported, suggestionsFor } from "./mock/capabilities";
import { mockGenerate } from "./mock/generator";
import { mockEdit } from "./mock/editor";
import { mockWorklog } from "./mock/worklog";

export interface PipelineStep {
  id: "language" | "analysis" | "generation" | "zod" | "registry" | "repair";
  label: string;
  ms: number;
  detail?: string;
}

export interface GenerateResult {
  mode: "live" | "demo";
  language: Language;
  message: string;
  analysis: Analysis | null;
  needsClarification: boolean;
  questions: string[];
  config: WorkspaceConfig | null;
  warnings: string[];
  steps: PipelineStep[];
  /** Requests the registry cannot build, with the closest alternative used. */
  unsupported: Unsupported[];
  /** Concrete next-step instructions relevant to the user's goal (in their language). */
  suggestions: string[];
  /** Tokens + cost of this request (null in demo mode). */
  usage?: UsageReport | null;
}

export interface EditResult {
  mode: "live" | "demo";
  message: string;
  summary: string[];
  config: WorkspaceConfig | null;
  warnings: string[];
  steps: PipelineStep[];
  unsupported: Unsupported[];
  suggestions: string[];
  /** Real tasks the user asked to create (checked against the workspace's people and statuses). */
  newTasks: SeedTask[];
  /** Changes to existing tasks, by their #number in the task list the client sent. */
  taskUpdates: TaskUpdate[];
  usage?: UsageReport | null;
}

const findMember = (config: WorkspaceConfig, a: string) => config.team.members.find((m) => m.id === a || m.name.toLowerCase() === a.toLowerCase())?.id;
const findStatus = (config: WorkspaceConfig, s: string) => config.taskStatuses.find((x) => x.id === s || x.label.toLowerCase() === s.toLowerCase())?.id;

/** Read changes to existing tasks: only real task numbers, people and statuses; empty changes are dropped. */
function readTaskUpdates(raw: unknown, config: WorkspaceConfig, taskCount: number): TaskUpdate[] {
  if (!Array.isArray(raw)) return [];
  const byTask = new Map<number, TaskUpdate>();
  for (const item of raw.slice(0, 60)) {
    const p = taskUpdateSchema.safeParse(item);
    if (!p.success || p.data.task > taskCount) continue;
    const u: TaskUpdate = { task: p.data.task };
    if (p.data.title) u.title = p.data.title;
    if (p.data.status) {
      const s = findStatus(config, p.data.status);
      if (s) u.status = s;
    }
    if (p.data.priority) u.priority = p.data.priority;
    if (p.data.dueDate) u.dueDate = p.data.dueDate;
    if (p.data.assigneeIds) {
      const ids = p.data.assigneeIds.map((a) => findMember(config, a)).filter((a): a is string => !!a);
      if (ids.length || p.data.assigneeIds.length === 0) u.assigneeIds = [...new Set(ids)];
    }
    if (Object.keys(u).length > 1) byTask.set(u.task, { ...byTask.get(u.task), ...u });
  }
  return [...byTask.values()];
}

/** Read the edit's new tasks, fixing people/status references and dropping anything unusable. */
function readNewTasks(raw: unknown, config: WorkspaceConfig): SeedTask[] {
  if (!Array.isArray(raw)) return [];
  const out: SeedTask[] = [];
  for (const item of raw.slice(0, 30)) {
    const p = seedTaskSchema.safeParse(item);
    if (!p.success) continue;
    const t = p.data;
    const assigneeIds = (t.assigneeIds ?? [])
      .map((a) => config.team.members.find((m) => m.id === a || m.name.toLowerCase() === a.toLowerCase())?.id)
      .filter((a): a is string => !!a);
    const status = config.taskStatuses.find((s) => s.id === t.status || s.label.toLowerCase() === String(t.status ?? "").toLowerCase())?.id ?? config.taskStatuses.find((s) => !s.isDone)?.id ?? config.taskStatuses[0].id;
    out.push({ ...t, status, assigneeIds });
  }
  return out;
}

/** Leniently read `unsupported` + `suggestions` from model output and fold in registry rejections. */
function readExtras(obj: Record<string, unknown>, warnings: string[], lang: Language): { unsupported: Unsupported[]; suggestions: string[] } {
  const unsupported: Unsupported[] = Array.isArray(obj.unsupported)
    ? obj.unsupported.map((u) => unsupportedSchema.safeParse(u).data).filter((u): u is Unsupported => !!u).slice(0, 8)
    : [];
  for (const w of warnings) {
    const m = w.match(/^Unknown component type "(.+?)"/);
    if (m && !unsupported.some((u) => u.request.toLowerCase().includes(m[1].toLowerCase()))) {
      unsupported.push({
        request: m[1],
        reason: lang === "bn" ? "এই ধরনের কম্পোনেন্ট এখনও রেজিস্ট্রিতে নেই" : "This component type is not in the registry yet",
        alternative: lang === "bn" ? "বাদ দেওয়া হয়েছে — বিকল্প হিসেবে টেবিল, চার্ট বা ক্যালেন্ডার ব্যবহার করুন" : "Left out — a table, chart or calendar can usually show the same information",
      });
    }
  }
  const suggestions = Array.isArray(obj.suggestions)
    ? obj.suggestions.filter((s): s is string => typeof s === "string" && s.trim().length > 2).map((s) => s.trim().slice(0, 200)).slice(0, 4)
    : [];
  return { unsupported, suggestions };
}

export class PipelineError extends Error {
  constructor(
    message: string,
    public readonly kind: "provider" | "invalid_json" | "validation",
    public readonly details: string[] = [],
    /** Tokens already spent before the failure — still billed, so we still report them. */
    public readonly usage: UsageReport | null = null,
  ) {
    super(message);
  }
}

/**
 * Accumulates token usage + cost across every API call made for one user action
 * (including repair retries). Each call is priced at the peak/off-peak rate in
 * effect when it was made.
 */
export class UsageMeter {
  private total = emptyUsage();
  private calls = 0;
  private cost: number | null = 0;
  private model = "";
  private peak = false;
  private rates: UsageReport["rates"] = null;
  private readonly started = Date.now();

  add(model: string, usage: TokenUsage | null) {
    this.calls++;
    this.model = model;
    if (!usage) return;
    for (const k of Object.keys(this.total) as (keyof TokenUsage)[]) this.total[k] += usage[k];
    const r = ratesFor(model);
    if (!r) this.cost = null;
    else {
      this.peak = r.peak;
      this.rates = r.rates;
      if (this.cost !== null) this.cost += costOf(usage, r.rates);
    }
  }

  /** Run one completion, recording its usage even if it fails. */
  async run(provider: AIProvider, opts: CompletionOptions): Promise<string> {
    try {
      const r = await provider.complete(opts);
      this.add(r.model, r.usage);
      return r.content;
    } catch (err) {
      if (err instanceof AIProviderError) {
        if (err.usage) this.add(provider.model, err.usage);
        throw new PipelineError(err.message, "provider", [], this.report());
      }
      throw err;
    }
  }

  report(): UsageReport | null {
    if (!this.calls) return null;
    return { ...this.total, model: this.model, calls: this.calls, costUsd: this.cost, peak: this.peak, rates: this.rates, ms: Date.now() - this.started };
  }
}

function timer() {
  let last = Date.now();
  return () => {
    const now = Date.now();
    const d = now - last;
    last = now;
    return d;
  };
}

/** Ask the model, parse JSON, validate config; retry once with the validation errors. */
async function askForConfig(
  messages: ChatMessage[],
  pickConfig: (obj: Record<string, unknown>) => unknown,
  steps: PipelineStep[],
  tick: () => number,
  meter: UsageMeter,
): Promise<{ obj: Record<string, unknown>; config: WorkspaceConfig | null; warnings: string[] }> {
  const provider = getProvider()!;
  let lastErrors: string[] = [];
  for (let attempt = 0; attempt < 2; attempt++) {
    const raw = await meter.run(provider, { messages, json: true });
    steps.push({ id: attempt ? "repair" : "generation", label: attempt ? "Repair attempt" : "JSON configuration generation", ms: tick() });
    let obj: Record<string, unknown>;
    try {
      obj = extractJson(raw) as Record<string, unknown>;
    } catch {
      lastErrors = ["Response was not a valid JSON object"];
      messages = [...messages, { role: "assistant", content: raw.slice(0, 4000) }, { role: "user", content: repairPrompt(lastErrors) }];
      continue;
    }
    const rawConfig = pickConfig(obj);
    if (rawConfig === null || rawConfig === undefined) return { obj, config: null, warnings: [] };
    const result = validateConfig(rawConfig);
    steps.push({ id: "zod", label: "Zod schema validation", ms: tick(), detail: result.ok ? "passed" : `${result.errors.length} errors` });
    if (result.ok) {
      steps.push({ id: "registry", label: "Component registry validation", ms: tick(), detail: result.warnings.length ? `${result.warnings.length} auto-fixes` : "all references resolved" });
      return { obj, config: result.config!, warnings: result.warnings };
    }
    lastErrors = result.errors;
    messages = [...messages, { role: "assistant", content: JSON.stringify(obj).slice(0, 12000) }, { role: "user", content: repairPrompt(lastErrors) }];
  }
  throw new PipelineError("The AI produced a configuration that failed validation twice.", "validation", lastErrors, meter.report());
}

export async function runGenerate(input: { prompt: string; history?: ChatMessage[]; forceDemo?: boolean; forceGenerate?: boolean }): Promise<GenerateResult> {
  const tick = timer();
  const steps: PipelineStep[] = [];
  const language = detectLanguage(input.prompt);
  steps.push({ id: "language", label: "Language understanding", ms: tick(), detail: language });

  const provider = input.forceDemo ? null : getProvider();
  if (!provider) {
    const mock = mockGenerate(input.prompt, input.forceGenerate);
    steps.push({ id: "analysis", label: "Requirement analysis (demo rules)", ms: tick() });
    steps.push({ id: "generation", label: "JSON configuration generation", ms: tick() });
    let config: WorkspaceConfig | null = null;
    let warnings: string[] = [];
    if (mock.config) {
      const v = validateConfig(mock.config);
      steps.push({ id: "zod", label: "Zod schema validation", ms: tick(), detail: v.ok ? "passed" : v.errors.join("; ") });
      if (!v.ok) throw new PipelineError("Demo generator produced an invalid config", "validation", v.errors);
      steps.push({ id: "registry", label: "Component registry validation", ms: tick(), detail: v.warnings.length ? `${v.warnings.length} auto-fixes` : "all references resolved" });
      config = { ...v.config!, seed: undefined }; // the demo generator's sample tasks are invented
      warnings = v.warnings;
    }
    const unsupported = detectUnsupported(input.prompt, language);
    const suggestions = mock.config ? suggestionsFor(input.prompt, language) : [];
    return { mode: "demo", language, message: mock.message, analysis: analysisSchema.safeParse(mock.analysis).data ?? null, needsClarification: mock.needsClarification, questions: mock.questions, config, warnings, steps, unsupported, suggestions };
  }

  const userContent = input.forceGenerate
    ? `${input.prompt}\n\n(Do not ask clarification questions now — generate the best possible workspace with reasonable assumptions.)`
    : input.prompt;
  const messages: ChatMessage[] = [
    { role: "system", content: generateSystemPrompt(language) },
    ...(input.history ?? []).slice(-6),
    { role: "user", content: userContent },
  ];
  steps.push({ id: "analysis", label: "Requirement analysis & workspace planning", ms: tick() });
  const meter = new UsageMeter();
  const { obj, config, warnings } = await askForConfig(messages, (o) => (o.needsClarification && !input.forceGenerate ? null : o.config), steps, tick, meter);
  const analysis = analysisSchema.safeParse({ ...(obj.analysis as object), language }).data ?? null;
  const questions = Array.isArray(obj.questions) ? obj.questions.filter((q): q is string => typeof q === "string").slice(0, 5) : [];
  return {
    mode: "live",
    language,
    message: typeof obj.message === "string" ? obj.message : "",
    analysis,
    needsClarification: !config && !!obj.needsClarification,
    questions,
    config,
    warnings,
    steps,
    ...readExtras(obj, warnings, language),
    usage: meter.report(),
  };
}

export async function runEdit(input: { instruction: string; config: WorkspaceConfig; existingTasks?: string[]; forceDemo?: boolean }): Promise<EditResult> {
  const tick = timer();
  const steps: PipelineStep[] = [];
  const language = input.config.language ?? detectLanguage(input.instruction);
  steps.push({ id: "language", label: "Language understanding", ms: tick(), detail: detectLanguage(input.instruction) });
  const provider = input.forceDemo ? null : getProvider();
  if (!provider) {
    const unsupported = detectUnsupported(input.instruction, language);
    const doable = unsupported.length ? stripUnsupported(input.instruction) : input.instruction;
    const m = doable.length > 2 ? mockEdit(doable, input.config) : { understood: false, summary: [], config: input.config, message: "" };
    steps.push({ id: "generation", label: "Config modification (demo rules)", ms: tick() });
    const suggestions = suggestionsFor(input.instruction, language, input.config);
    if (!m.understood) {
      // Honest answer: explain what can't be done and offer relevant things that can.
      const message = unsupported.length
        ? language === "bn"
          ? "এই অনুরোধটি বর্তমান কম্পোনেন্ট দিয়ে সরাসরি করা সম্ভব নয়। নিচে কারণ ও বিকল্প দেওয়া হলো।"
          : language === "banglish"
            ? "Ei request ta ekhonkar component diye shorasori kora jabe na. Nicher alternative gulo try korun."
            : "This request can't be built with the current components. Here's why, and what you can do instead."
        : m.message;
      return { mode: "demo", message, summary: [], config: null, warnings: [], steps, unsupported, suggestions, newTasks: [], taskUpdates: [] };
    }
    const v = validateConfig(m.config);
    if (!v.ok) throw new PipelineError("Demo edit produced an invalid config", "validation", v.errors);
    steps.push({ id: "zod", label: "Zod schema validation", ms: tick(), detail: "passed" });
    steps.push({ id: "registry", label: "Component registry validation", ms: tick() });
    return { mode: "demo", message: m.message, summary: m.summary, config: { ...v.config!, seed: undefined }, warnings: v.warnings, steps, unsupported, suggestions, newTasks: [], taskUpdates: [] };
  }
  const messages: ChatMessage[] = [
    { role: "system", content: editSystemPrompt(language) },
    { role: "user", content: editUserPrompt(input.instruction, input.config, input.existingTasks) },
  ];
  const meter = new UsageMeter();
  const { obj, config, warnings } = await askForConfig(messages, (o) => o.config, steps, tick, meter);
  const summary = Array.isArray(obj.summary) ? obj.summary.filter((s): s is string => typeof s === "string") : [];
  const base = config ?? input.config;
  const newTasks = readNewTasks(obj.newTasks, base);
  const taskUpdates = readTaskUpdates(obj.taskUpdates, base, input.existingTasks?.length ?? 0);
  // task-only edits may send "config": null (far fewer tokens than repeating the whole config)
  const out = config ?? (newTasks.length || taskUpdates.length ? input.config : null);
  return { mode: "live", message: typeof obj.message === "string" ? obj.message : "", summary, config: out ? { ...out, seed: undefined } : null, warnings, steps, ...readExtras(obj, warnings, language), newTasks, taskUpdates, usage: meter.report() };
}

export interface WorklogResult {
  mode: "live" | "demo";
  message: string;
  entries: WorkEntry[];
  usage: UsageReport | null;
}

export async function runWorklog(input: { text: string; language?: Language; forceDemo?: boolean }): Promise<WorklogResult> {
  const provider = input.forceDemo ? null : getProvider();
  if (!provider) return { mode: "demo", ...mockWorklog(input.text), usage: null };
  const lang = detectLanguage(input.text);
  const meter = new UsageMeter();
  const raw = await meter.run(provider, {
    messages: [
      { role: "system", content: worklogSystemPrompt(lang) },
      { role: "user", content: input.text },
    ],
    json: true,
    temperature: 0.2,
    maxTokens: 2000,
    timeoutMs: 60_000,
  });
  let obj: unknown;
  try {
    obj = extractJson(raw);
  } catch {
    throw new PipelineError("AI response was not valid JSON", "invalid_json", [], meter.report());
  }
  const parsed = worklogResponseSchema.safeParse(obj);
  if (!parsed.success) throw new PipelineError("AI returned malformed work entries", "validation", parsed.error.issues.map((i) => i.message), meter.report());
  return { mode: "live", ...parsed.data, usage: meter.report() };
}
