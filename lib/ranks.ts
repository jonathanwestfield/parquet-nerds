import type { SeasonAggRow } from "./queries";

// NBA league-leader thresholds (used by NBA.com, basketball-reference, ESPN)
export const RANK_THRESHOLDS = {
  // 70% of an 82-game season → must have played at least 58 games
  minGpForRates: 58,
  // Minimum makes for shooting % titles (NBA standard)
  minFgmForFgPct: 300,
  min3pmFor3pPct: 82,
  minFtmForFtPct: 125,
} as const;

export type Rank = {
  rank: number;
  total: number;
} | null;

type StatKey =
  | "ppg" | "rpg" | "apg" | "stk_pg" | "topg" | "pm_pg" | "mpg"
  | "fta_pg" | "ast_to_ratio"
  | "fg_pct" | "fg3_pct" | "ft_pct" | "ts_pct" | "efg_pct";

const HIGHER_IS_BETTER: Record<StatKey, boolean> = {
  ppg: true, rpg: true, apg: true, stk_pg: true, mpg: true, pm_pg: true,
  fta_pg: true, ast_to_ratio: true,
  fg_pct: true, fg3_pct: true, ft_pct: true, ts_pct: true, efg_pct: true,
  topg: false,
};

function rankIn(
  pool: SeasonAggRow[],
  playerId: number,
  key: StatKey,
): Rank {
  const me = pool.find((r) => r.player_id === playerId);
  if (!me) return null;
  const myVal = me[key];
  if (myVal == null || Number.isNaN(myVal)) return null;
  const higher = HIGHER_IS_BETTER[key];
  let better = 0;
  for (const r of pool) {
    if (r.player_id === playerId) continue;
    const v = r[key];
    if (v == null) continue;
    if (higher ? v > myVal : v < myVal) better += 1;
  }
  return { rank: better + 1, total: pool.length };
}

export type PlayerRanks = Partial<Record<StatKey, Rank>>;

export function computePlayerRanks(
  agg: SeasonAggRow[],
  playerId: number,
): PlayerRanks {
  const t = RANK_THRESHOLDS;
  const ratePool = agg.filter((r) => r.gp >= t.minGpForRates);
  const fgPool   = agg.filter((r) => r.tot_fgm >= t.minFgmForFgPct);
  const fg3Pool  = agg.filter((r) => r.tot_3pm >= t.min3pmFor3pPct);
  const ftPool   = agg.filter((r) => r.tot_ftm >= t.minFtmForFtPct);

  return {
    mpg:          rankIn(ratePool, playerId, "mpg"),
    ppg:          rankIn(ratePool, playerId, "ppg"),
    rpg:          rankIn(ratePool, playerId, "rpg"),
    apg:          rankIn(ratePool, playerId, "apg"),
    stk_pg:       rankIn(ratePool, playerId, "stk_pg"),
    topg:         rankIn(ratePool, playerId, "topg"),
    fta_pg:       rankIn(ratePool, playerId, "fta_pg"),
    ast_to_ratio: rankIn(ratePool, playerId, "ast_to_ratio"),
    pm_pg:        rankIn(ratePool, playerId, "pm_pg"),
    fg_pct:       rankIn(fgPool,   playerId, "fg_pct"),
    fg3_pct:      rankIn(fg3Pool,  playerId, "fg3_pct"),
    ft_pct:       rankIn(ftPool,   playerId, "ft_pct"),
    ts_pct:       rankIn(ratePool, playerId, "ts_pct"),
  };
}

export function fmtRank(r: Rank): string | undefined {
  if (!r) return undefined;
  return `#${r.rank} of ${r.total}`;
}
