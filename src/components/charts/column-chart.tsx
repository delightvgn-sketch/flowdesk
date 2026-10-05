"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { formatMoney } from "@/lib/money";

import { AXIS_TICK, ChartFrame, LegendKey, TooltipCard, type ChartColumn } from "./chart-frame";

export type Series = { key: string; label: string; color: string };
type Row = Record<string, string | number>;

const formatValue = (value: number, money: boolean) => (money ? formatMoney(value) : value.toLocaleString("en-KE"));

/** Vertical columns, one or more series grouped per category. */
export function ColumnChart({
  title,
  description,
  data,
  xKey,
  series,
  money = false,
  height = 240,
  className,
}: {
  title: string;
  description?: string;
  data: Row[];
  xKey: string;
  series: Series[];
  money?: boolean;
  height?: number;
  className?: string;
}) {
  const columns: ChartColumn<Row>[] = [
    { key: xKey, label: "Period" },
    ...series.map((s) => ({
      key: s.key,
      label: s.label,
      align: "right" as const,
      format: (v: Row[string]) => formatValue(Number(v), money),
    })),
  ];

  return (
    <ChartFrame
      title={title}
      description={description}
      data={data}
      columns={columns}
      className={className}
      legend={series.length > 1 ? series.map((s) => <LegendKey key={s.key} color={s.color} label={s.label} />) : undefined}
    >
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }} barGap={2} barCategoryGap="28%">
            <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
            <XAxis dataKey={xKey} tick={AXIS_TICK} tickLine={false} axisLine={false} tickMargin={8} interval="preserveStartEnd" />
            <YAxis
              tick={AXIS_TICK}
              tickLine={false}
              axisLine={false}
              width={money ? 64 : 32}
              allowDecimals={false}
              tickFormatter={(v: number) =>
                money ? formatMoney(v, { compact: true }).replace("KSh ", "") : v.toLocaleString("en-KE")
              }
            />
            <Tooltip
              cursor={{ fill: "var(--muted)", opacity: 0.6 }}
              content={({ active, payload, label }) =>
                active && payload?.length ? (
                  <TooltipCard
                    title={String(label)}
                    rows={series.map((s) => ({
                      label: s.label,
                      color: s.color,
                      value: formatValue(Number(payload.find((p) => p.dataKey === s.key)?.value ?? 0), money),
                    }))}
                  />
                ) : null
              }
            />
            {series.map((s) => (
              <Bar
                key={s.key}
                dataKey={s.key}
                name={s.label}
                fill={s.color}
                radius={[4, 4, 0, 0]}
                maxBarSize={24}
                isAnimationActive={false}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartFrame>
  );
}
