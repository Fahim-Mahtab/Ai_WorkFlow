"use client";
/** Reports: an analytics page auto-built from the workspace's sources using the same registry widgets. */
import { useMemo } from "react";
import { Lightbulb, Sparkles } from "lucide-react";
import { PageHeader, RequireWorkspace } from "@/components/layout/page-header";
import { WorkspaceEnv } from "@/components/tasks/task-dialog-host";
import { DashboardCanvas } from "@/components/dashboard/dashboard-canvas";
import { useAssistant } from "@/components/layout/providers";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/primitives";
import type { Page, Widget, Workspace } from "@/lib/config/types";

function buildReportPages(ws: Workspace): Page[] {
  const { config } = ws;
  const bn = config.language === "bn";
  const L = (b: string, e: string) => (bn ? b : e);
  const tasks: Widget[] = [
    { id: "r_total", type: "metric", title: L("মোট কাজ", "Total tasks"), width: 1, source: "tasks", aggregate: "count", color: "blue" },
    { id: "r_week", type: "metric", title: L("এই সপ্তাহে তৈরি", "Created this week"), width: 1, source: "tasks", aggregate: "count", dateRange: "week", color: "violet" },
    { id: "r_logs", type: "metric", title: L("আজকের কাজের লগ", "Work logs today"), width: 1, source: "worklogs", aggregate: "count", dateRange: "today", color: "green" },
    { id: "r_hours", type: "metric", title: L("এই সপ্তাহের ঘণ্টা", "Hours logged (7d)"), width: 1, source: "worklogs", aggregate: "sum", field: "hours", dateRange: "week", color: "amber" },
    { id: "r_completion", type: "progress", title: L("সম্পন্নের হার", "Completion rate"), width: 2, source: "tasks", mode: "completion" },
    { id: "r_member", type: "progress", title: L("সদস্যভিত্তিক অগ্রগতি", "Progress by member"), width: 2, source: "tasks", mode: "byMember" },
    { id: "r_status", type: "barChart", title: L("অবস্থা অনুযায়ী কাজ", "Tasks by status"), width: 2, source: "tasks", groupBy: "status", aggregate: "count" },
    { id: "r_priority", type: "pieChart", title: L("অগ্রাধিকার", "Tasks by priority"), width: 2, source: "tasks", groupBy: "priority", aggregate: "count" },
    { id: "r_assignee", type: "barChart", title: L("সদস্য অনুযায়ী কাজ", "Tasks per assignee"), width: 2, source: "tasks", groupBy: "assignees", aggregate: "count" },
    { id: "r_trend", type: "lineChart", title: L("সাপ্তাহিক নতুন কাজ", "New tasks per week"), width: 2, source: "tasks", dateField: "createdAt", dateBucket: "week", aggregate: "count", periods: 8 },
  ];
  const work: Widget[] = [
    { id: "r_wl_daily", type: "lineChart", title: L("দৈনিক কাজের রিপোর্ট", "Daily work reports"), width: 2, source: "worklogs", dateField: "date", dateBucket: "day", aggregate: "count", periods: 14 },
    { id: "r_wl_hours", type: "barChart", title: L("সদস্য অনুযায়ী ঘণ্টা", "Hours per member"), width: 2, source: "worklogs", groupBy: "memberId", aggregate: "sum", valueField: "hours" },
    { id: "r_wl_cat", type: "pieChart", title: L("কাজের বিভাগ", "Work by category"), width: 2, source: "worklogs", groupBy: "category", aggregate: "count" },
    { id: "r_wl_status", type: "pieChart", title: L("কাজের অবস্থা", "Work status"), width: 2, source: "worklogs", groupBy: "status", aggregate: "count" },
  ];
  const pages: Page[] = [
    { id: "r_tasks", title: L("কাজের রিপোর্ট", "Task analytics"), icon: "chart", widgets: tasks },
    { id: "r_work", title: L("দৈনিক কাজ", "Daily work"), icon: "clipboard", widgets: work },
  ];
  for (const c of config.collections) {
    const cat = c.fields.find((f) => f.type === "select" || f.type === "member");
    const num = c.fields.find((f) => f.type === "number");
    pages.push({
      id: `r_${c.id}`,
      title: c.name,
      icon: "file",
      widgets: [
        { id: `${c.id}_count`, type: "metric", title: L("মোট এন্ট্রি", "Total entries"), width: 1, source: c.id, aggregate: "count", color: "blue" },
        { id: `${c.id}_today`, type: "metric", title: L("আজ", "Today"), width: 1, source: c.id, aggregate: "count", dateRange: "today", color: "green" },
        { id: `${c.id}_week`, type: "metric", title: L("এই সপ্তাহ", "Last 7 days"), width: 1, source: c.id, aggregate: "count", dateRange: "week", color: "violet" },
        num
          ? { id: `${c.id}_sum`, type: "metric", title: `Σ ${num.label}`, width: 1, source: c.id, aggregate: "sum", field: num.id, color: "amber" }
          : { id: `${c.id}_month`, type: "metric", title: L("এই মাস", "Last 30 days"), width: 1, source: c.id, aggregate: "count", dateRange: "month", color: "amber" },
        { id: `${c.id}_daily`, type: "lineChart", title: L("দৈনিক এন্ট্রি", "Entries per day"), width: 2, source: c.id, dateField: "createdAt", dateBucket: "day", aggregate: "count", periods: 14 },
        { id: `${c.id}_by`, type: "barChart", title: L("জমাদানকারী অনুযায়ী", "Entries by submitter"), width: 2, source: c.id, groupBy: "createdBy", aggregate: "count" },
        ...(cat ? [{ id: `${c.id}_cat`, type: "pieChart" as const, title: cat.label, width: 2, source: c.id, groupBy: cat.id, aggregate: "count" as const }] : []),
      ],
    });
  }
  return pages;
}

function ReportsView({ ws }: { ws: Workspace }) {
  const { ask } = useAssistant();
  const reportWs = useMemo<Workspace>(() => ({ ...ws, config: { ...ws.config, pages: buildReportPages(ws) } }), [ws]);
  return (
    <div className="mx-auto max-w-[1600px] space-y-5 px-4 py-6 sm:px-6">
      <PageHeader title="Reports" description="Analytics generated automatically from every data source in this workspace." />
      {ws.config.reports && ws.config.reports.length > 0 && (
        <Card className="p-4">
          <p className="mb-2 flex items-center gap-2 text-sm font-semibold"><Lightbulb className="size-4 text-amber-500" /> AI-suggested reports</p>
          <div className="flex flex-wrap gap-2">
            {ws.config.reports.map((r) => (
              <Button key={r} variant="outline" size="sm" onClick={() => ask(ws.config.language === "bn" ? `ড্যাশবোর্ডে "${r}" রিপোর্ট যোগ করো` : `Add a "${r}" report to the dashboard`)}>
                <Sparkles /> {r}
              </Button>
            ))}
          </div>
        </Card>
      )}
      <WorkspaceEnv workspace={reportWs}>
        <DashboardCanvas workspace={reportWs} />
      </WorkspaceEnv>
    </div>
  );
}

export default function ReportsPage() {
  return <RequireWorkspace>{(ws) => <ReportsView key={ws.id} ws={ws} />}</RequireWorkspace>;
}
