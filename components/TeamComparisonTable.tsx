// Comprehensive team comparison table.
// One combined table with two team blocks (Celtics on top, Sixers below).
// Columns: Reg season avg | Last 20 reg avg | Series avg | G1 | G2 | ... | G6
// Rows grouped logically: Pace → Volume → Efficiency → Boards → Defense → Score

import type { TeamGameFullStats, TeamGamePbpDerived } from "@/lib/queries";

type GameInfo = { game_id: string; wl: "W" | "L"; pts: number; opp_pts: number };

type Team = {
  abbreviation: string;
  full_name: string;
  team_id: number;
  color: string;
  games: TeamGameFullStats[];        // every game this team played in the season (reg + playoffs)
  pbpStats: Map<string, TeamGamePbpDerived>; // by game_id, may be empty
  seriesGameInfo: GameInfo[];        // the series games + W/L scores
};

// ---------- Per-game derived stats ----------
type Derived = {
  poss: number; opp_poss: number;
  sec_per_poss: number; // 2880/poss approximation
  pts: number; opp_pts: number;
  fga: number; fgm: number; fg2a: number; fg2m: number; fg3a: number; fg3m: number;
  fta: number; ftm: number;
  rim_a: number | null; rim_m: number | null;
  short_a: number | null; short_m: number | null;
  long_a: number | null; long_m: number | null;
  corner3_a: number | null; corner3_m: number | null;
  atb3_a: number | null; atb3_m: number | null;
  ast: number; oreb: number; dreb: number; reb: number;
  opp_oreb: number; opp_dreb: number; opp_tov: number;
  stl: number; blk: number; tov: number; pf: number;
  pf_tech: number | null; pf_flag: number | null;
  // PBP-derived (null if PBP not ingested)
  max_lead: number | null;
  max_deficit: number | null;
  pct_time_leading: number | null;
  biggest_run_for: number | null;
  biggest_run_against: number | null;
  clutch_pts_for: number | null;
  clutch_pts_against: number | null;
  clutch_seconds: number | null;
};

function toDerived(g: TeamGameFullStats, pbp: Map<string, TeamGamePbpDerived>): Derived {
  const adv = pbp.get(g.game_id);
  return {
    poss: g.poss, opp_poss: g.opp_poss,
    sec_per_poss: g.poss > 0 ? (48 * 60) / g.poss : 0,
    pts: g.pts, opp_pts: g.opp_pts,
    fga: g.fga, fgm: g.fgm, fg2a: g.fg2a, fg2m: g.fg2m, fg3a: g.fg3a, fg3m: g.fg3m,
    fta: g.fta, ftm: g.ftm,
    rim_a: g.rim_a, rim_m: g.rim_m,
    short_a: g.short_a, short_m: g.short_m,
    long_a: g.long_a, long_m: g.long_m,
    corner3_a: g.corner3_a, corner3_m: g.corner3_m,
    atb3_a: g.atb3_a, atb3_m: g.atb3_m,
    ast: g.ast, oreb: g.oreb, dreb: g.dreb, reb: g.reb,
    opp_oreb: g.opp_oreb, opp_dreb: g.opp_dreb, opp_tov: g.opp_tov,
    stl: g.stl, blk: g.blk, tov: g.tov, pf: g.pf,
    pf_tech: g.pf_tech, pf_flag: g.pf_flag,
    max_lead: adv?.max_lead ?? null,
    max_deficit: adv?.max_deficit ?? null,
    pct_time_leading: adv?.pct_time_leading ?? null,
    biggest_run_for: adv?.biggest_run_for ?? null,
    biggest_run_against: adv?.biggest_run_against ?? null,
    clutch_pts_for: adv?.clutch_pts_for ?? null,
    clutch_pts_against: adv?.clutch_pts_against ?? null,
    clutch_seconds: adv?.clutch_seconds ?? null,
  };
}

// Extract value computer for a row, given an aggregate Derived.
type Row = {
  key: string;
  label: string;
  group: string;
  /** Higher value = better? false = lower is better, undefined = neutral (no coloring) */
  higherIsBetter?: boolean;
  /** Number of decimals to display */
  decimals: number;
  /** Suffix to append (e.g., '%') */
  suffix?: string;
  /** Draw a stronger horizontal border above this row (sub-section break within a group) */
  dividerAbove?: boolean;
  /** For % rows: function returning the underlying attempt volume in a window */
  volumeFn?: (games: Derived[]) => number;
  /** For % rows: minimum volume to be considered for the circle treatment */
  minVolume?: number;
  /** Compute the row's value from a window of games */
  compute: (games: Derived[]) => number | null;
};

const safeMean = (values: (number | null | undefined)[]): number | null => {
  const nums = values.filter((v): v is number => v != null && !Number.isNaN(v));
  if (!nums.length) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
};
const sum = (values: (number | null | undefined)[]): number => {
  return values.reduce<number>((a, b) => a + (typeof b === "number" && !Number.isNaN(b) ? b : 0), 0);
};
const ratio = (num: number, den: number): number | null => den > 0 ? (num / den) * 100 : null;

const ROWS: Row[] = [
  // ----- PACE -----
  { key: "poss", label: "Possessions", group: "Pace", decimals: 0, higherIsBetter: true,
    compute: (g) => safeMean(g.map((x) => x.poss)) },
  { key: "sec_per_poss", label: "Avg sec / possession", group: "Pace", decimals: 0, higherIsBetter: undefined,
    compute: (g) => safeMean(g.map((x) => x.sec_per_poss)) },

  // ----- OVERALL FIELD GOALS — attempts → made → % per shot type -----
  { key: "fga", label: "FG attempts", group: "Field goals — overall", decimals: 0, higherIsBetter: true,
    compute: (g) => safeMean(g.map((x) => x.fga)) },
  { key: "fgm", label: "FG made", group: "Field goals — overall", decimals: 0, higherIsBetter: true,
    compute: (g) => safeMean(g.map((x) => x.fgm)) },
  { key: "fg_pct", label: "FG %", group: "Field goals — overall", decimals: 0, suffix: "%", higherIsBetter: true,
    volumeFn: (g) => sum(g.map((x) => x.fga)), minVolume: 30,
    compute: (g) => ratio(sum(g.map((x) => x.fgm)), sum(g.map((x) => x.fga))) },
  { key: "fg2a", label: "2PT attempts", group: "Field goals — overall", decimals: 0, higherIsBetter: true,
    dividerAbove: true,
    compute: (g) => safeMean(g.map((x) => x.fg2a)) },
  { key: "fg2m", label: "2PT made", group: "Field goals — overall", decimals: 0, higherIsBetter: true,
    compute: (g) => safeMean(g.map((x) => x.fg2m)) },
  { key: "fg2_pct", label: "2PT %", group: "Field goals — overall", decimals: 0, suffix: "%", higherIsBetter: true,
    volumeFn: (g) => sum(g.map((x) => x.fg2a)), minVolume: 15,
    compute: (g) => ratio(sum(g.map((x) => x.fg2m)), sum(g.map((x) => x.fg2a))) },
  { key: "fg3a", label: "3PT attempts", group: "Field goals — overall", decimals: 0, higherIsBetter: true,
    dividerAbove: true,
    compute: (g) => safeMean(g.map((x) => x.fg3a)) },
  { key: "fg3m", label: "3PT made", group: "Field goals — overall", decimals: 0, higherIsBetter: true,
    compute: (g) => safeMean(g.map((x) => x.fg3m)) },
  { key: "fg3_pct", label: "3PT %", group: "Field goals — overall", decimals: 0, suffix: "%", higherIsBetter: true,
    volumeFn: (g) => sum(g.map((x) => x.fg3a)), minVolume: 15,
    compute: (g) => ratio(sum(g.map((x) => x.fg3m)), sum(g.map((x) => x.fg3a))) },

  // ----- 2PT BREAKDOWN — attempts → made → % per location -----
  { key: "rim_a", label: "Rim attempts (dunks + layups + tips)", group: "2PT shots — by location", decimals: 0, higherIsBetter: true,
    compute: (g) => safeMean(g.map((x) => x.rim_a)) },
  { key: "rim_m", label: "Rim made", group: "2PT shots — by location", decimals: 0, higherIsBetter: true,
    compute: (g) => safeMean(g.map((x) => x.rim_m)) },
  { key: "rim_pct", label: "Rim %", group: "2PT shots — by location", decimals: 0, suffix: "%", higherIsBetter: true,
    volumeFn: (g) => sum(g.map((x) => x.rim_a ?? 0)), minVolume: 8,
    compute: (g) => {
      const m = sum(g.map((x) => x.rim_m ?? 0));
      const a = sum(g.map((x) => x.rim_a ?? 0));
      return a > 0 ? (m / a) * 100 : null;
    } },
  { key: "short_a", label: "Mid-range attempts (<15ft, non-rim)", group: "2PT shots — by location", decimals: 0, higherIsBetter: true,
    dividerAbove: true,
    compute: (g) => safeMean(g.map((x) => x.short_a)) },
  { key: "short_m", label: "Mid-range made", group: "2PT shots — by location", decimals: 0, higherIsBetter: true,
    compute: (g) => safeMean(g.map((x) => x.short_m)) },
  { key: "short_pct", label: "Mid-range %", group: "2PT shots — by location", decimals: 0, suffix: "%", higherIsBetter: true,
    volumeFn: (g) => sum(g.map((x) => x.short_a ?? 0)), minVolume: 5,
    compute: (g) => {
      const m = sum(g.map((x) => x.short_m ?? 0));
      const a = sum(g.map((x) => x.short_a ?? 0));
      return a > 0 ? (m / a) * 100 : null;
    } },
  { key: "long_a", label: "Long mid attempts (15ft to 3pt line)", group: "2PT shots — by location", decimals: 0, higherIsBetter: true,
    dividerAbove: true,
    compute: (g) => safeMean(g.map((x) => x.long_a)) },
  { key: "long_m", label: "Long mid made", group: "2PT shots — by location", decimals: 0, higherIsBetter: true,
    compute: (g) => safeMean(g.map((x) => x.long_m)) },
  { key: "long_pct", label: "Long mid %", group: "2PT shots — by location", decimals: 0, suffix: "%", higherIsBetter: true,
    volumeFn: (g) => sum(g.map((x) => x.long_a ?? 0)), minVolume: 5,
    compute: (g) => {
      const m = sum(g.map((x) => x.long_m ?? 0));
      const a = sum(g.map((x) => x.long_a ?? 0));
      return a > 0 ? (m / a) * 100 : null;
    } },

  // ----- 3PT BREAKDOWN -----
  { key: "corner3_a", label: "Corner 3 attempts", group: "3PT shots — by location", decimals: 0, higherIsBetter: true,
    compute: (g) => safeMean(g.map((x) => x.corner3_a)) },
  { key: "corner3_m", label: "Corner 3 made", group: "3PT shots — by location", decimals: 0, higherIsBetter: true,
    compute: (g) => safeMean(g.map((x) => x.corner3_m)) },
  { key: "corner3_pct", label: "Corner 3 %", group: "3PT shots — by location", decimals: 0, suffix: "%", higherIsBetter: true,
    volumeFn: (g) => sum(g.map((x) => x.corner3_a ?? 0)), minVolume: 4,
    compute: (g) => {
      const m = sum(g.map((x) => x.corner3_m ?? 0));
      const a = sum(g.map((x) => x.corner3_a ?? 0));
      return a > 0 ? (m / a) * 100 : null;
    } },
  { key: "atb3_a", label: "Above-the-break 3 attempts", group: "3PT shots — by location", decimals: 0, higherIsBetter: true,
    dividerAbove: true,
    compute: (g) => safeMean(g.map((x) => x.atb3_a)) },
  { key: "atb3_m", label: "Above-the-break 3 made", group: "3PT shots — by location", decimals: 0, higherIsBetter: true,
    compute: (g) => safeMean(g.map((x) => x.atb3_m)) },
  { key: "atb3_pct", label: "Above-the-break 3 %", group: "3PT shots — by location", decimals: 0, suffix: "%", higherIsBetter: true,
    volumeFn: (g) => sum(g.map((x) => x.atb3_a ?? 0)), minVolume: 8,
    compute: (g) => {
      const m = sum(g.map((x) => x.atb3_m ?? 0));
      const a = sum(g.map((x) => x.atb3_a ?? 0));
      return a > 0 ? (m / a) * 100 : null;
    } },

  // ----- FREE THROWS -----
  { key: "fta", label: "FT attempts", group: "Free throws", decimals: 0, higherIsBetter: true,
    compute: (g) => safeMean(g.map((x) => x.fta)) },
  { key: "ftm", label: "FT made", group: "Free throws", decimals: 0, higherIsBetter: true,
    compute: (g) => safeMean(g.map((x) => x.ftm)) },
  { key: "ft_pct", label: "FT %", group: "Free throws", decimals: 0, suffix: "%", higherIsBetter: true,
    volumeFn: (g) => sum(g.map((x) => x.fta)), minVolume: 8,
    compute: (g) => ratio(sum(g.map((x) => x.ftm)), sum(g.map((x) => x.fta))) },

  // ----- TURNOVERS (offensive efficiency loss) -----
  { key: "tov", label: "Turnovers", group: "Ball security", decimals: 0, higherIsBetter: false,
    compute: (g) => safeMean(g.map((x) => x.tov)) },
  // ----- Playmaking & boards -----
  { key: "ast", label: "Assists", group: "Boards & Playmaking", decimals: 0, higherIsBetter: true,
    compute: (g) => safeMean(g.map((x) => x.ast)) },
  { key: "oreb", label: "Off rebounds", group: "Boards & Playmaking", decimals: 0, higherIsBetter: true,
    compute: (g) => safeMean(g.map((x) => x.oreb)) },
  { key: "dreb", label: "Def rebounds", group: "Boards & Playmaking", decimals: 0, higherIsBetter: true,
    compute: (g) => safeMean(g.map((x) => x.dreb)) },
  { key: "reb", label: "Total rebounds", group: "Boards & Playmaking", decimals: 0, higherIsBetter: true,
    compute: (g) => safeMean(g.map((x) => x.reb)) },
  { key: "oreb_pct", label: "OREB % (own miss → own board)", group: "Boards & Playmaking",
    decimals: 0, suffix: "%", higherIsBetter: true,
    dividerAbove: true,
    volumeFn: (g) => sum(g.map((x) => x.oreb + x.opp_dreb)), minVolume: 25,
    compute: (g) => {
      const o = sum(g.map((x) => x.oreb));
      const od = sum(g.map((x) => x.opp_dreb));
      return o + od > 0 ? (o / (o + od)) * 100 : null;
    } },
  { key: "dreb_pct", label: "DREB % (opp miss → own board)", group: "Boards & Playmaking",
    decimals: 0, suffix: "%", higherIsBetter: true,
    volumeFn: (g) => sum(g.map((x) => x.dreb + x.opp_oreb)), minVolume: 25,
    compute: (g) => {
      const d = sum(g.map((x) => x.dreb));
      const oo = sum(g.map((x) => x.opp_oreb));
      return d + oo > 0 ? (d / (d + oo)) * 100 : null;
    } },
  // ----- Defense / negatives -----
  { key: "stl", label: "Steals", group: "Defense / Negatives", decimals: 0, higherIsBetter: true,
    compute: (g) => safeMean(g.map((x) => x.stl)) },
  { key: "blk", label: "Blocks", group: "Defense / Negatives", decimals: 0, higherIsBetter: true,
    compute: (g) => safeMean(g.map((x) => x.blk)) },
  { key: "stocks", label: "Stocks (STL+BLK)", group: "Defense / Negatives", decimals: 0, higherIsBetter: true,
    compute: (g) => safeMean(g.map((x) => x.stl + x.blk)) },
  { key: "opp_tov", label: "Turnovers forced (opp TOV)", group: "Defense / Negatives", decimals: 0, higherIsBetter: true,
    compute: (g) => safeMean(g.map((x) => x.opp_tov ?? 0)) },
  { key: "pf", label: "Personal fouls", group: "Defense / Negatives", decimals: 0, higherIsBetter: false,
    compute: (g) => safeMean(g.map((x) => x.pf)) },
  { key: "pf_tech", label: "Technical fouls", group: "Defense / Negatives", decimals: 0, higherIsBetter: false,
    compute: (g) => safeMean(g.map((x) => x.pf_tech)) },
  { key: "pf_flag", label: "Flagrant fouls", group: "Defense / Negatives", decimals: 0, higherIsBetter: false,
    compute: (g) => safeMean(g.map((x) => x.pf_flag)) },
  // ----- Score -----
  { key: "pts", label: "Points scored", group: "Score", decimals: 0, higherIsBetter: true,
    compute: (g) => safeMean(g.map((x) => x.pts)) },
  { key: "opp_pts", label: "Points allowed", group: "Score", decimals: 0, higherIsBetter: false,
    compute: (g) => safeMean(g.map((x) => x.opp_pts)) },

  // ----- Lead & runs (PBP-derived; — when PBP not ingested) -----
  { key: "max_lead", label: "Biggest lead", group: "Lead & runs", decimals: 0, higherIsBetter: true,
    compute: (g) => safeMean(g.map((x) => x.max_lead)) },
  { key: "max_deficit", label: "Biggest deficit faced", group: "Lead & runs", decimals: 0, higherIsBetter: false,
    compute: (g) => safeMean(g.map((x) => x.max_deficit)) },
  { key: "pct_time_leading", label: "% of game time leading", group: "Lead & runs", decimals: 0, suffix: "%", higherIsBetter: true,
    compute: (g) => safeMean(g.map((x) => x.pct_time_leading)) },
  { key: "biggest_run_for", label: "Biggest scoring run", group: "Lead & runs", decimals: 0, higherIsBetter: true,
    dividerAbove: true,
    compute: (g) => safeMean(g.map((x) => x.biggest_run_for)) },
  { key: "biggest_run_against", label: "Biggest run allowed", group: "Lead & runs", decimals: 0, higherIsBetter: false,
    compute: (g) => safeMean(g.map((x) => x.biggest_run_against)) },

  // ----- Clutch (last 5 min Q4 + OT, score margin ≤ 5) -----
  { key: "clutch_pm", label: "Clutch +/-", group: "Clutch (last 5 min, ±5)", decimals: 0, higherIsBetter: true,
    compute: (g) => {
      // Sum across games (preserves correct totaling), then average per game
      const games = g.filter((x) => x.clutch_pts_for != null);
      if (!games.length) return null;
      return games.reduce((s, x) => s + ((x.clutch_pts_for ?? 0) - (x.clutch_pts_against ?? 0)), 0) / games.length;
    } },
  { key: "clutch_pts_for", label: "Clutch points scored", group: "Clutch (last 5 min, ±5)", decimals: 0, higherIsBetter: true,
    compute: (g) => safeMean(g.map((x) => x.clutch_pts_for)) },
  { key: "clutch_pts_against", label: "Clutch points allowed", group: "Clutch (last 5 min, ±5)", decimals: 0, higherIsBetter: false,
    compute: (g) => safeMean(g.map((x) => x.clutch_pts_against)) },
  { key: "clutch_min", label: "Clutch minutes", group: "Clutch (last 5 min, ±5)", decimals: 0, higherIsBetter: undefined,
    compute: (g) => {
      const v = safeMean(g.map((x) => x.clutch_seconds));
      return v != null ? v / 60 : null;
    } },
];

// Color the cell on a continuous red → yellow → green gradient based on
// signed % deviation from the reg-season baseline. Direction-aware.
//
// Mapping (after sign-flip for "lower is better" stats):
//   −15% or worse → fully red
//   −7.5%         → orange
//   0%            → yellow (at baseline)
//   +7.5%         → light green
//   +15% or better → fully green
function tintColor(value: number, baseline: number, higherIsBetter: boolean | undefined): React.CSSProperties {
  if (higherIsBetter === undefined) return {};
  if (baseline === 0 || !Number.isFinite(baseline)) return {};
  const pctDiff = (value - baseline) / Math.abs(baseline);
  // Flip sign for "lower is better" stats so green always = good
  const signed = higherIsBetter ? pctDiff : -pctDiff;
  // Clamp & remap [-0.15, 0.15] → [0, 1]
  const clamped = Math.max(-0.15, Math.min(0.15, signed));
  const t = (clamped + 0.15) / 0.30;
  // Interpolate red → yellow → green stops
  // red    = (220, 38, 38)
  // yellow = (234, 179, 8)
  // green  = (22, 163, 74)
  let r, g, b;
  if (t < 0.5) {
    const k = t * 2;
    r = 220 + (234 - 220) * k;
    g = 38  + (179 - 38)  * k;
    b = 38  + (8   - 38)  * k;
  } else {
    const k = (t - 0.5) * 2;
    r = 234 + (22  - 234) * k;
    g = 179 + (163 - 179) * k;
    b = 8   + (74  - 8)   * k;
  }
  const alpha = 0.18;
  return {
    backgroundColor: `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, ${alpha})`,
  };
}

function formatCell(v: number | null | undefined, decimals: number, suffix?: string): string {
  if (v == null || Number.isNaN(v)) return "—";
  return `${v.toFixed(decimals)}${suffix ?? ""}`;
}

// Compute all 9 windows for a single team
function buildWindows(team: Team) {
  const td = (g: TeamGameFullStats) => toDerived(g, team.pbpStats);
  const all = team.games.map(td);
  const seriesIds = new Set(team.seriesGameInfo.map((g) => g.game_id));

  const reg = team.games.filter((g) => g.season_type === "Regular Season").map(td);
  const last20 = team.games
    .filter((g) => g.season_type === "Regular Season")
    .slice(-20)
    .map(td);
  const series = team.games.filter((g) => seriesIds.has(g.game_id)).map(td);
  const perGame = team.seriesGameInfo.map((info) => {
    const g = team.games.find((x) => x.game_id === info.game_id);
    return g ? [td(g)] : [];
  });

  return { reg, last20, series, perGame, all };
}

const STRONG_BORDER = "2px solid #a1a1aa";

export default function TeamComparisonTable({ teams }: { teams: Team[] }) {
  if (!teams.length) return null;

  const numGames = teams[0].seriesGameInfo.length;
  const colCount = 3 + numGames; // REG, L20, SERIES, G1..G6
  const gridTemplate = `minmax(0,2.4fr) 70px 70px 70px ${teams[0].seriesGameInfo.map(() => "60px").join(" ")}`;

  // Group rows by `group` for visual sectioning. Score on top by request.
  const groupOrder = [
    "Score",
    "Pace",
    "Field goals — overall",
    "2PT shots — by location",
    "3PT shots — by location",
    "Free throws",
    "Ball security",
    "Boards & Playmaking",
    "Defense / Negatives",
    "Lead & runs",
    "Clutch (last 5 min, ±5)",
  ];
  const grouped = groupOrder.map((g) => ({ group: g, rows: ROWS.filter((r) => r.group === g) }));

  const renderTeamSection = (team: Team, isLast: boolean) => {
    const w = buildWindows(team);
    const wins = team.seriesGameInfo.filter((g) => g.wl === "W").length;
    const losses = team.seriesGameInfo.length - wins;
    return (
      <div key={team.team_id} style={{ borderBottom: isLast ? undefined : "3px solid #18181b" }}>
        {/* Team header band — also shows per-game W/L + score in the game columns */}
        <div
          className="grid items-end py-1.5 px-2 gap-x-0"
          style={{
            gridTemplateColumns: gridTemplate,
            background: "#fafaf7",
            borderBottom: "1px solid var(--nba-border)",
          }}
        >
          <div className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`https://cdn.nba.com/logos/nba/${team.team_id}/primary/L/logo.svg`}
              alt=""
              style={{ width: 22, height: 22, objectFit: "contain" }}
            />
            <div className="font-bold text-[12px]" style={{ color: team.color }}>
              {team.full_name}
            </div>
            <div className="text-[10px] text-(--nba-muted)">
              {wins}-{losses} · {w.reg.length} reg games
            </div>
          </div>
          {/* Win-loss records for each window */}
          {(() => {
            const wl = (gs: Derived[]) => {
              const w = gs.filter((g) => g.pts > g.opp_pts).length;
              const l = gs.length - w;
              return `${w}-${l}`;
            };
            const cellStyle: React.CSSProperties = {
              fontSize: 11, fontWeight: 700, textAlign: "center",
              fontVariantNumeric: "tabular-nums", color: "var(--nba-text)",
            };
            return (
              <>
                <div style={cellStyle}>{wl(w.reg)}</div>
                <div style={cellStyle}>{wl(w.last20)}</div>
                <div style={{ ...cellStyle, borderRight: STRONG_BORDER }}>{wl(w.series)}</div>
              </>
            );
          })()}
          {/* Per-game W/L + score from THIS team's perspective */}
          {team.seriesGameInfo.map((g, i) => (
            <div
              key={i}
              className="text-center"
              style={{
                borderRight: i < team.seriesGameInfo.length - 1 ? "1px solid var(--nba-border)" : undefined,
                paddingLeft: 2, paddingRight: 2,
              }}
            >
              <div
                className="text-[10px] font-bold leading-[12px]"
                style={{ color: g.wl === "W" ? "var(--nba-good)" : "var(--nba-bad)" }}
              >
                {g.wl}
              </div>
              <div
                className="text-[8.5px] font-normal leading-[11px]"
                style={{ color: g.wl === "W" ? "var(--nba-good)" : "var(--nba-bad)" }}
              >
                {g.pts}-{g.opp_pts}
              </div>
            </div>
          ))}
        </div>

        {grouped.map((g, gi) => (
          <div key={g.group}>
            {/* Group header row — stronger separator, bolder label */}
            <div
              className="grid items-center px-2 py-1 gap-x-0 font-mono text-[10px] uppercase tracking-[0.12em]"
              style={{
                gridTemplateColumns: gridTemplate,
                background: "#ececef",
                borderTop: gi > 0 ? "2px solid #71717a" : "1.5px solid #a1a1aa",
                borderBottom: "1px solid var(--nba-border-2)",
                color: "#18181b",
                fontWeight: 700,
              }}
            >
              <div>{g.group}</div>
            </div>
            {g.rows.map((r) => {
              const reg = r.compute(w.reg);
              const l20 = r.compute(w.last20);
              const ser = r.compute(w.series);
              const perGame = w.perGame.map((g) => r.compute(g));

              const baseline = reg ?? 0;
              const cell = (v: number | null) => ({
                style: v != null && reg != null ? tintColor(v, baseline, r.higherIsBetter) : {},
                text: formatCell(v, r.decimals, r.suffix),
              });
              const cReg = cell(reg);
              const cL20 = cell(l20);
              const cSer = cell(ser);

              return (
                <div
                  key={r.key}
                  className="grid items-center px-2 py-0.5 gap-x-0"
                  style={{
                    gridTemplateColumns: gridTemplate,
                    borderBottom: "1px solid var(--nba-divider)",
                    borderTop: r.dividerAbove ? "1.5px solid #c0c0c5" : undefined,
                  }}
                >
                  <div className="text-[11px] text-(--nba-text)">
                    {r.label}
                  </div>
                  <div
                    className="text-[11px] tabular-nums text-center font-medium"
                    style={cReg.style}
                  >
                    {cReg.text}
                  </div>
                  <div
                    className="text-[11px] tabular-nums text-center font-medium"
                    style={cL20.style}
                  >
                    {cL20.text}
                  </div>
                  <div
                    className="text-[11px] tabular-nums text-center font-medium"
                    style={{ ...cSer.style, borderRight: STRONG_BORDER }}
                  >
                    {cSer.text}
                  </div>
                  {perGame.map((v, gi) => {
                    const c = cell(v);
                    return (
                      <div
                        key={gi}
                        className="text-[11px] tabular-nums text-center font-medium"
                        style={{
                          ...c.style,
                          borderRight: gi < perGame.length - 1 ? "1px solid var(--nba-border)" : undefined,
                        }}
                      >
                        {c.text}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="nba-card p-3 mb-4">
      <div className="mb-2">
        <div className="nba-eyebrow">Reg-season vs playoff series — full stat profile</div>
        <div className="text-[10px] text-(--nba-muted) mt-0.5 leading-relaxed">
          Per-game averages. Cells tint <b>vs each team&apos;s own regular-season baseline</b> on a continuous gradient:{" "}
          <span style={{ background: "rgba(220,38,38,0.32)", padding: "0 4px", color: "#7f1d1d", fontWeight: 600 }}>red −15%</span>{" "}
          →{" "}
          <span style={{ background: "rgba(234,179,8,0.32)", padding: "0 4px", color: "#854d0e", fontWeight: 600 }}>yellow ≈ baseline</span>{" "}
          →{" "}
          <span style={{ background: "rgba(22,163,74,0.32)", padding: "0 4px", color: "#14532d", fontWeight: 600 }}>green +15%</span>.
          For each row, green always means &quot;the team did better than their reg-season norm&quot; (higher PTS, higher FG%, lower TOV, etc.) — coloring is direction-aware. Cells show — when PBP/shots data isn&apos;t ingested yet.
        </div>
      </div>
      {/* Header */}
      <div
        className="grid items-end px-2 py-1 gap-x-0 font-mono text-[10px] uppercase tracking-[0.10em] text-(--nba-subtle) border-b-2 border-(--nba-border-2)"
        style={{ gridTemplateColumns: gridTemplate }}
      >
        <div>Stat</div>
        <div className="text-center">Reg avg</div>
        <div className="text-center">L20 avg</div>
        <div className="text-center" style={{ borderRight: STRONG_BORDER }}>
          Series
        </div>
        {teams[0].seriesGameInfo.map((g, i) => (
          <div
            key={i}
            className="text-center"
            style={{ borderRight: i < numGames - 1 ? "1px solid var(--nba-border)" : undefined }}
          >
            <div className="font-bold text-(--nba-text)">G{i + 1}</div>
          </div>
        ))}
      </div>
      {teams.map((t, i) => renderTeamSection(t, i === teams.length - 1))}
      <div className="text-[10px] text-(--nba-subtle) mt-2">
        {colCount} columns · {ROWS.length} stat rows × {teams.length} teams
      </div>
    </div>
  );
}
