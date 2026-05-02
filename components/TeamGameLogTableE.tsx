// Variant E — Variant C (stacked rows) + soft color coding on the team row.
// Each stat cell on the TEAM row tints green / yellow / red based on whether
// the team beat / matched / lost the opponent in that stat for that game.
// Opponent row stays plain & faded.

import type { TeamGameRow } from "@/lib/queries";
import { fmt, fmtInt, formatGameDate } from "@/lib/format";

const COLUMN_GROUPS: { label: string; cols: string[] }[] = [
  { label: "Identity", cols: ["team", "game_num", "season_type", "date", "opp", "loc", "wl"] },
  { label: "Volume",   cols: ["pts", "poss"] },
  { label: "Shooting", cols: ["fgm", "fga", "fg_pct"] },
  { label: "3PT",      cols: ["fg3m", "fg3a", "fg3_pct"] },
  { label: "FT",       cols: ["ftm", "fta", "ft_pct"] },
  { label: "Boards",   cols: ["oreb", "dreb", "reb"] },
  { label: "Other",    cols: ["ast", "tov", "stl", "blk", "pf"] },
];

const LABELS: Record<string, string> = {
  team: "", game_num: "#", season_type: "Type", date: "Date", opp: "Opp", loc: "@", wl: "W/L",
  pts: "PTS", poss: "POSS",
  fgm: "M", fga: "A", fg_pct: "%",
  fg3m: "M", fg3a: "A", fg3_pct: "%",
  ftm: "M", fta: "A", ft_pct: "%",
  oreb: "ORB", dreb: "DRB", reb: "REB",
  ast: "AST", tov: "TOV", stl: "STL", blk: "BLK", pf: "PF",
};

const PCT_COLS = new Set(["fg_pct", "fg3_pct", "ft_pct"]);
const INT_COLS = new Set(["pts", "fgm", "fga", "fg3m", "fg3a", "ftm", "fta", "oreb", "dreb", "reb", "ast", "tov", "stl", "blk", "pf"]);
const LEFT_COLS = new Set(["team", "game_num", "season_type", "date", "opp", "loc"]);
// Stats where lower is better (so coloring flips)
const LOWER_BETTER = new Set(["tov", "pf"]);
// Stats that don't deserve coloring (volume metrics where bigger isn't necessarily better, e.g. attempts)
const NEUTRAL_COLORING = new Set(["fga", "fg3a", "fta", "poss"]);

const STYPE_SHORT: Record<string, string> = {
  "Regular Season": "REG",
  "Play In": "PI",
  "Playoffs": "PLAYOFFS",
};

function getStatValue(row: TeamGameRow, col: string, side: "team" | "opp"): number | null {
  if (side === "team") {
    const v = row[col as keyof TeamGameRow];
    return typeof v === "number" ? v : null;
  }
  const v = row[`opp_${col}` as keyof TeamGameRow];
  return typeof v === "number" ? v : null;
}

function fmtCell(col: string, value: number | null): string {
  if (value == null) return "";
  if (PCT_COLS.has(col)) return fmt(value, 1);
  if (INT_COLS.has(col)) return fmtInt(value);
  return String(value);
}

/**
 * Decide soft background tint for the team's stat cell based on team vs opp.
 *
 * Returns "" for identity / neutral / missing. Returns rgba bg for green / yellow / red.
 *
 * Threshold: within 5% relative (or 2 pct pts for percentages) → yellow.
 */
function teamCellTint(col: string, team: number | null, opp: number | null): string {
  if (team == null || opp == null) return "";
  if (NEUTRAL_COLORING.has(col)) return "";
  const diff = team - opp;
  const lower = LOWER_BETTER.has(col);
  // "close" threshold
  let isClose: boolean;
  if (PCT_COLS.has(col)) {
    isClose = Math.abs(diff) < 2;
  } else {
    const denom = Math.max(Math.abs(team), Math.abs(opp), 1);
    isClose = Math.abs(diff) / denom < 0.05;
  }
  if (isClose) return "background-color: rgba(234, 179, 8, 0.13);"; // soft yellow
  const better = (diff > 0 && !lower) || (diff < 0 && lower);
  return better
    ? "background-color: rgba(22, 163, 74, 0.13);"  // soft green
    : "background-color: rgba(220, 38, 38, 0.12);"; // soft red
}

function styleFromString(s: string): React.CSSProperties {
  if (!s) return {};
  const out: Record<string, string> = {};
  for (const decl of s.split(";")) {
    const trimmed = decl.trim();
    if (!trimmed) continue;
    const [k, ...rest] = trimmed.split(":");
    if (!k || !rest.length) continue;
    const camel = k.trim().replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    out[camel] = rest.join(":").trim();
  }
  return out as React.CSSProperties;
}

export default function TeamGameLogTableE({
  rows,
  teamAbbr,
}: {
  rows: TeamGameRow[];
  teamAbbr: string;
}) {
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

  return (
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
          {sortedRows.map((row, idx) => (
            <FragmentX key={row.game_id}>
              {/* Team's row — color-coded cells */}
              <tr style={{ borderTop: idx > 0 ? "1.5px solid #e4e4e7" : undefined }}>
                {COLUMN_GROUPS.flatMap((g) =>
                  g.cols.map((col) => {
                    const classes: string[] = [];
                    if (LEFT_COLS.has(col)) classes.push("left");
                    if (col === "team") classes.push("team");
                    else if (col === "wl") classes.push(row.wl === "W" ? "wl-w" : "wl-l");
                    else if (col === "season_type")
                      classes.push(row.season_type === "Playoffs" ? "type-playoff" : "type-reg");
                    if (groupEndCols.has(col)) classes.push("group-end");

                    let display: string;
                    let style: React.CSSProperties = {};
                    if (col === "team") {
                      display = teamAbbr;
                    } else if (col === "game_num") {
                      display = String(row.game_num);
                    } else if (col === "season_type") {
                      display = STYPE_SHORT[row.season_type] ?? row.season_type;
                    } else if (col === "date") {
                      display = formatGameDate(row.date);
                    } else if (col === "opp") {
                      display = row.opp;
                    } else if (col === "loc") {
                      display = row.loc === "H" ? "vs" : "@";
                    } else if (col === "wl") {
                      display = row.wl;
                    } else {
                      const tv = getStatValue(row, col, "team");
                      const ov = getStatValue(row, col, "opp");
                      display = fmtCell(col, tv);
                      const tint = teamCellTint(col, tv, ov);
                      if (tint) style = styleFromString(tint);
                    }

                    return (
                      <td key={col} className={classes.join(" ") || undefined} style={style}>
                        {display}
                      </td>
                    );
                  }),
                )}
              </tr>
              {/* Opponent row — faded, no coloring */}
              <tr style={{ background: "#fafaf7" }}>
                {COLUMN_GROUPS.flatMap((g) =>
                  g.cols.map((col) => {
                    const classes: string[] = ["dnp"];
                    if (LEFT_COLS.has(col)) classes.push("left");
                    if (groupEndCols.has(col)) classes.push("group-end");

                    let display: string;
                    if (col === "team") {
                      display = row.opp;
                    } else if (col === "loc") {
                      display = row.loc === "H" ? "@" : "vs";
                    } else if (col === "wl") {
                      display = row.wl === "W" ? "L" : "W";
                    } else if (LEFT_COLS.has(col) || col === "season_type") {
                      display = "";
                    } else {
                      const ov = getStatValue(row, col, "opp");
                      display = fmtCell(col, ov);
                    }

                    return (
                      <td
                        key={col}
                        className={classes.join(" ") || undefined}
                        style={{
                          color: "#a1a1aa",
                          fontWeight: 400,
                          fontSize: "0.74rem",
                        }}
                      >
                        {display}
                      </td>
                    );
                  }),
                )}
              </tr>
            </FragmentX>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FragmentX({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
