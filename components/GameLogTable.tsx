import type { GameLogRow } from "@/lib/queries";
import { fmt, fmtInt, fmtSigned, formatGameDate } from "@/lib/format";

type ColumnKey =
  | "team" | "game_num" | "season_type" | "date" | "opp" | "loc"
  | "min" | "pts" | "reb" | "ast"
  | "fgm" | "fga" | "fg_pct"
  | "fg2m" | "fg2a" | "fg2_pct"
  | "fg3m" | "fg3a" | "fg3_pct"
  | "ftm" | "fta" | "ft_pct"
  | "dreb" | "oreb" | "tov"
  | "stl" | "blk" | "stocks"
  | "plus_minus" | "team_wl" | "pf";

const COLUMN_GROUPS: { label: string; cols: ColumnKey[] }[] = [
  { label: "Identity", cols: ["team", "game_num", "season_type", "date", "opp", "loc"] },
  { label: "Basic",    cols: ["min", "pts", "reb", "ast"] },
  { label: "Shooting", cols: ["fgm", "fga", "fg_pct"] },
  { label: "2PT",      cols: ["fg2m", "fg2a", "fg2_pct"] },
  { label: "3PT",      cols: ["fg3m", "fg3a", "fg3_pct"] },
  { label: "FT",       cols: ["ftm", "fta", "ft_pct"] },
  { label: "Boards",   cols: ["dreb", "oreb"] },
  { label: "TOV",      cols: ["tov"] },
  { label: "Defense",  cols: ["stl", "blk", "stocks"] },
  { label: "Result",   cols: ["plus_minus", "team_wl", "pf"] },
];

const LABELS: Record<ColumnKey, string> = {
  team: "Team", game_num: "#", season_type: "Type", date: "Date", opp: "Opp", loc: "@",
  min: "MIN", pts: "PTS", reb: "REB", ast: "AST",
  fgm: "M", fga: "A", fg_pct: "%",
  fg2m: "M", fg2a: "A", fg2_pct: "%",
  fg3m: "M", fg3a: "A", fg3_pct: "%",
  ftm: "M", fta: "A", ft_pct: "%",
  dreb: "DRB", oreb: "ORB",
  tov: "TOV", stl: "STL", blk: "BLK", stocks: "STK",
  plus_minus: "+/-", team_wl: "W/L", pf: "PF",
};

const DECIMAL_COLS = new Set<ColumnKey>(["min", "fg_pct", "fg2_pct", "fg3_pct", "ft_pct"]);
const INT_COLS = new Set<ColumnKey>([
  "pts", "reb", "ast", "fgm", "fga", "fg2m", "fg2a",
  "fg3m", "fg3a", "ftm", "fta", "dreb", "oreb",
  "tov", "stl", "blk", "stocks", "pf",
]);
const LEFT_COLS = new Set<ColumnKey>(["team", "game_num", "season_type", "date", "opp", "loc"]);

const HEATMAP_RANGES: Partial<Record<ColumnKey, [number, number, "fwd" | "rev" | "div"]>> = {
  fg_pct:     [30, 60, "fwd"],
  fg2_pct:    [35, 70, "fwd"],
  fg3_pct:    [20, 50, "fwd"],
  ft_pct:     [50, 100, "fwd"],
  plus_minus: [-25, 25, "div"],
};

const BAR_COLS = new Set<ColumnKey>(["pts", "reb", "ast", "dreb", "oreb", "tov"]);

const BAR_COLOR: Record<string, [number, number, number]> = {
  pts:  [220, 38, 38],
  reb:  [59, 130, 246],
  ast:  [22, 163, 74],
  dreb: [245, 158, 11],
  oreb: [245, 158, 11],
  tov:  [220, 38, 38],
};

function heatColor(value: number, vmin: number, vmax: number, mode: "fwd" | "rev" | "div", alpha = 0.22): string {
  let norm: number;
  if (mode === "div") {
    const span = Math.max(Math.abs(vmin), Math.abs(vmax));
    norm = (value + span) / (2 * span);
  } else {
    norm = vmax > vmin ? (value - vmin) / (vmax - vmin) : 0.5;
  }
  norm = Math.max(0, Math.min(1, norm));
  if (mode === "rev") norm = 1 - norm;

  let r: number, g: number, b: number;
  if (norm < 0.5) {
    r = 1.0;
    g = 0.55 + (norm / 0.5) * (0.85 - 0.55);
    b = 0.55;
  } else {
    r = 1.0 - ((norm - 0.5) / 0.5) * (1.0 - 0.45);
    g = 0.85 - ((norm - 0.5) / 0.5) * (0.85 - 0.75);
    b = 0.55 - ((norm - 0.5) / 0.5) * (0.55 - 0.45);
  }
  return `background-color: rgba(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)}, ${alpha});`;
}

function barFill(value: number, colMax: number, rgb: [number, number, number], alpha = 0.11): string {
  if (!colMax || colMax <= 0) return "";
  const pct = Math.max(0, Math.min(1, value / colMax)) * 100;
  const [r, g, b] = rgb;
  return `background-image: linear-gradient(to right, rgba(${r}, ${g}, ${b}, ${alpha}) ${pct.toFixed(1)}%, transparent ${pct.toFixed(1)}%);`;
}

function formatCell(col: ColumnKey, value: unknown): string {
  if (value == null) return "—";
  if (col === "date") return formatGameDate(String(value));
  if (col === "plus_minus") return fmtSigned(Number(value));
  if (DECIMAL_COLS.has(col)) return fmt(Number(value), 1);
  if (INT_COLS.has(col)) return fmtInt(Number(value));
  return String(value);
}

export type SummaryRow = {
  season_type: string;
  gp: number;
  wins: number;
  losses: number;
} & Partial<Record<ColumnKey, number | null>>;

function buildSummaryRows(played: GameLogRow[]): SummaryRow[] {
  const out: SummaryRow[] = [];
  const types = ["Regular Season", "Play In", "Playoffs"];
  for (const stype of types) {
    const games = played.filter((g) => g.season_type === stype);
    if (games.length === 0) continue;
    const wins = games.filter((g) => g.team_wl === "W").length;
    const losses = games.filter((g) => g.team_wl === "L").length;
    const mean = (col: ColumnKey): number | null => {
      const vals = games.map((g) => g[col]).filter((v): v is number => v != null);
      if (!vals.length) return null;
      return vals.reduce((a, b) => a + Number(b), 0) / vals.length;
    };
    const sumPct = (num: ColumnKey, den: ColumnKey): number | null => {
      let n = 0, d = 0;
      for (const g of games) {
        if (g[num] != null) n += Number(g[num]);
        if (g[den] != null) d += Number(g[den]);
      }
      return d > 0 ? (n / d) * 100 : null;
    };
    out.push({
      season_type: stype,
      gp: games.length,
      wins,
      losses,
      min: mean("min"), pts: mean("pts"), reb: mean("reb"), ast: mean("ast"),
      fgm: mean("fgm"), fga: mean("fga"), fg_pct: sumPct("fgm", "fga"),
      fg2m: mean("fg2m"), fg2a: mean("fg2a"), fg2_pct: sumPct("fg2m", "fg2a"),
      fg3m: mean("fg3m"), fg3a: mean("fg3a"), fg3_pct: sumPct("fg3m", "fg3a"),
      ftm: mean("ftm"), fta: mean("fta"), ft_pct: sumPct("ftm", "fta"),
      dreb: mean("dreb"), oreb: mean("oreb"),
      tov: mean("tov"), stl: mean("stl"), blk: mean("blk"), stocks: mean("stocks"),
      plus_minus: mean("plus_minus"), pf: mean("pf"),
    });
  }
  return out;
}

const STYPE_SHORT: Record<string, string> = {
  "Regular Season": "REG",
  "Play In": "PI",
  "Playoffs": "PLAYOFFS",
};

export default function GameLogTable({ rows }: { rows: GameLogRow[] }) {
  if (!rows.length) {
    return (
      <div className="nba-table-wrap">
        <p className="px-5 py-5 text-sm text-(--nba-subtle)">No games.</p>
      </div>
    );
  }

  // Sort: most recent first, playoffs above regular season (by season_type descending)
  const sortOrder: Record<string, number> = { Playoffs: 3, "Play In": 2, "Regular Season": 1, "Pre Season": 0 };
  const sortedRows = [...rows].sort((a, b) => {
    const oa = sortOrder[a.season_type] ?? 0;
    const ob = sortOrder[b.season_type] ?? 0;
    if (oa !== ob) return ob - oa;
    if (a.date !== b.date) return a.date < b.date ? 1 : -1;
    return (b.game_num ?? 0) - (a.game_num ?? 0);
  });

  const played = sortedRows.filter((r) => r.min != null);
  const summary = buildSummaryRows(played);

  // Bar scales (per stat, max across played games)
  const barMax: Partial<Record<ColumnKey, number>> = {};
  for (const col of BAR_COLS) {
    let m = 0;
    for (const r of played) {
      const v = r[col as keyof GameLogRow];
      if (typeof v === "number" && v > m) m = v;
    }
    barMax[col] = m;
  }
  // DREB / OREB share scale
  if (barMax.dreb != null && barMax.oreb != null) {
    const shared = Math.max(barMax.dreb, barMax.oreb);
    barMax.dreb = shared;
    barMax.oreb = shared;
  }

  const groupEndCols = new Set<ColumnKey>(COLUMN_GROUPS.map((g) => g.cols[g.cols.length - 1]));
  const totalCols = COLUMN_GROUPS.reduce((a, g) => a + g.cols.length, 0);

  // ---- Render ----
  const renderHeader = () => (
    <thead>
      <tr>
        {COLUMN_GROUPS.map((g) => (
          <th key={g.label} className="group" colSpan={g.cols.length}>{g.label}</th>
        ))}
      </tr>
      <tr>
        {COLUMN_GROUPS.flatMap((g) =>
          g.cols.map((c) => (
            <th key={c} className={groupEndCols.has(c) ? "group-end" : undefined}>{LABELS[c]}</th>
          )),
        )}
      </tr>
    </thead>
  );

  const renderSummaryRow = (s: SummaryRow, isLast: boolean) => {
    const isPlayoff = s.season_type === "Playoffs";
    const cells: React.ReactNode[] = [];
    for (const g of COLUMN_GROUPS) {
      for (const col of g.cols) {
        const isEnd = groupEndCols.has(col);
        const baseClass = isEnd ? "group-end" : "";
        if (col === "team") {
          const label = isPlayoff ? "PLAYOFFS" : s.season_type === "Play In" ? "PLAY-IN" : "REG";
          cells.push(
            <td key={col} className={`summary-pill ${isPlayoff ? "playoff" : ""} ${baseClass}`.trim()}>
              <span>{label}</span>
            </td>,
          );
        } else if (col === "game_num") {
          cells.push(<td key={col} className={`summary-blank ${baseClass}`.trim()}>{s.gp} GP</td>);
        } else if (col === "season_type" || col === "date" || col === "loc") {
          cells.push(<td key={col} className={`summary-blank ${baseClass}`.trim()}>{""}</td>);
        } else if (col === "opp") {
          cells.push(<td key={col} className={`summary-blank ${baseClass}`.trim()}>season</td>);
        } else if (col === "team_wl") {
          cells.push(<td key={col} className={`summary-record ${baseClass}`.trim()}>{`${s.wins}-${s.losses}`}</td>);
        } else {
          const val = s[col];
          let style: string | undefined;
          let formatted: string;
          if (val == null) {
            formatted = "—";
          } else if (col === "plus_minus") {
            formatted = fmtSigned(Number(val), 1);
          } else {
            formatted = Number(val).toFixed(1);
          }
          if (val != null && HEATMAP_RANGES[col]) {
            const [vmin, vmax, mode] = HEATMAP_RANGES[col]!;
            style = heatColor(Number(val), vmin, vmax, mode, 0.30);
          }
          cells.push(
            <td key={col} className={baseClass || undefined} style={style ? styleStringToObject(style) : undefined}>
              {formatted}
            </td>,
          );
        }
      }
    }
    return (
      <tr key={`sum-${s.season_type}`} className={`summary-row ${isLast ? "last" : ""}`.trim()}>
        {cells}
      </tr>
    );
  };

  const bodyRows: React.ReactNode[] = [];
  summary.forEach((s, i) => bodyRows.push(renderSummaryRow(s, i === summary.length - 1)));

  let prevStype: string | null = null;
  sortedRows.forEach((row, idx) => {
    if (row.season_type !== prevStype) {
      if (prevStype !== null) {
        const isPlayoff = row.season_type === "Playoffs";
        const label = row.season_type;
        bodyRows.push(
          <tr key={`sep-${idx}`} className={`stype-sep ${isPlayoff ? "playoff" : ""}`.trim()}>
            <td colSpan={totalCols}><span>{label}</span></td>
          </tr>,
        );
      }
      prevStype = row.season_type;
    }
    bodyRows.push(renderRow(row, idx, barMax, groupEndCols));
  });

  return (
    <div className="nba-table-wrap">
      <table>
        {renderHeader()}
        <tbody>{bodyRows}</tbody>
      </table>
    </div>
  );
}

function renderRow(
  row: GameLogRow,
  idx: number,
  barMax: Partial<Record<ColumnKey, number>>,
  groupEndCols: Set<ColumnKey>,
): React.ReactNode {
  const dnp = row.min == null;
  const cells: React.ReactNode[] = [];
  for (const g of COLUMN_GROUPS) {
    for (const col of g.cols) {
      const val = row[col as keyof GameLogRow];
      const classes: string[] = [];
      let style: React.CSSProperties | undefined;

      if (LEFT_COLS.has(col)) classes.push("left");
      if (col === "team") classes.push("team");
      else if (col === "opp") classes.push("opp");
      else if (col === "team_wl") {
        if (val === "W") classes.push("wl-w");
        else if (val === "L") classes.push("wl-l");
      } else if (col === "season_type") {
        classes.push(val === "Playoffs" ? "type-playoff" : "type-reg");
      } else if (dnp) classes.push("dnp");

      if (groupEndCols.has(col)) classes.push("group-end");

      // Heatmap
      if (!dnp && val != null && HEATMAP_RANGES[col]) {
        const [vmin, vmax, mode] = HEATMAP_RANGES[col]!;
        style = styleStringToObject(heatColor(Number(val), vmin, vmax, mode));
      } else if (!dnp && val != null && BAR_COLS.has(col)) {
        const cm = barMax[col];
        if (cm) {
          style = styleStringToObject(barFill(Number(val), cm, BAR_COLOR[col] ?? [59, 130, 246]));
        }
      }

      let display: string;
      if (col === "season_type") {
        display = STYPE_SHORT[String(val)] ?? String(val ?? "");
      } else {
        display = formatCell(col, val);
      }

      cells.push(
        <td key={col} className={classes.join(" ") || undefined} style={style}>
          {display}
        </td>,
      );
    }
  }
  return <tr key={`row-${idx}-${row.date}-${row.team}`}>{cells}</tr>;
}

function styleStringToObject(s: string): React.CSSProperties {
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
