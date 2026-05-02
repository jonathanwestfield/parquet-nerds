"use client";

// Variant B — toggleable view (Offense / Defense / Differentials).
// One row per game. Same column layout in all 3 views; just the values & coloring swap.
// Full-cell color tint based on better/worse vs opponent.
// Darker borders between game rows for easy scanning.

import { useState } from "react";
import type { TeamGameRow } from "@/lib/queries";
import { fmt, fmtInt, fmtSigned, formatGameDate } from "@/lib/format";

type View = "offense" | "defense" | "diff";

const COLUMN_GROUPS: { label: string; cols: string[] }[] = [
  { label: "Identity", cols: ["team", "game_num", "season_type", "date", "opp", "loc", "wl"] },
  { label: "Volume",   cols: ["pts", "poss"] },
  { label: "Shooting", cols: ["fg_pct", "fg3_pct", "ft_pct"] },
  { label: "Boards",   cols: ["reb", "oreb"] },
  { label: "Other",    cols: ["ast", "tov", "stl", "blk", "pf"] },
];

const LABELS: Record<string, string> = {
  team: "", game_num: "#", season_type: "Type", date: "Date", opp: "Opp", loc: "@", wl: "W/L",
  pts: "PTS", poss: "POSS",
  fg_pct: "FG%", fg3_pct: "3P%", ft_pct: "FT%",
  reb: "REB", oreb: "ORB",
  ast: "AST", tov: "TOV", stl: "STL", blk: "BLK", pf: "PF",
};

const PCT_COLS  = new Set(["fg_pct", "fg3_pct", "ft_pct"]);
const LEFT_COLS = new Set(["team", "game_num", "season_type", "date", "opp", "loc"]);
// Lower is better
const LOWER_BETTER = new Set(["tov", "pf"]);
// Volume stats — no inherent good/bad coloring
const NEUTRAL_COLORING = new Set(["poss"]);

const STYPE_SHORT: Record<string, string> = {
  "Regular Season": "REG",
  "Play In": "PI",
  "Playoffs": "PLAYOFFS",
};

function getValue(row: TeamGameRow, col: string, side: "team" | "opp"): number | null {
  const key = (side === "team" ? col : `opp_${col}`) as keyof TeamGameRow;
  const v = row[key];
  return typeof v === "number" ? v : null;
}

function fmtVal(col: string, value: number | null): string {
  if (value == null) return "—";
  if (PCT_COLS.has(col)) return fmt(value, 1);
  return fmtInt(value);
}

/**
 * Decide cell tint based on team value vs opponent value.
 * For "offense" view: positive = team beat opp at this stat = green
 * For "defense" view: we're showing opp's value; colors flip — opp doing well = bad for us = red
 * For "diff" view: positive delta = good = green
 */
function tint(diff: number, lowerBetter: boolean, col: string, intensity: "soft" | "strong" = "soft"): React.CSSProperties {
  if (NEUTRAL_COLORING.has(col)) return {};
  // close threshold
  let isClose: boolean;
  if (PCT_COLS.has(col)) isClose = Math.abs(diff) < 2;
  else isClose = Math.abs(diff) < 1.5;

  const a = intensity === "strong" ? 0.22 : 0.13;
  if (isClose) return { backgroundColor: `rgba(234, 179, 8, ${a})` }; // yellow
  const better = (diff > 0 && !lowerBetter) || (diff < 0 && lowerBetter);
  return better
    ? { backgroundColor: `rgba(22, 163, 74, ${a})` }   // green
    : { backgroundColor: `rgba(220, 38, 38, ${a - 0.01})` }; // red
}

export default function TeamGameLogTableB({
  rows,
  teamAbbr,
}: {
  rows: TeamGameRow[];
  teamAbbr: string;
}) {
  const [view, setView] = useState<View>("diff");

  if (!rows.length) {
    return (
      <div className="nba-table-wrap">
        <p className="px-5 py-5 text-sm text-(--nba-subtle)">No games.</p>
      </div>
    );
  }

  const sortOrder: Record<string, number> = {
    Playoffs: 3, "Play In": 2, "Regular Season": 1, "Pre Season": 0,
  };
  const sortedRows = [...rows].sort((a, b) => {
    const oa = sortOrder[a.season_type] ?? 0;
    const ob = sortOrder[b.season_type] ?? 0;
    if (oa !== ob) return ob - oa;
    if (a.date !== b.date) return a.date < b.date ? 1 : -1;
    return (b.game_num ?? 0) - (a.game_num ?? 0);
  });

  const groupEndCols = new Set<string>(COLUMN_GROUPS.map((g) => g.cols[g.cols.length - 1]));

  const renderStatCell = (row: TeamGameRow, col: string) => {
    const team = getValue(row, col, "team");
    const opp  = getValue(row, col, "opp");
    if (team == null || opp == null) return { display: "—", style: {} as React.CSSProperties };

    const lower = LOWER_BETTER.has(col);
    const diff = team - opp;
    const isEnd = groupEndCols.has(col);

    let display: string;
    let style: React.CSSProperties = {};

    if (view === "offense") {
      display = fmtVal(col, team);
      style = tint(diff, lower, col, "soft");
    } else if (view === "defense") {
      // We're showing what opponent did against us. Color from a defensive lens:
      // higher opp score / opp FG% etc = bad for our defense = red.
      // So we negate the comparison: opp - team (if higher is normally better).
      // For LOWER_BETTER stats (TOV/PF): higher opp value = good defense (we forced them to TOV) = green.
      const defDiff = -diff; // flip perspective
      display = fmtVal(col, opp);
      style = tint(defDiff, lower, col, "soft");
    } else {
      // differentials view: show team - opp
      const formatted = PCT_COLS.has(col)
        ? `${diff >= 0 ? "+" : ""}${diff.toFixed(1)}`
        : fmtSigned(Math.round(diff));
      display = formatted;
      style = tint(diff, lower, col, "strong");
    }
    if (isEnd) style = { ...style, borderRight: "2px solid #a1a1aa" };
    return { display, style };
  };

  // Tab control
  const TABS: { key: View; label: string; desc: string }[] = [
    { key: "offense", label: "Offense", desc: "Their stats. Green = beat opp at this stat." },
    { key: "defense", label: "Defense", desc: "Opp's stats. Green = held opp below their norm." },
    { key: "diff",    label: "Differentials", desc: "Team − opp. Green = good." },
  ];

  return (
    <div>
      {/* Tabs */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 0,
          marginBottom: 6,
          borderBottom: "1px solid #d4d4d8",
        }}
      >
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setView(t.key)}
            style={{
              padding: "6px 14px",
              fontSize: 11.5,
              fontWeight: view === t.key ? 700 : 500,
              color: view === t.key ? "#18181b" : "#71717a",
              background: "transparent",
              border: "none",
              borderBottom: view === t.key ? "2px solid #18181b" : "2px solid transparent",
              marginBottom: -1,
              cursor: "pointer",
              letterSpacing: "0.04em",
            }}
          >
            {t.label}
          </button>
        ))}
        <div
          style={{
            marginLeft: "auto",
            fontSize: 10,
            color: "#71717a",
            fontStyle: "italic",
          }}
        >
          {TABS.find((t) => t.key === view)?.desc}
        </div>
      </div>

      <div className="nba-table-wrap">
        <table>
          <thead>
            <tr>
              {COLUMN_GROUPS.map((g) => (
                <th key={g.label} className="group" colSpan={g.cols.length}>
                  {g.label}
                </th>
              ))}
            </tr>
            <tr>
              {COLUMN_GROUPS.flatMap((g) =>
                g.cols.map((c) => (
                  <th key={c} className={groupEndCols.has(c) ? "group-end" : undefined}>
                    {LABELS[c] ?? c}
                  </th>
                )),
              )}
            </tr>
          </thead>
          <tbody>
            {sortedRows.map((row) => (
              <tr
                key={row.game_id}
                style={{
                  // Darker bottom border on every game row for easy scanning
                  borderBottom: "1.5px solid #c0c0c5",
                }}
              >
                {COLUMN_GROUPS.flatMap((g) =>
                  g.cols.map((col) => {
                    const isEnd = groupEndCols.has(col);
                    const baseClasses: string[] = [];
                    if (LEFT_COLS.has(col)) baseClasses.push("left");
                    if (col === "team") baseClasses.push("team");

                    // Identity cells
                    if (col === "team")        return <td key={col} className={baseClasses.join(" ")}>{teamAbbr}</td>;
                    if (col === "game_num")    return <td key={col} className={baseClasses.join(" ")}>{row.game_num}</td>;
                    if (col === "season_type") return <td key={col} className={`${baseClasses.join(" ")} ${row.season_type === "Playoffs" ? "type-playoff" : "type-reg"}`}>{STYPE_SHORT[row.season_type] ?? row.season_type}</td>;
                    if (col === "date")        return <td key={col} className={baseClasses.join(" ")}>{formatGameDate(row.date)}</td>;
                    if (col === "opp")         return <td key={col} className={`${baseClasses.join(" ")} opp`}>{row.opp}</td>;
                    if (col === "loc")         return <td key={col} className={baseClasses.join(" ")}>{row.loc === "H" ? "vs" : "@"}</td>;
                    if (col === "wl") {
                      return (
                        <td key={col} className={row.wl === "W" ? "wl-w" : "wl-l"}>
                          {row.wl} {row.pts}-{row.opp_pts}
                        </td>
                      );
                    }

                    const { display, style } = renderStatCell(row, col);
                    const cls = [...baseClasses, isEnd ? "group-end" : ""].filter(Boolean).join(" ");
                    return (
                      <td key={col} className={cls || undefined} style={style}>
                        {display}
                      </td>
                    );
                  }),
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
