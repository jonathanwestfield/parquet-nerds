"use client";

import {
  Bar,
  BarChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type Props = {
  values: number[];
  label: string;
  height?: number;
  bins?: number;
};

function binValues(values: number[], bins: number) {
  if (!values.length) return [];
  const min = Math.floor(Math.min(...values));
  const max = Math.ceil(Math.max(...values));
  const span = Math.max(1, max - min);
  const binSize = Math.max(1, Math.ceil(span / bins));
  const start = Math.floor(min / binSize) * binSize;

  const result: { bin: string; mid: number; count: number }[] = [];
  for (let b = start; b <= max; b += binSize) {
    result.push({
      bin: binSize === 1 ? String(b) : `${b}-${b + binSize - 1}`,
      mid: b + (binSize - 1) / 2,
      count: 0,
    });
  }
  for (const v of values) {
    const idx = Math.min(
      result.length - 1,
      Math.floor((v - start) / binSize),
    );
    if (idx >= 0) result[idx].count += 1;
  }
  return result;
}

export default function DistributionChart({
  values,
  label,
  height = 220,
  bins = 16,
}: Props) {
  if (!values.length) return null;

  const data = binValues(values, bins);
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  const hi = Math.max(...values);
  const lo = Math.min(...values);

  return (
    <div className="nba-card p-3">
      <div className="flex items-baseline justify-between mb-2">
        <div className="nba-eyebrow">{label} distribution</div>
        <div className="text-[0.70rem] text-(--nba-subtle) font-mono">
          {values.length} games
        </div>
      </div>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} margin={{ top: 14, right: 8, bottom: 4, left: 0 }}>
          <XAxis
            dataKey="mid"
            stroke="#a1a1aa"
            fontSize={10}
            tickLine={false}
            axisLine={{ stroke: "#e4e4e7" }}
            type="number"
            domain={["dataMin", "dataMax"]}
          />
          <YAxis
            stroke="#a1a1aa"
            fontSize={10}
            tickLine={false}
            axisLine={false}
            width={28}
            allowDecimals={false}
          />
          <Tooltip
            cursor={{ fill: "rgba(0,0,0,0.04)" }}
            contentStyle={{
              background: "#ffffff",
              border: "1px solid #d4d4d8",
              borderRadius: 4,
              fontSize: 11,
              padding: "6px 10px",
            }}
            labelStyle={{ color: "#52525b", marginBottom: 4 }}
            formatter={((v: unknown) => [v as number, "games"]) as never}
            labelFormatter={(_, payload) => {
              const p = payload?.[0]?.payload as { bin?: string } | undefined;
              return `${label}: ${p?.bin ?? ""}`;
            }}
          />
          <ReferenceLine
            x={lo}
            stroke="#dc2626"
            strokeDasharray="3 3"
            label={{ value: `lo ${lo.toFixed(0)}`, fontSize: 9, fill: "#dc2626", position: "top" }}
          />
          <ReferenceLine
            x={avg}
            stroke="#52525b"
            strokeDasharray="3 3"
            label={{ value: `avg ${avg.toFixed(1)}`, fontSize: 9, fill: "#52525b", position: "top" }}
          />
          <ReferenceLine
            x={hi}
            stroke="#16a34a"
            strokeDasharray="3 3"
            label={{ value: `hi ${hi.toFixed(0)}`, fontSize: 9, fill: "#16a34a", position: "top" }}
          />
          <Bar dataKey="count" fill="#3b82f6" fillOpacity={0.4} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
