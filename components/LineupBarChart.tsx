"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  ReferenceLine,
} from "recharts";

export type LineupChartRow = {
  label: string;
  mpg: number;
  plusMinus: number;
  games: number;
};

type Props = {
  data: LineupChartRow[];
  teamColor: string;
  height?: number;
};

export default function LineupBarChart({
  data,
  teamColor,
  height = 320,
}: Props) {
  if (!data.length) {
    return (
      <div className="text-sm text-(--nba-subtle)">No lineup data.</div>
    );
  }

  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer>
        <BarChart
          data={data}
          margin={{ top: 16, right: 16, bottom: 80, left: 8 }}
          barCategoryGap={6}
          barGap={2}
        >
          <CartesianGrid stroke="#f4f4f5" vertical={false} />
          <XAxis
            dataKey="label"
            stroke="#a1a1aa"
            fontSize={10}
            tickLine={false}
            axisLine={{ stroke: "#e4e4e7" }}
            interval={0}
            angle={-30}
            textAnchor="end"
            height={70}
          />
          <YAxis
            yAxisId="left"
            orientation="left"
            stroke="#a1a1aa"
            fontSize={10}
            tickLine={false}
            axisLine={false}
            width={42}
            label={{
              value: "MPG",
              angle: -90,
              position: "insideLeft",
              fontSize: 10,
              fill: "#71717a",
            }}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            stroke="#a1a1aa"
            fontSize={10}
            tickLine={false}
            axisLine={false}
            width={42}
            label={{
              value: "+/-",
              angle: 90,
              position: "insideRight",
              fontSize: 10,
              fill: "#71717a",
            }}
          />
          <Tooltip
            cursor={{ fill: "rgba(0,0,0,0.04)" }}
            contentStyle={{
              background: "#ffffff",
              border: "1px solid #d4d4d8",
              borderRadius: 4,
              fontSize: 11,
              padding: "6px 10px",
              boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
            }}
            formatter={(value: number, name: string) => {
              if (name === "mpg") return [`${value.toFixed(1)} min/game`, "MPG"];
              if (name === "plusMinus") return [`${value > 0 ? "+" : ""}${Math.round(value)}`, "Total +/-"];
              return [value, name];
            }}
            labelFormatter={(l) => l}
          />
          <ReferenceLine yAxisId="right" y={0} stroke="#a1a1aa" strokeWidth={1} />
          <Bar
            yAxisId="left"
            dataKey="mpg"
            fill={teamColor}
            fillOpacity={0.85}
            radius={[2, 2, 0, 0]}
          />
          <Bar
            yAxisId="right"
            dataKey="plusMinus"
            radius={[2, 2, 0, 0]}
          >
            {data.map((row, i) => (
              <Cell
                key={i}
                fill={row.plusMinus >= 0 ? "#16a34a" : "#dc2626"}
                fillOpacity={0.85}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
