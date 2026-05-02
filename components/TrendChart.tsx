"use client";

import {
  Bar,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Cell,
} from "recharts";

const PLAYOFF_COLOR = "#b45309"; // amber-700 — matches the playoff badge in the table

type Point = {
  game: number;
  value: number;
  rolling: number;
  isHigh: boolean;
  isPlayoff: boolean;
};

type Props = {
  label: string;
  values: number[];
  rolling: number[];
  isPlayoff?: boolean[];
  color?: string;
  height?: number;
  rollingWindow?: number;
};

export default function TrendChart({
  label,
  values,
  rolling,
  isPlayoff,
  color = "#0f172a",
  height = 200,
  rollingWindow = 5,
}: Props) {
  if (!values.length) return null;

  // Average uses regular-season games only when playoff flags exist
  const regValues = isPlayoff
    ? values.filter((_, i) => !isPlayoff[i])
    : values;
  const regAvg =
    regValues.length > 0
      ? regValues.reduce((a, b) => a + b, 0) / regValues.length
      : 0;
  const hi = Math.max(...values);
  const hiIdx = values.indexOf(hi);
  const firstPlayoffIdx = isPlayoff ? isPlayoff.indexOf(true) : -1;

  const data: Point[] = values.map((v, i) => ({
    game: i + 1,
    value: v,
    rolling: rolling[i],
    isHigh: i === hiIdx,
    isPlayoff: isPlayoff?.[i] ?? false,
  }));

  return (
    <div className="nba-card p-3">
      <div className="flex items-baseline justify-between mb-2">
        <div className="nba-eyebrow">{label}</div>
        <div className="text-[0.70rem] text-(--nba-subtle) font-mono">
          reg avg <span className="text-(--nba-text) font-semibold">{regAvg.toFixed(1)}</span>
          <span className="mx-1.5 text-(--nba-border-2)">·</span>
          hi <span className="text-(--nba-good) font-semibold">{hi.toFixed(0)}</span>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart data={data} margin={{ top: 6, right: 8, bottom: 4, left: 0 }}>
          <XAxis
            dataKey="game"
            stroke="#a1a1aa"
            fontSize={10}
            tickLine={false}
            axisLine={{ stroke: "#e4e4e7" }}
            interval="preserveStartEnd"
          />
          <YAxis
            stroke="#a1a1aa"
            fontSize={10}
            tickLine={false}
            axisLine={false}
            width={28}
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
            labelStyle={{ color: "#52525b", marginBottom: 4 }}
            formatter={((v: unknown, name: unknown, item: { payload?: Point }) => {
              const num = Number(v);
              if (name === "value") {
                const stype = item.payload?.isPlayoff ? "Playoff" : "Game";
                return [num.toFixed(1), stype];
              }
              if (name === "rolling") return [num.toFixed(1), `${rollingWindow}-game avg`];
              return [num.toFixed(1), String(name ?? "")];
            }) as never}
            labelFormatter={(l) => `Game ${l}`}
          />
          <ReferenceLine
            y={regAvg}
            stroke="#a1a1aa"
            strokeDasharray="3 3"
            strokeWidth={1}
          />
          {firstPlayoffIdx > 0 && (
            <ReferenceLine
              x={firstPlayoffIdx + 1}
              stroke={PLAYOFF_COLOR}
              strokeDasharray="2 4"
              strokeWidth={1}
              label={{
                value: "playoffs",
                position: "insideTopRight",
                fontSize: 9,
                fill: PLAYOFF_COLOR,
                offset: 4,
              }}
            />
          )}
          <Bar dataKey="value" barSize={10}>
            {data.map((entry, i) => {
              const fill = entry.isHigh
                ? "#16a34a"
                : entry.isPlayoff
                ? PLAYOFF_COLOR
                : color;
              const opacity = entry.isHigh
                ? 0.40
                : entry.isPlayoff
                ? 0.55
                : 0.18;
              return <Cell key={i} fill={fill} fillOpacity={opacity} />;
            })}
          </Bar>
          <Line
            type="monotone"
            dataKey="rolling"
            stroke={color}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 3, strokeWidth: 0, fill: color }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
