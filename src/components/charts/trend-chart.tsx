"use client";

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { AXIS_TICK, ChartFrame, LegendKey, TooltipCard, type ChartColumn } from "./chart-frame";
import type { Series } from "./column-chart";

type Row = Record<string, string | number>;

/** Change over time: 2px lines, crosshair tooltip listing every series. */
export function TrendChart({
  title,
  description,
  data,
  xKey,
  series,
  height = 240,
  className,
}: {
  title: string;
  description?: string;
  data: Row[];
  xKey: string;
  series: Series[];
  height?: number;
  className?: string;
}) {
  const columns: ChartColumn<Row>[] = [{ key: xKey, label: "Period" }, ...series.map((s) => ({ key: s.key, label: s.label, align: "right" as const }))];

  return (
    <ChartFrame
      title={title}
      description={description}
      data={data}
      columns={columns}
      className={className}
      legend={series.length > 1 ? series.map((s) => <LegendKey key={s.key} color={s.color} label={s.label} shape="line" />) : undefined}
    >
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
            <XAxis dataKey={xKey} tick={AXIS_TICK} tickLine={false} axisLine={false} tickMargin={8} interval="preserveStartEnd" />
            <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} width={28} allowDecimals={false} />
            <Tooltip
              cursor={{ stroke: "var(--border-strong)", strokeWidth: 1 }}
              content={({ active, payload, label }) =>
                active && payload?.length ? (
                  <TooltipCard
                    title={String(label)}
                    rows={series.map((s) => ({
                      label: s.label,
                      color: s.color,
                      value: String(payload.find((p) => p.dataKey === s.key)?.value ?? 0),
                    }))}
                  />
                ) : null
              }
            />
            {series.map((s) => (
              <Line
                key={s.key}
                type="monotone"
                dataKey={s.key}
                name={s.label}
                stroke={s.color}
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                dot={false}
                activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--card)" }}
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </ChartFrame>
  );
}
