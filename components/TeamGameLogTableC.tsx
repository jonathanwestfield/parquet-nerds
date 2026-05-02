// Variant C — stacked rows. Each game = 2 rows.
// Top row = team's stats (full color). Bottom row = opp's stats (faded gray).
// Compact width, double height. Like a baseball line score.

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
const STYPE_SHORT: Record<string, string> = {
  "Regular Season": "REG",
  "Play In": "PI",
  "Playoffs": "PLAYOFFS",
};

function getValue(
  row: TeamGameRow,
  col: string,
  side: "team" | "opp",
): unknown {
  if (col === "team") return side === "team" ? row.opp /* their team — caller passes via teamAbbr below */ : row.opp;
  if (col === "season_type" || col === "date" || col === "loc" || col === "wl" || col === "game_num") {
    return side === "team" ? row[col as keyof TeamGameRow] : "";
  }
  if (col === "opp") return side === "team" ? row.opp : "";
  if (side === "team") return row[col as keyof TeamGameRow];
  // opp side
  const oppKey = `opp_${col}` as keyof TeamGameRow;
  return row[oppKey];
}

function fmtCell(col: string, value: unknown, side: "team" | "opp"): string {
  if (value == null || value === "") return "";
  if (col === "date") return formatGameDate(String(value));
  if (col === "season_type") {
    if (side === "opp") return "";
    return STYPE_SHORT[String(value)] ?? String(value);
  }
  if (PCT_COLS.has(col)) return fmt(Number(value), 1);
  if (INT_COLS.has(col)) return fmtInt(Number(value));
  return String(value);
}

export default function TeamGameLogTableC({
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

  // Sort: most recent first, playoffs above
  const sortOrder: Record<string, number> = { Playoffs: 3, "Play In": 2, "Regular Season": 1, "Pre Season": 0 };
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
              <th key={g.label} className="group" colSpan={g.cols.length}>{g.label}</th>
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
          {sortedRows.map((row, idx) => {
            return (
              <Fragment2 key={`${row.game_id}`}>
                {/* Their stats row */}
                <tr style={{ borderTop: idx > 0 ? "1.5px solid #e4e4e7" : undefined }}>
                  {COLUMN_GROUPS.flatMap((g) =>
                    g.cols.map((col) => {
                      const classes: string[] = [];
                      if (LEFT_COLS.has(col)) classes.push("left");
                      if (col === "team") classes.push("team");
                      else if (col === "wl") classes.push(row.wl === "W" ? "wl-w" : "wl-l");
                      else if (col === "season_type") classes.push(row.season_type === "Playoffs" ? "type-playoff" : "type-reg");
                      if (groupEndCols.has(col)) classes.push("group-end");

                      let display: string;
                      if (col === "team") {
                        display = teamAbbr;
                      } else {
                        display = fmtCell(col, getValue(row, col, "team"), "team");
                      }
                      return (
                        <td key={col} className={classes.join(" ") || undefined}>
                          {display}
                        </td>
                      );
                    }),
                  )}
                </tr>
                {/* Opponent stats row — faded */}
                <tr style={{ background: "#fafaf7" }}>
                  {COLUMN_GROUPS.flatMap((g) =>
                    g.cols.map((col) => {
                      const classes: string[] = ["dnp"]; // reuse muted styling
                      if (LEFT_COLS.has(col)) classes.push("left");
                      if (groupEndCols.has(col)) classes.push("group-end");

                      let display: string;
                      if (col === "team") {
                        display = row.opp;
                      } else if (col === "loc") {
                        // flip H/A for opp
                        display = row.loc === "H" ? "A" : "H";
                      } else if (col === "wl") {
                        display = row.wl === "W" ? "L" : "W";
                      } else if (LEFT_COLS.has(col)) {
                        // blank identity columns for opp row except team & loc
                        display = "";
                      } else {
                        display = fmtCell(col, getValue(row, col, "opp"), "opp");
                      }
                      // For opp WL cell, color it muted
                      const finalClasses = col === "wl" ? "dnp left" : classes.join(" ");
                      return (
                        <td
                          key={col}
                          className={finalClasses || undefined}
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
              </Fragment2>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// Tiny fragment helper — React.Fragment with key support inside flat lists
function Fragment2({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
