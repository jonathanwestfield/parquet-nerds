"use client";

import {
  Bar,
  Cell,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type Play = {
  game_id: string;
  seconds_elapsed: number | null;
  // Stored as TEXT in SQLite — accept string|number|null and parse below.
  score_home: number | string | null;
  score_away: number | string | null;
};

function parseScore(s: number | string | null | undefined): number | null {
  if (s == null) return null;
  if (typeof s === "number") return Number.isFinite(s) ? s : null;
  if (s === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

type GameInfo = {
  game_id: string;
  game_date: string;
  is_home: 0 | 1;
  pts: number;
  opp_pts: number;
  wl: "W" | "L";
};

type Props = {
  teamAAbbr: string;
  teamBAbbr: string;
  teamAColor: string;
  teamBColor: string;
  games: GameInfo[];
  playsByGame: Map<string, Play[]>;
};

type MinutePoint = {
  minute: number;
  teamA: number | null;
  teamB: number | null;
  lead: number | null;
};

function buildMinuteSeries(plays: Play[], aIsHome: boolean, maxMinute: number): MinutePoint[] {
  const points: MinutePoint[] = [];
  let idx = 0;
  let curHome = 0;
  let curAway = 0;

  // Determine actual game length so we can null out minutes after the buzzer.
  let lastSec = 0;
  for (const p of plays) {
    if (p.seconds_elapsed != null && p.seconds_elapsed > lastSec) lastSec = p.seconds_elapsed;
  }
  const finalMinute = Math.max(48, Math.ceil(lastSec / 60));

  // Start at minute 1 — cumulative lines anchored at (0, 0) read as "falling to zero".
  for (let m = 1; m <= maxMinute; m++) {
    const targetSec = m * 60;
    while (idx < plays.length && (plays[idx].seconds_elapsed ?? 0) <= targetSec) {
      const p = plays[idx];
      const home = parseScore(p.score_home);
      const away = parseScore(p.score_away);
      if (home != null) curHome = home;
      if (away != null) curAway = away;
      idx++;
    }
    if (m > finalMinute) {
      points.push({ minute: m, teamA: null, teamB: null, lead: null });
      continue;
    }
    const teamA = aIsHome ? curHome : curAway;
    const teamB = aIsHome ? curAway : curHome;
    points.push({ minute: m, teamA, teamB, lead: teamA - teamB });
  }
  return points;
}

export default function GameFlowGrid({
  teamAAbbr,
  teamBAbbr,
  teamAColor,
  teamBColor,
  games,
  playsByGame,
}: Props) {
  // Detect missing PBP up front — a series can have boxscores ingested
  // but not plays, in which case rendering the grid produces flat zeros.
  const totalPlays = games.reduce((n, g) => n + (playsByGame.get(g.game_id)?.length ?? 0), 0);
  if (totalPlays === 0) {
    return (
      <div className="mb-6">
        <div className="flex items-baseline gap-3 mb-2">
          <div className="nba-eyebrow">Game flow — score by minute</div>
        </div>
        <div className="nba-card p-4 text-sm text-(--nba-muted)">
          Play-by-play not yet loaded for this series. Run{" "}
          <code className="text-(--nba-text)">scripts/refresh.py --season 2025-26 --season-type Playoffs</code>{" "}
          to fill it in (~5-10 min).
        </div>
      </div>
    );
  }

  // Shared x-domain so all 6 tiles align. Extend past 48 if any game went OT.
  const maxMinuteAcrossGames = games.reduce((mx, g) => {
    const plays = playsByGame.get(g.game_id) ?? [];
    let lastSec = 0;
    for (const p of plays) {
      if (p.seconds_elapsed != null && p.seconds_elapsed > lastSec) lastSec = p.seconds_elapsed;
    }
    return Math.max(mx, Math.ceil(lastSec / 60));
  }, 48);

  // Shared y-axis caps so tiles read on the same scale.
  const maxScore = games.reduce((mx, g) => Math.max(mx, g.pts, g.opp_pts), 0);
  const scoreCap = Math.ceil((maxScore + 5) / 10) * 10;

  // Pre-compute per-game series so we can derive a shared lead-axis bound.
  const seriesByGame = games.map((g) => ({
    g,
    data: buildMinuteSeries(playsByGame.get(g.game_id) ?? [], g.is_home === 1, maxMinuteAcrossGames),
  }));
  const maxAbsLead = Math.max(
    6,
    ...seriesByGame.flatMap(({ data }) => data.map((d) => (d.lead == null ? 0 : Math.abs(d.lead)))),
  );
  const leadCap = Math.ceil(maxAbsLead / 5) * 5;
  const xTicks = maxMinuteAcrossGames > 48 ? [0, 12, 24, 36, 48, maxMinuteAcrossGames] : [0, 12, 24, 36, 48];

  const tiles = seriesByGame.map(({ g, data }, i) => {
    const winColor = g.wl === "W" ? teamAColor : teamBColor;

    return (
      <div key={g.game_id} className="nba-card p-3">
        <div className="flex items-baseline justify-between mb-1">
          <div className="nba-eyebrow" style={{ color: winColor }}>
            G{i + 1} · {g.game_date}
          </div>
          <div className="text-[11px] tabular-nums">
            <span style={{ color: teamAColor, fontWeight: 600 }}>
              {teamAAbbr} {g.pts}
            </span>
            <span className="mx-1 text-(--nba-subtle)">—</span>
            <span style={{ color: teamBColor, fontWeight: 600 }}>
              {teamBAbbr} {g.opp_pts}
            </span>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={190}>
          <ComposedChart data={data} margin={{ top: 6, right: 4, left: 0, bottom: 4 }}>
            <XAxis
              dataKey="minute"
              type="number"
              domain={[0, maxMinuteAcrossGames]}
              ticks={xTicks}
              tick={{ fontSize: 10, fill: "#71717a" }}
              tickLine={false}
              axisLine={{ stroke: "#e4e4e7" }}
            />
            <YAxis
              yAxisId="score"
              domain={[0, scoreCap]}
              tick={{ fontSize: 10, fill: "#71717a" }}
              tickLine={false}
              axisLine={false}
              width={26}
            />
            <YAxis
              yAxisId="lead"
              orientation="right"
              domain={[-leadCap, leadCap]}
              tick={{ fontSize: 10, fill: "#a1a1aa" }}
              tickLine={false}
              axisLine={false}
              width={22}
            />
            <ReferenceLine yAxisId="lead" y={0} stroke="#d4d4d8" />
            {[12, 24, 36].map((q) => (
              <ReferenceLine
                key={q}
                yAxisId="score"
                x={q}
                stroke="#a1a1aa"
                strokeDasharray="2 3"
                strokeWidth={1}
              />
            ))}
            <Bar yAxisId="lead" dataKey="lead" isAnimationActive={false}>
              {data.map((d, di) => (
                <Cell
                  key={di}
                  fill={d.lead != null && d.lead < 0 ? teamBColor : teamAColor}
                  fillOpacity={0.28}
                />
              ))}
            </Bar>
            <Line
              yAxisId="score"
              type="monotone"
              dataKey="teamA"
              stroke={teamAColor}
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
              connectNulls={false}
            />
            <Line
              yAxisId="score"
              type="monotone"
              dataKey="teamB"
              stroke={teamBColor}
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
              connectNulls={false}
            />
            <Tooltip
              cursor={{ stroke: "#a1a1aa", strokeDasharray: "2 2" }}
              contentStyle={{
                background: "#ffffff",
                border: "1px solid #d4d4d8",
                borderRadius: 4,
                fontSize: 11,
                padding: "6px 10px",
                boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
              }}
              labelFormatter={(m) => `Minute ${m}`}
              formatter={((v: unknown, name: unknown) => {
                if (v == null) return ["—", String(name ?? "")];
                if (name === "teamA") return [v as number, teamAAbbr];
                if (name === "teamB") return [v as number, teamBAbbr];
                if (name === "lead") {
                  const n = Number(v);
                  if (n === 0) return ["tied", "Lead"];
                  return [n > 0 ? `+${n} ${teamAAbbr}` : `+${-n} ${teamBAbbr}`, "Lead"];
                }
                return [v as number | string, String(name ?? "")];
              }) as never}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    );
  });

  return (
    <div className="mb-6">
      <div className="flex items-baseline gap-3 mb-2">
        <div className="nba-eyebrow">Game flow — score by minute</div>
        <div className="text-[10px] text-(--nba-muted)">
          Lines: cumulative score (left axis).
          Bars: running lead (right axis) —{" "}
          <span style={{ color: teamAColor, fontWeight: 600 }}>{teamAAbbr}</span>
          {" "}up,{" "}
          <span style={{ color: teamBColor, fontWeight: 600 }}>{teamBAbbr}</span>
          {" "}down.
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">{tiles}</div>
    </div>
  );
}
