// Variant D — smart cells with delta. One row per game. Each stat cell shows
// `team / opp` stacked, with a small delta below colored green/red.
// Same column count as the player table, denser cells.

import type { TeamGameRow } from "@/lib/queries";
import { formatGameDate } from "@/lib/format";

const COLUMN_GROUPS: { label: string; cols: string[] }[] = [
  { label: "Identity", cols: ["team", "game_num", "season_type", "date", "opp", "loc", "wl"] },
  { label: "Score",    cols: ["pts"] },
  { label: "Volume",   cols: ["poss"] },
  { label: "Shooting", cols: ["fg_pct"] },
  { label: "3PT",      cols: ["fg3_pct", "fg3m"] },
  { label: "FT",       cols: ["ft_pct", "fta"] },
  { label: "Boards",   cols: ["reb", "oreb"] },
  { label: "Assists",  cols: ["ast"] },
  { label: "Turnovers", cols: ["tov"] },
  { label: "Defense",  cols: ["stl", "blk"] },
  { label: "Fouls",    cols: ["pf"] },
];

const LABELS: Record<string, string> = {
  team: "", game_num: "#", season_type: "Type", date: "Date", opp: "Opp", loc: "@", wl: "W/L",
  pts: "PTS", poss: "POSS", fg_pct: "FG%",
  fg3_pct: "3P%", fg3m: "3PM",
  ft_pct: "FT%", fta: "FTA",
  reb: "REB", oreb: "ORB",
  ast: "AST", tov: "TOV",
  stl: "STL", blk: "BLK",
  pf: "PF",
};

const STYPE_SHORT: Record<string, string> = {
  "Regular Season": "REG",
  "Play In": "PI",
  "Playoffs": "PLAYOFFS",
};

const PCT_COLS = new Set(["fg_pct", "fg3_pct", "ft_pct"]);
const LOWER_BETTER = new Set(["tov", "pf"]);

function fmtVal(col: string, value: number | null | undefined): string {
  if (value == null) return "—";
  if (PCT_COLS.has(col)) return value.toFixed(1);
  return Math.round(value).toString();
}

function deltaColor(diff: number, lowerBetter: boolean): string {
  if (Math.abs(diff) < 0.05) return "#a1a1aa";
  const good = (diff > 0 && !lowerBetter) || (diff < 0 && lowerBetter);
  return good ? "#16a34a" : "#dc2626";
}

export default function TeamGameLogTableD({
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

  const groupEndCols = new Set<string>(
    COLUMN_GROUPS.map((g) => g.cols[g.cols.length - 1]),
  );

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
          {sortedRows.map((row) => {
            return (
              <tr key={row.game_id}>
                {COLUMN_GROUPS.flatMap((g) =>
                  g.cols.map((col) => {
                    if (col === "team") {
                      return <td key={col} className="left team">{teamAbbr}</td>;
                    }
                    if (col === "game_num") return <td key={col} className="left">{row.game_num}</td>;
                    if (col === "season_type") {
                      return (
                        <td
                          key={col}
                          className={`left ${row.season_type === "Playoffs" ? "type-playoff" : "type-reg"}`}
                        >
                          {STYPE_SHORT[row.season_type] ?? row.season_type}
                        </td>
                      );
                    }
                    if (col === "date") return <td key={col} className="left">{formatGameDate(row.date)}</td>;
                    if (col === "opp")  return <td key={col} className="left opp">{row.opp}</td>;
                    if (col === "loc")  return <td key={col} className="left">{row.loc === "H" ? "vs" : "@"}</td>;
                    if (col === "wl") {
                      return (
                        <td key={col} className={row.wl === "W" ? "wl-w" : "wl-l"}>
                          {row.wl} {row.pts}-{row.opp_pts}
                        </td>
                      );
                    }
                    // Smart delta cells
                    let teamVal: number | null = null;
                    let oppVal: number | null = null;
                    if (col === "pts")     { teamVal = row.pts;       oppVal = row.opp_pts; }
                    else if (col === "poss")    { teamVal = row.poss;      oppVal = row.opp_poss; }
                    else if (col === "fg_pct")  { teamVal = row.fg_pct;    oppVal = row.opp_fg_pct; }
                    else if (col === "fg3_pct") { teamVal = row.fg3_pct;   oppVal = row.opp_fg3_pct; }
                    else if (col === "fg3m")    { teamVal = row.fg3m;      oppVal = row.opp_fg3m; }
                    else if (col === "ft_pct")  { teamVal = row.ft_pct;    oppVal = row.opp_ft_pct; }
                    else if (col === "fta")     { teamVal = row.fta;       oppVal = row.opp_fta; }
                    else if (col === "reb")     { teamVal = row.reb;       oppVal = row.opp_reb; }
                    else if (col === "oreb")    { teamVal = row.oreb;      oppVal = row.opp_oreb; }
                    else if (col === "ast")     { teamVal = row.ast;       oppVal = row.opp_ast; }
                    else if (col === "tov")     { teamVal = row.tov;       oppVal = row.opp_tov; }
                    else if (col === "stl")     { teamVal = row.stl;       oppVal = row.opp_stl; }
                    else if (col === "blk")     { teamVal = row.blk;       oppVal = row.opp_blk; }
                    else if (col === "pf")      { teamVal = row.pf;        oppVal = row.opp_pf; }

                    return (
                      <td
                        key={col}
                        className={groupEndCols.has(col) ? "group-end" : undefined}
                        style={{ padding: 0 }}
                      >
                        <DeltaCellInline col={col} team={teamVal} opp={oppVal} />
                      </td>
                    );
                  }),
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function DeltaCellInline({ col, team, opp }: { col: string; team: number | null; opp: number | null }) {
  if (team == null || opp == null) {
    return <div style={{ padding: "4px 8px", color: "#a1a1aa" }}>—</div>;
  }
  const diff = team - opp;
  const lower = LOWER_BETTER.has(col);
  const color = deltaColor(diff, lower);
  const sign = diff > 0 ? "+" : "";
  const formatted = PCT_COLS.has(col)
    ? `${sign}${diff.toFixed(1)}`
    : `${sign}${Math.round(diff)}`;
  return (
    <div style={{ padding: "4px 8px", lineHeight: 1.15 }}>
      <div style={{ fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>
        {fmtVal(col, team)}
      </div>
      <div
        style={{
          fontVariantNumeric: "tabular-nums",
          color: "#a1a1aa",
          fontSize: "0.66rem",
          fontWeight: 400,
        }}
      >
        vs {fmtVal(col, opp)}
      </div>
      <div
        style={{
          fontVariantNumeric: "tabular-nums",
          color,
          fontSize: "0.66rem",
          fontWeight: 600,
          marginTop: 1,
        }}
      >
        {formatted}
      </div>
    </div>
  );
}
