import type { GameLogRow } from "./queries";

export type SeasonAverages = {
  gp: number;
  wins: number;
  losses: number;
  mpg: number;
  ppg: number;
  rpg: number;
  apg: number;
  spg: number;
  bpg: number;
  topg: number;
  fta_pg: number;
  fg_pct: number | null;
  fg3_pct: number | null;
  ft_pct: number | null;
  ts_pct: number | null;   // True Shooting % = PTS / (2 * (FGA + 0.44 * FTA))
  efg_pct: number | null;  // (FGM + 0.5 * 3PM) / FGA
  pm_pg: number;
  usage_proxy: number | null; // FGA + 0.44*FTA + TOV per 36
};

function mean(values: (number | null | undefined)[]): number {
  const nums = values.filter((v): v is number => v != null);
  if (!nums.length) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function sum(values: (number | null | undefined)[]): number {
  return values
    .filter((v): v is number => v != null)
    .reduce((a, b) => a + b, 0);
}

export function computeSeasonAverages(
  log: GameLogRow[],
  seasonType = "Regular Season",
): SeasonAverages | null {
  const games = log.filter(
    (g) => g.season_type === seasonType && g.min != null,
  );
  if (!games.length) return null;

  const totalFGM = sum(games.map((g) => g.fgm));
  const totalFGA = sum(games.map((g) => g.fga));
  const total3PM = sum(games.map((g) => g.fg3m));
  const total3PA = sum(games.map((g) => g.fg3a));
  const totalFTM = sum(games.map((g) => g.ftm));
  const totalFTA = sum(games.map((g) => g.fta));
  const totalPTS = sum(games.map((g) => g.pts));
  const totalTOV = sum(games.map((g) => g.tov));
  const totalMin = sum(games.map((g) => g.min));

  const fg_pct = totalFGA ? (totalFGM / totalFGA) * 100 : null;
  const fg3_pct = total3PA ? (total3PM / total3PA) * 100 : null;
  const ft_pct = totalFTA ? (totalFTM / totalFTA) * 100 : null;
  const ts_denom = 2 * (totalFGA + 0.44 * totalFTA);
  const ts_pct = ts_denom > 0 ? (totalPTS / ts_denom) * 100 : null;
  const efg_pct = totalFGA ? ((totalFGM + 0.5 * total3PM) / totalFGA) * 100 : null;

  const usage_proxy =
    totalMin > 0
      ? ((totalFGA + 0.44 * totalFTA + totalTOV) * 36) / totalMin
      : null;

  return {
    gp: games.length,
    wins: games.filter((g) => g.team_wl === "W").length,
    losses: games.filter((g) => g.team_wl === "L").length,
    mpg: mean(games.map((g) => g.min)),
    ppg: mean(games.map((g) => g.pts)),
    rpg: mean(games.map((g) => g.reb)),
    apg: mean(games.map((g) => g.ast)),
    spg: mean(games.map((g) => g.stl)),
    bpg: mean(games.map((g) => g.blk)),
    topg: mean(games.map((g) => g.tov)),
    fta_pg: mean(games.map((g) => g.fta)),
    fg_pct,
    fg3_pct,
    ft_pct,
    ts_pct,
    efg_pct,
    pm_pg: mean(games.map((g) => g.plus_minus)),
    usage_proxy,
  };
}

export function rollingMean(values: number[], window: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < values.length; i++) {
    const start = Math.max(0, i - window + 1);
    const slice = values.slice(start, i + 1);
    out.push(slice.reduce((a, b) => a + b, 0) / slice.length);
  }
  return out;
}
