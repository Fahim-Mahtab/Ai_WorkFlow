# Kajflow AI — AI-Powered Dynamic Work Management (PoC)

Describe your work in **বাংলা**, **Banglish** or **English** and the AI turns it into a working dashboard with forms, tables, task boards, charts, calendars and reports. You can then edit it by hand or by asking the AI.

The AI **never generates code**. It returns a JSON configuration, which is checked with **Zod** and against a fixed **component registry** before the dashboard renders it.

## Quick start

```bash
npm install
cp .env.example .env.local     # add your DeepSeek key (optional)
npm run dev                     # http://localhost:3000
```

Without a key the app runs in **demo mode** (shown in the top bar as "Demo mode — no API key"). A rule-based generator then stands in for the LLM. It produces the same JSON contract and goes through the same validation, so the whole UI can be tested offline.

### Configure DeepSeek

1. Create a key at https://platform.deepseek.com/api_keys.
2. Put it in `.env.local` (this file is git-ignored):
   ```
   DEEPSEEK_API_KEY=sk-...
   # optional
   DEEPSEEK_MODEL=deepseek-flash        # default; deepseek-v4-pro is ≈4x the price
   DEEPSEEK_REASONING_EFFORT=none       # default; low/high/max turn on "thinking" (slower, costs more)
   ```
3. Save the file. Next.js reloads it, and the badge switches to **AI: deepseek (deepseek-flash)**.

### Token usage & cost

Every AI request reports the tokens it used (input, with cached vs new; output, including any reasoning) and an estimated USD cost:
- **Under each AI reply** in the assistant (click the badge for a breakdown), on the generator preview, and next to work-log extraction.
- **Running totals:** for the workspace in the assistant header, for all workspaces in the top bar, and in Settings → AI provider & token spend (with a reset button).
- **Failed attempts** still show what they cost, since DeepSeek bills tokens even when the output is rejected.

Prices come from DeepSeek's published rates (`src/lib/ai/pricing.ts`, checked 2026-11-09). Each call is priced at the peak (01–04 and 06–10 UTC, Mon–Fri) or off-peak (half price) rate in effect when it was made. These are estimates; your DeepSeek dashboard is the source of truth. If DeepSeek changes its prices, update the table in that file.

Typical costs seen with `deepseek-flash` at peak rate: generating a full workspace ≈ 8k tokens ≈ $0.008; an AI edit ≈ 7k tokens ≈ $0.005 (the whole config is sent each time); a work-log extraction ≈ 300 tokens ≈ $0.0002.

The key is only read in server code (`src/lib/ai/providers/*`, marked `server-only`) and used by the Next.js API routes under `/api/ai/*`. `/api/ai/status` reports the active mode but never returns the key.

## How it works

```
User prompt
  → Language understanding      (lib/ai/language.ts — Bengali script / Banglish / English)
  → Requirement analysis + workspace planning   (lib/ai/prompts — one structured LLM call)
  → JSON configuration generation               (DeepSeek, response_format=json_object)
  → JSON extraction             (lib/ai/json.ts — strips fences and trailing commas)
  → Normalization + Zod validation              (lib/config/validate.ts, lib/config/schema.ts)
  → Component registry validation               (unknown types removed, broken refs repaired)
  → one automatic repair retry with the validation errors
  → Dashboard preview + analysis → user approval → saved to LocalStorage
```

AI edits follow the same path. The model gets the current config and returns a full updated config. The app then computes a structural diff (`lib/workspace/diff.ts`) and shows **Changes + Live preview** before anything is applied. Data (tasks, records, work logs) is stored separately from the config, so edits never destroy it.

### Honest about limits

When a user asks for something the registry can't build, like a Gantt chart, map, SMS reminders, payments, login/permissions, PDF export, file upload, custom branding or automation, the AI does not pretend. It returns an `unsupported` list. Each entry says what was asked, why it isn't possible yet, and the closest alternative it built instead (e.g. Gantt → deadline calendar + task table). It also returns 2–4 `suggestions`: next steps that fit the user's goal, written in the user's language, which can be applied with one click. The live model gets these rules in its system prompt (`lib/ai/prompts`), and demo mode uses `lib/ai/mock/capabilities.ts`.

### Component registry (13 types)

`metric`, `table`, `kanban`, `taskList`, `form`, `barChart`, `lineChart`, `pieChart`, `calendar`, `activity`, `progress`, `attachments`, `worklog`. The metadata lives in `lib/registry/catalog.ts` and the React mapping in `components/dashboard/widget-registry.tsx`. Each widget has a Zod schema, and widgets read any data source (`tasks`, `worklogs`, or a user collection) through a small declarative query engine (`lib/engine`).

## Project structure

```
src/
  app/
    api/ai/{generate,edit,worklog,status}/route.ts   server-side AI endpoints
    page.tsx                 AI workspace generator + workspace list
    dashboard/ tasks/ team/ reports/ settings/       app sections
  lib/
    ai/
      providers/             AIProvider interface, DeepSeek, Claude stub, factory
      prompts/               system prompts + compact schema doc for the LLM
      mock/                  demo-mode generator / editor / work-log extractor
      pipeline.ts            generate / edit / worklog pipelines (server-only)
      language.ts json.ts client.ts
    config/                  schema.ts (Zod), types.ts, validate.ts
    registry/catalog.ts      component registry metadata + defaults + view switching
    engine/                  data sources + query (filter, group, aggregate, buckets)
    storage/local.ts         LocalStorage persistence
    workspace/               store (React context), factory, demos, diff
  components/
    ui/                      shadcn-style primitives (Radix)
    layout/                  app shell, providers, page header
    ai/                      generator, assistant panel, progress, change preview
    dashboard/               renderer canvas (dnd-kit), registry, env
    editor/                  widget settings, add widget, fields editor
    widgets/                 the 13 registry components
    tasks/                   task dialog, badges
    worklog/                 natural-language self-report composer
```

## Try it

- **Test A (Bangla)**: click the "বাংলা · Municipality data entry" sample and choose **Generate workspace**.
- **Test B (Banglish)**: click the "Banglish · Software team" sample.
- New workspaces start empty (no sample tasks, records or invented names). Name your team in the **Team** box before creating it.
- AI edits: open **AI Assistant** and try “Dashboard e ekta weekly report chart add koro.”, “Monthly report ta remove kore daily report add koro.”, “Task board e ekta Review status add koro.” or “Employee der jonno daily work submission form add koro.”
- Self-reported work: go to **Tasks & Work log → Self-reported work** and enter “Ajke API integration korechi, database optimize korechi and 2 ta bug fix korechi.”

## Limits of this PoC

- Demo mode understands a fixed set of domains (municipality/data entry, software, generic office/sales/school) and common edit phrases. Free-form understanding needs `DEEPSEEK_API_KEY`.
- File attachments are stored as references (name and size) only. Nothing is uploaded.
- There is no authentication or multi-user support, and data lives only in this browser's LocalStorage.
- The Claude provider is an interface stub (`lib/ai/providers/claude.ts`).
