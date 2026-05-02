import type { TeamSeasonAggRow } from "./queries";
import type { Rank } from "./ranks";

type TeamStatKey =
  | "ppg" | "opp_ppg" | "net_rtg" | "poss"
  | "reb_diff" | "ast_diff" | "tov_diff"
  | "oreb_pg" | "stl_pg" | "blk_pg"
  | "fg_pct" | "opp_fg_pct" | "fg3_pct" | "opp_fg3_pct"
  | "efg_pct" | "opp_efg_pct" | "ft_pct";

const HIGHER_IS_BETTER: Record<TeamStatKey, boolean> = {
  ppg: true, opp_ppg: false, net_rtg: true, poss: true,
  reb_diff: true, ast_diff: true, tov_diff: false,  // lower TOV diff = better
  oreb_pg: true, stl_pg: true, blk_pg: true,
  fg_pct: true, opp_fg_pct: false,
  fg3_pct: true, opp_fg3_pct: false,
  efg_pct: true, opp_efg_pct: false,
  ft_pct: true,
};

function rankIn(pool: TeamSeasonAggRow[], teamId: number, key: TeamStatKey): Rank {
  const me = pool.find((r) => r.team_id === teamId);
  if (!me) return null;
  const myVal = me[key];
  if (myVal == null || Number.isNaN(myVal)) return null;
  const higher = HIGHER_IS_BETTER[key];
  let better = 0;
  for (const r of pool) {
    if (r.team_id === teamId) continue;
    const v = r[key];
    if (v == null) continue;
    if (higher ? v > myVal : v < myVal) better += 1;
  }
  return { rank: better + 1, total: pool.length };
}

export type TeamRanks = Partial<Record<TeamStatKey, Rank>>;

export function computeTeamRanks(
  agg: TeamSeasonAggRow[],
  teamId: number,
): TeamRanks {
  return {
    ppg:         rankIn(agg, teamId, "ppg"),
    opp_ppg:     rankIn(agg, teamId, "opp_ppg"),
    net_rtg:     rankIn(agg, teamId, "net_rtg"),
    poss:        rankIn(agg, teamId, "poss"),
    reb_diff:    rankIn(agg, teamId, "reb_diff"),
    ast_diff:    rankIn(agg, teamId, "ast_diff"),
    tov_diff:    rankIn(agg, teamId, "tov_diff"),
    oreb_pg:     rankIn(agg, teamId, "oreb_pg"),
    stl_pg:      rankIn(agg, teamId, "stl_pg"),
    blk_pg:      rankIn(agg, teamId, "blk_pg"),
    fg_pct:      rankIn(agg, teamId, "fg_pct"),
    opp_fg_pct:  rankIn(agg, teamId, "opp_fg_pct"),
    fg3_pct:     rankIn(agg, teamId, "fg3_pct"),
    opp_fg3_pct: rankIn(agg, teamId, "opp_fg3_pct"),
    efg_pct:     rankIn(agg, teamId, "efg_pct"),
    opp_efg_pct: rankIn(agg, teamId, "opp_efg_pct"),
    ft_pct:      rankIn(agg, teamId, "ft_pct"),
  };
}
