"use client";

import {
  CartesianGrid,
  Label,
  LabelList,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
  Legend,
} from "recharts";

const LEAGUE_AVG = 113.5; // pts per 100 possessions — actual NBA 2025-26 average

export type ScatterPoint = {
  label: string;
  team: string;       // abbreviation, used for color + grouping
  off: number;        // pts per 100 poss (x)
  def: number;        // opp pts per 100 poss (y)
  minutes: number;    // total minutes played (used for bubble size)
  netRtg: number;     // off - def
};

type Props = {
  data: ScatterPoint[];
  teamColors: Record<string, string>;
  height?: number;
};

export default function LineupScatter({
  data,
  teamColors,
  height = 560,
}: Props) {
  if (!data.length) {
    return <div className="text-sm text-(--nba-subtle)">No lineup data.</div>;
  }

  const teams = Array.from(new Set(data.map((d) => d.team)));
  const byTeam = teams.map((t) => ({
    team: t,
    color: teamColors[t] ?? "#0f172a",
    points: data.filter((d) => d.team === t),
  }));

  // Domains — center the chart on the league avg ~110-115 ORtg / DRtg
  const allOff = data.map((d) => d.off);
  const allDef = data.map((d) => d.def);
  const xMin = Math.floor(Math.min(...allOff) - 5);
  const xMax = Math.ceil(Math.max(...allOff)  + 5);
  const yMin = Math.floor(Math.min(...allDef) - 5);
  const yMax = Math.ceil(Math.max(...allDef)  + 5);

  const minMin = Math.min(...data.map((d) => d.minutes));
  const maxMin = Math.max(...data.map((d) => d.minutes));

  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer>
        <ScatterChart margin={{ top: 16, right: 24, bottom: 50, left: 48 }}>
          <CartesianGrid stroke="#f4f4f5" />
          <XAxis
            type="number"
            dataKey="off"
            name="Off Rating"
            domain={[xMin, xMax]}
            stroke="#a1a1aa"
            fontSize={11}
            tickLine={false}
            axisLine={{ stroke: "#e4e4e7" }}
            label={{
              value: "Points per 100 possessions →",
              position: "insideBottom",
              offset: -10,
              fill: "#52525b",
              fontSize: 11,
            }}
          />
          <YAxis
            type="number"
            dataKey="def"
            name="Def Rating"
            domain={[yMin, yMax]}
            // Reverse: lower (better defense) at top
            reversed
            stroke="#a1a1aa"
            fontSize={11}
            tickLine={false}
            axisLine={false}
            label={{
              value: "← Points allowed per 100 possessions",
              angle: -90,
              position: "insideLeft",
              offset: 10,
              fill: "#52525b",
              fontSize: 11,
            }}
          />
          <ZAxis
            type="number"
            dataKey="minutes"
            name="Minutes"
            range={[40, 600]}
            domain={[minMin, maxMin]}
          />
          {/* Quadrant background tints. Y is reversed (lower = better defense),
              so visually:
                top-right  = good O + good D  (green)
                top-left   = bad  O + good D  (blue)
                bottom-right = good O + bad D (amber)
                bottom-left  = bad  O + bad D (red)         */}
          <ReferenceArea x1={LEAGUE_AVG} x2={xMax} y1={yMin} y2={LEAGUE_AVG} fill="#16a34a" fillOpacity={0.06} stroke="none">
            <Label value="Good O · Good D" position="insideTopRight" fontSize={10} fill="#15803d" offset={8} />
          </ReferenceArea>
          <ReferenceArea x1={xMin} x2={LEAGUE_AVG} y1={yMin} y2={LEAGUE_AVG} fill="#3b82f6" fillOpacity={0.05} stroke="none">
            <Label value="Bad O · Good D" position="insideTopLeft" fontSize={10} fill="#1d4ed8" offset={8} />
          </ReferenceArea>
          <ReferenceArea x1={LEAGUE_AVG} x2={xMax} y1={LEAGUE_AVG} y2={yMax} fill="#f59e0b" fillOpacity={0.05} stroke="none">
            <Label value="Good O · Bad D" position="insideBottomRight" fontSize={10} fill="#b45309" offset={8} />
          </ReferenceArea>
          <ReferenceArea x1={xMin} x2={LEAGUE_AVG} y1={LEAGUE_AVG} y2={yMax} fill="#dc2626" fillOpacity={0.05} stroke="none">
            <Label value="Bad O · Bad D" position="insideBottomLeft" fontSize={10} fill="#b91c1c" offset={8} />
          </ReferenceArea>
          {/* League-avg crosshairs (~115 / ~115) with labels */}
          <ReferenceLine x={LEAGUE_AVG} stroke="#a1a1aa" strokeDasharray="3 3" strokeWidth={1}>
            <Label value="league avg ≈ 115" position="top" fontSize={9} fill="#71717a" offset={2} />
          </ReferenceLine>
          <ReferenceLine y={LEAGUE_AVG} stroke="#a1a1aa" strokeDasharray="3 3" strokeWidth={1}>
            <Label value="league avg ≈ 115" position="insideRight" fontSize={9} fill="#71717a" offset={6} />
          </ReferenceLine>
          <Tooltip
            cursor={{ strokeDasharray: "3 3" }}
            contentStyle={{
              background: "#ffffff",
              border: "1px solid #d4d4d8",
              borderRadius: 4,
              fontSize: 11,
              padding: "8px 10px",
              boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
            }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const p = payload[0].payload as ScatterPoint;
              const color = teamColors[p.team] ?? "#0f172a";
              return (
                <div style={{ background: "#fff", border: "1px solid #d4d4d8", borderRadius: 4, padding: "8px 10px", fontSize: 11, boxShadow: "0 2px 8px rgba(0,0,0,0.08)" }}>
                  <div style={{ fontWeight: 700, color, marginBottom: 4 }}>
                    {p.team} · {p.minutes.toFixed(1)} min
                  </div>
                  <div style={{ color: "#18181b" }}>{p.label}</div>
                  <div style={{ marginTop: 6, fontVariantNumeric: "tabular-nums", color: "#52525b" }}>
                    Off: <b style={{ color: "#16a34a" }}>{p.off.toFixed(1)}</b>
                    <span style={{ margin: "0 6px", color: "#d4d4d8" }}>·</span>
                    Def: <b style={{ color: "#dc2626" }}>{p.def.toFixed(1)}</b>
                    <span style={{ margin: "0 6px", color: "#d4d4d8" }}>·</span>
                    Net: <b style={{ color: p.netRtg >= 0 ? "#16a34a" : "#dc2626" }}>
                      {p.netRtg > 0 ? "+" : ""}{p.netRtg.toFixed(1)}
                    </b>
                  </div>
                </div>
              );
            }}
          />
          <Legend
            verticalAlign="top"
            align="right"
            wrapperStyle={{ fontSize: 11, top: -8 }}
          />
          {byTeam.map((t) => (
            <Scatter
              key={t.team}
              name={t.team}
              data={t.points}
              fill={t.color}
              fillOpacity={0.55}
              stroke={t.color}
              strokeWidth={1}
            >
              <LabelList
                dataKey="label"
                position="top"
                offset={6}
                style={{
                  fontSize: 9,
                  fill: t.color,
                  fontWeight: 600,
                  paintOrder: "stroke",
                  stroke: "#ffffff",
                  strokeWidth: 3,
                  strokeLinejoin: "round",
                }}
                formatter={(v: React.ReactNode) =>
                  String(v).split(" / ").map((n) => n.slice(0, 4)).join(" ")
                }
              />
            </Scatter>
          ))}
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}
