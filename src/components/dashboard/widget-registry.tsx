"use client";
/**
 * THE component registry: maps every approved widget `type` to a React
 * component. AI output can only select from these — it never ships code.
 */
import type { ComponentType } from "react";
import { Activity, BarChart3, CalendarDays, ClipboardList, FileInput, Gauge, Hash, KanbanSquare, LineChart, ListChecks, Paperclip, PieChart, Table2, Users } from "lucide-react";
import type { Widget, WidgetType } from "@/lib/config/types";
import { MetricWidget } from "@/components/widgets/metric";
import { TableWidget } from "@/components/widgets/table";
import { KanbanWidget } from "@/components/widgets/kanban";
import { TaskListWidget } from "@/components/widgets/task-list";
import { FormWidget } from "@/components/widgets/form";
import { BarChartWidget, LineChartWidget, PieChartWidget } from "@/components/widgets/charts";
import { ActivityWidget, AttachmentsWidget, CalendarWidget, ProgressWidget } from "@/components/widgets/misc";
import { WorklogWidget } from "@/components/widgets/worklog";
import { WorkloadWidget } from "@/components/widgets/workload";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyWidgetComponent = ComponentType<{ widget: any }>;

export const WIDGET_COMPONENTS: Record<WidgetType, AnyWidgetComponent> = {
  metric: MetricWidget,
  table: TableWidget,
  kanban: KanbanWidget,
  taskList: TaskListWidget,
  form: FormWidget,
  barChart: BarChartWidget,
  lineChart: LineChartWidget,
  pieChart: PieChartWidget,
  calendar: CalendarWidget,
  activity: ActivityWidget,
  progress: ProgressWidget,
  attachments: AttachmentsWidget,
  worklog: WorklogWidget,
  workload: WorkloadWidget,
};

export const WIDGET_ICONS: Record<WidgetType, ComponentType<{ className?: string }>> = {
  metric: Hash,
  table: Table2,
  kanban: KanbanSquare,
  taskList: ListChecks,
  form: FileInput,
  barChart: BarChart3,
  lineChart: LineChart,
  pieChart: PieChart,
  calendar: CalendarDays,
  activity: Activity,
  progress: Gauge,
  attachments: Paperclip,
  worklog: ClipboardList,
  workload: Users,
};

export function RenderWidget({ widget }: { widget: Widget }) {
  const C = WIDGET_COMPONENTS[widget.type];
  if (!C) return <p className="text-sm text-destructive">Unknown widget type “{String((widget as { type: string }).type)}”</p>;
  return <C widget={widget} />;
}
