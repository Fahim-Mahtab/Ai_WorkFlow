/** Compact, LLM-friendly description of the config contract. Kept in sync with config/schema.ts. */
import { catalogForPrompt } from "../../registry/catalog";
import { PAGE_ICONS } from "../../config/schema";

export function schemaDoc(): string {
  return `
WorkspaceConfig (JSON):
{
  "version": 1,
  "name": string, "description": string,
  "language": "bn" | "en" | "banglish",
  "team": {
    "roles": [{ "id": slug, "name": string, "description"?: string }],
    "members": [{ "id": slug, "name": string, "roleId": role id }]
  },
  "taskStatuses": [{ "id": slug, "label": string, "color": "slate"|"blue"|"amber"|"violet"|"green"|"red"|"pink"|"cyan"|"orange", "isDone"?: true }],   // 3-7 items, exactly one or more isDone
  "priorities": [{ "id": "low"|"medium"|"high"|"urgent", "label": string }],
  "taskFields": [Field],          // custom fields on every task (e.g. ward, sprint, severity)
  "collections": [{ "id": slug, "name": string, "description"?: string, "fields": [Field] }],   // record types filled by forms (citizens, bugs, deployments…)
  "pages": [{ "id": slug, "title": string, "icon"?: ${PAGE_ICONS.map((i) => `"${i}"`).join("|")}, "widgets": [Widget] }],
  "reports"?: [string],           // suggested reports/analytics in user's language
  "seed"?: {                      // ONLY tasks/records the user actually described — never invented
    "tasks"?: [{ "title", "description"?, "status": status id, "priority"?: priority id, "assigneeIds"?: [member id], "dueDate"?: "YYYY-MM-DD", "subtasks"?: [string], "custom"?: { taskFieldId: value } }],
    "records"?: { collectionId: [ { fieldId: value } ] }
  }
}

Field = { "id": slug, "label": string, "type": "text"|"textarea"|"number"|"date"|"select"|"multiselect"|"email"|"phone"|"url"|"checkbox"|"member", "required"?: bool, "options"?: [string] (required for select/multiselect), "placeholder"?: string }

slug = lowercase ascii /^[a-z0-9][a-z0-9_-]*$/ (ALWAYS English/ascii even if labels are Bengali).

DATA SOURCES ("source" in widgets):
- "tasks": fields title, status, priority, assignees(member), dueDate, createdAt, completedAt, kind ("assigned"|"self") + taskFields ids
- "worklogs": daily self-reported work: date, memberId(member), description, category, hours(number), status
- any collection id: its field ids + createdAt(date) + createdBy(member)

Widget = common { "id": slug, "type", "title": string, "description"?: string, "width": 1|2|3|4 (grid of 4 columns) } plus per type:
- metric:     { "source", "aggregate": "count"|"sum"|"avg", "field"?: number field (for sum/avg), "filter"?: Filter, "dateRange"?: "today"|"week"|"month"|"all", "target"?: number, "color"?: color }
- table:      { "source", "columns": [field ids], "pageSize"?: number, "filter"?: Filter }
- kanban:     { "filter"?: Filter }                         (always tasks grouped by status)
- taskList:   { "filter"?: Filter, "showCompleted"?: bool, "limit"?: number }
- form:       { "collectionId", "submitLabel"?: string, "successMessage"?: string }
- barChart:   { "source", "groupBy": field id, "aggregate", "valueField"?, "dateBucket"?: "day"|"week"|"month" (when groupBy is a date), "filter"?, "dateRange"? }
- lineChart:  { "source", "dateField": date field id, "dateBucket": "day"|"week"|"month", "aggregate", "valueField"?, "periods"?: number }
- pieChart:   { "source", "groupBy", "aggregate", "valueField"? , "filter"? }
- calendar:   { "source", "dateField", "titleField" }
- activity:   { "limit"?: number }
- progress:   { "source", "mode": "completion" (tasks only: done/total) | "target" (count vs target) | "byMember" (per assignee/creator), "target"?: number, "dateRange"? }
- attachments:{ }                                           (shared files/links)
- worklog:    { "showRecent"?: number }                     (employees describe today's work in natural language; AI splits it into entries)
Filter = { "field": field id, "op": "eq"|"neq"|"contains"|"empty"|"notEmpty"|"gt"|"lt", "value"?: string|number|boolean }

COMPONENT REGISTRY (the ONLY allowed widget types):
${catalogForPrompt()}
`.trim();
}
