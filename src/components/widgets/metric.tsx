"use client";
import type { WidgetOf } from "@/lib/config/types";
import { useEnv } from "@/components/dashboard/env";
import { getRows, getSource, defaultDateField } from "@/lib/engine/sources";
import { aggregate, applyDateRange, applyFilter } from "@/lib/engine/query";
import { formatNumber } from "@/lib/utils";
import { DOT_COLORS } from "@/components/ui/primitives";

export function MetricWidget({ widget }: { widget: WidgetOf<"metric"> }) {
  const { workspace, config, t } = useEnv();
  const source = getSource(config, widget.source);
  let rows = getRows(workspace, widget.source);
  rows = applyFilter(rows, widget.filter);
  if (source) rows = applyDateRange(rows, widget.dateRange, source.kind === "worklogs" ? "date" : "createdAt");
  void defaultDateField;
  const value = aggregate(rows, widget.aggregate, widget.field);
  const pct = widget.target ? Math.min(100, (value / widget.target) * 100) : null;
  const rangeLabel = widget.dateRange && widget.dateRange !== "all" ? t(widget.dateRange === "today" ? "today" : widget.dateRange === "week" ? "thisWeek" : "thisMonth") : null;
  return (
    <div className="flex h-full flex-col justify-between gap-2">
      <div className="flex items-baseline gap-2">
        <span className="text-3xl font-semibold tabular-nums tracking-tight">{formatNumber(value, config.language)}</span>
        {widget.target && (
          <span className="text-xs text-muted-foreground">
            / {formatNumber(widget.target, config.language)} {t("target")}
          </span>
        )}
      </div>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span className={`size-2 rounded-full ${DOT_COLORS[widget.color ?? "blue"]}`} />
        {source?.label}
        {rangeLabel && <span>· {rangeLabel}</span>}
      </div>
      {pct !== null && (
        <div className="h-1.5 overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-[var(--series-1)]" style={{ width: `${pct}%` }} />
        </div>
      )}
    </div>
  );
}
