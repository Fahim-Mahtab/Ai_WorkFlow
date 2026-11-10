"use client";
/**
 * Bar / line / pie charts (Recharts). Colors use the validated categorical
 * palette tokens (--series-N), assigned in fixed order; pie folds >7 slices
 * into "Other". Each chart can flip to a table view for accessibility.
 */
import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { BarChart3, Table2 } from "lucide-react";
import { HeaderAction } from "@/components/dashboard/header-slot";
import type { WidgetOf } from "@/lib/config/types";
import { useEnv } from "@/components/dashboard/env";
import { getRows, getSource } from "@/lib/engine/sources";
import { aggregate, applyDateRange, applyFilter, bucketKey, formatBucket, groupRows, lastBuckets, type Datum } from "@/lib/engine/query";
import { EmptyState } from "@/components/ui/primitives";
import { formatNumber } from "@/lib/utils";

const SERIES = Array.from({ length: 8 }, (_, i) => `var(--series-${i + 1})`);
const OTHER = "var(--chart-axis)";
const axisProps = { stroke: "var(--chart-axis)", fontSize: 11, tickLine: false, axisLine: false } as const;

function ChartTooltip({ active, payload, label, lang }: { active?: boolean; payload?: { value: number; payload: Datum; color?: string }[]; label?: string; lang: "bn" | "en" | "banglish" }) {
  if (!active || !payload?.length) return null;
  const p = payload[0];
  return (
    <div className="rounded-md border bg-card px-2.5 py-1.5 text-xs shadow-md">
      <div className="text-muted-foreground">{label ?? p.payload.label}</div>
      <div className="font-semibold tabular-nums text-foreground">{formatNumber(p.value, lang)}</div>
    </div>
  );
}

function DataTable({ data, lang }: { data: Datum[]; lang: "bn" | "en" | "banglish" }) {
  return (
    <div className="max-h-56 overflow-auto scrollbar-thin">
      <table className="w-full text-sm">
        <tbody>
          {data.map((d) => (
            <tr key={d.key} className="border-b last:border-0">
              <td className="py-1.5 pr-2 text-muted-foreground">{d.label}</td>
              <td className="py-1.5 text-right font-medium tabular-nums">{formatNumber(d.value, lang)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ChartShell({ data, lang, children }: { data: Datum[]; lang: "bn" | "en" | "banglish"; children: React.ReactNode }) {
  const { t } = useEnv();
  const [asTable, setAsTable] = useState(false);
  if (data.length === 0 || data.every((d) => d.value === 0)) return <EmptyState icon={<BarChart3 />} title={t("noData")} className="py-6" />;
  return (
    <div className="relative">
      <HeaderAction fallbackClassName="absolute -top-1 right-0 z-10">
        <button onClick={() => setAsTable((v) => !v)} className="rounded p-1 text-muted-foreground opacity-60 hover:bg-muted hover:opacity-100" aria-label={asTable ? "Show chart" : "Show as table"} title={asTable ? "Show chart" : "Show as table"}>
          {asTable ? <BarChart3 className="size-4" /> : <Table2 className="size-4" />}
        </button>
      </HeaderAction>
      {asTable ? <DataTable data={data} lang={lang} /> : children}
    </div>
  );
}

function useGrouped(widget: WidgetOf<"barChart"> | WidgetOf<"pieChart">) {
  const { workspace, config } = useEnv();
  return useMemo(() => {
    const source = getSource(config, widget.source);
    if (!source) return [];
    let rows = applyFilter(getRows(workspace, widget.source), widget.filter);
    if ("dateRange" in widget) rows = applyDateRange(rows, widget.dateRange, source.kind === "worklogs" ? "date" : "createdAt");
    const field = source.fields.find((f) => f.id === widget.groupBy);
    return groupRows(config, rows, field, widget.aggregate, widget.valueField, "dateBucket" in widget ? widget.dateBucket : undefined, widget.source);
  }, [workspace, config, widget]);
}

export function BarChartWidget({ widget }: { widget: WidgetOf<"barChart"> }) {
  const { config } = useEnv();
  const data = useGrouped(widget);
  return (
    <ChartShell data={data} lang={config.language}>
      <div className="h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
            <XAxis dataKey="label" {...axisProps} interval={0} tickFormatter={(v: string) => (v.length > 12 ? v.slice(0, 11) + "…" : v)} />
            <YAxis {...axisProps} allowDecimals={false} width={44} />
            <Tooltip cursor={{ fill: "var(--muted)" }} content={<ChartTooltip lang={config.language} />} />
            <Bar dataKey="value" fill={SERIES[0]} radius={[4, 4, 0, 0]} maxBarSize={32} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartShell>
  );
}

export function LineChartWidget({ widget }: { widget: WidgetOf<"lineChart"> }) {
  const { workspace, config } = useEnv();
  const data = useMemo(() => {
    const rows = applyFilter(getRows(workspace, widget.source), widget.filter);
    const buckets = lastBuckets(widget.dateBucket, widget.periods ?? (widget.dateBucket === "day" ? 14 : widget.dateBucket === "week" ? 8 : 6));
    const groups = new Map<string, typeof rows>(buckets.map((b) => [b, []]));
    for (const r of rows) {
      const k = bucketKey(String(r[widget.dateField] ?? ""), widget.dateBucket);
      groups.get(k)?.push(r);
    }
    return buckets.map<Datum>((b) => ({ key: b, label: formatBucket(b, widget.dateBucket), value: aggregate(groups.get(b)!, widget.aggregate, widget.valueField) }));
  }, [workspace, widget]);
  return (
    <ChartShell data={data} lang={config.language}>
      <div className="h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 12, left: -18, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
            <XAxis dataKey="label" {...axisProps} minTickGap={16} />
            <YAxis {...axisProps} allowDecimals={false} width={44} />
            <Tooltip cursor={{ stroke: "var(--chart-axis)", strokeDasharray: "3 3" }} content={<ChartTooltip lang={config.language} />} />
            <Line type="linear" dataKey="value" stroke={SERIES[0]} strokeWidth={2} dot={{ r: 3, strokeWidth: 0, fill: SERIES[0] }} activeDot={{ r: 5, stroke: "var(--card)", strokeWidth: 2 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </ChartShell>
  );
}

export function PieChartWidget({ widget }: { widget: WidgetOf<"pieChart"> }) {
  const { config } = useEnv();
  const raw = useGrouped(widget);
  const data = useMemo(() => {
    const sorted = raw.filter((d) => d.value > 0);
    if (sorted.length <= 8) return sorted;
    const head = sorted.slice(0, 7);
    const rest = sorted.slice(7).reduce((s, d) => s + d.value, 0);
    return [...head, { key: "__other", label: config.language === "bn" ? "অন্যান্য" : "Other", value: rest }];
  }, [raw, config.language]);
  const total = data.reduce((s, d) => s + d.value, 0);
  return (
    <ChartShell data={data} lang={config.language}>
      {/* side by side only when the card itself is wide enough, so legend labels never get cut to "In …" */}
      <div className="@container">
      <div className="flex flex-col items-center gap-3 @xs:flex-row">
        <div className="size-36 shrink-0 @sm:size-44">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data} dataKey="value" nameKey="label" innerRadius="58%" outerRadius="95%" paddingAngle={1} stroke="var(--card)" strokeWidth={2} isAnimationActive={false}>
                {data.map((d, i) => (
                  <Cell key={d.key} fill={d.key === "__other" ? OTHER : SERIES[i % 8]} />
                ))}
              </Pie>
              <Tooltip content={<ChartTooltip lang={config.language} />} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <ul className="w-full min-w-0 space-y-1.5 text-xs">
          {data.map((d, i) => (
            <li key={d.key} className="flex items-center gap-2">
              <span className="size-2.5 shrink-0 rounded-sm" style={{ background: d.key === "__other" ? OTHER : SERIES[i % 8] }} />
              <span className="min-w-0 flex-1 truncate text-muted-foreground">{d.label}</span>
              <span className="font-medium tabular-nums">{formatNumber(d.value, config.language)}</span>
              <span className="w-9 text-right tabular-nums text-muted-foreground">{total ? Math.round((d.value / total) * 100) : 0}%</span>
            </li>
          ))}
        </ul>
      </div>
      </div>
    </ChartShell>
  );
}
