import "server-only";
import { all, one } from "./db";

export type Player = {
  player_id: number;
  full_name: string;
};

export type PlayerSeriesVsReg = {
  player_id: number;
  player_name: string;
  team_id: number;
  reg_games: number;
  series_games: number;
  // Per-game averages, both windows
  r_min: number; s_min: number;
  r_pts: number; s_pts: number;
  r_reb: number; s_reb: number;
  r_ast: number; s_ast: number;
  r_stocks: number; s_stocks: number;
  r_tov: number; s_tov: number;
  r_fga: number; s_fga: number;
  r_fta: number; s_fta: number;
  // Volume-weighted shooting %s (from totals)
  r_fg_pct: number | null; s_fg_pct: number | null;
  r_ft_pct: number | null; s_ft_pct: number | null;
};

export function playerSeriesVsRegSeason(
  teamId: number,
  seasonLabel: string,
  seriesGameIds: string[],
): PlayerSeriesVsReg[] {
  if (!seriesGameIds.length) return [];
  const gPlaceholders = seriesGameIds.map(() => "?").join(",");
  return all<PlayerSeriesVsReg>(
    `WITH reg AS (
       SELECT pb.player_id, pb.player_name, pb.team_id,
         COUNT(*) AS games,
         AVG(pb.minutes) AS r_min,
         AVG(pb.pts)     AS r_pts,
         AVG(pb.reb)     AS r_reb,
         AVG(pb.ast)     AS r_ast,
         AVG(COALESCE(pb.stl,0) + COALESCE(pb.blk,0)) AS r_stocks,
         AVG(pb.tov)     AS r_tov,
         AVG(pb.fga)     AS r_fga,
         AVG(pb.fta)     AS r_fta,
         SUM(pb.fgm)     AS r_fgm_t, SUM(pb.fga) AS r_fga_t,
         SUM(pb.ftm)     AS r_ftm_t, SUM(pb.fta) AS r_fta_t
       FROM player_boxscores pb
       JOIN team_games tg ON tg.game_id = pb.game_id AND tg.team_id = pb.team_id
       WHERE tg.season_label = ? AND tg.season_type = 'Regular Season'
         AND pb.team_id = ? AND COALESCE(pb.minutes, 0) > 0
       GROUP BY pb.player_id
     ),
     ser AS (
       SELECT pb.player_id, pb.player_name, pb.team_id,
         COUNT(*) AS games,
         AVG(pb.minutes) AS s_min,
         AVG(pb.pts)     AS s_pts,
         AVG(pb.reb)     AS s_reb,
         AVG(pb.ast)     AS s_ast,
         AVG(COALESCE(pb.stl,0) + COALESCE(pb.blk,0)) AS s_stocks,
         AVG(pb.tov)     AS s_tov,
         AVG(pb.fga)     AS s_fga,
         AVG(pb.fta)     AS s_fta,
         SUM(pb.fgm)     AS s_fgm_t, SUM(pb.fga) AS s_fga_t,
         SUM(pb.ftm)     AS s_ftm_t, SUM(pb.fta) AS s_fta_t
       FROM player_boxscores pb
       WHERE pb.game_id IN (${gPlaceholders})
         AND pb.team_id = ? AND COALESCE(pb.minutes, 0) > 0
       GROUP BY pb.player_id
     )
     SELECT
       s.player_id,
       COALESCE(s.player_name, r.player_name) AS player_name,
       s.team_id,
       COALESCE(r.games, 0) AS reg_games,
       s.games              AS series_games,
       COALESCE(r.r_min, 0) AS r_min, s.s_min,
       COALESCE(r.r_pts, 0) AS r_pts, s.s_pts,
       COALESCE(r.r_reb, 0) AS r_reb, s.s_reb,
       COALESCE(r.r_ast, 0) AS r_ast, s.s_ast,
       COALESCE(r.r_stocks, 0) AS r_stocks, s.s_stocks,
       COALESCE(r.r_tov, 0) AS r_tov, s.s_tov,
       COALESCE(r.r_fga, 0) AS r_fga, s.s_fga,
       COALESCE(r.r_fta, 0) AS r_fta, s.s_fta,
       CASE WHEN r.r_fga_t > 0 THEN r.r_fgm_t * 100.0 / r.r_fga_t END AS r_fg_pct,
       CASE WHEN s.s_fga_t > 0 THEN s.s_fgm_t * 100.0 / s.s_fga_t END AS s_fg_pct,
       CASE WHEN r.r_fta_t > 0 THEN r.r_ftm_t * 100.0 / r.r_fta_t END AS r_ft_pct,
       CASE WHEN s.s_fta_t > 0 THEN s.s_ftm_t * 100.0 / s.s_fta_t END AS s_ft_pct
     FROM ser s
     LEFT JOIN reg r ON r.player_id = s.player_id
     ORDER BY s.s_min DESC`,
    [seasonLabel, teamId, ...seriesGameIds, teamId],
  );
}

export type SeasonRow = { season_label: string };

export type TeamMeta = {
  team_id: number;
  abbreviation: string;
  full_name: string;
  nickname: string;
  gp: number;
};

export type GameLogRow = {
  team: string;
  game_num: number;
  season_type: string;
  date: string;
  opp: string | null;
  loc: "H" | "A" | null;
  team_wl: "W" | "L" | null;
  team_pts: number | null;
  opp_pts: number | null;
  min: number | null;
  pts: number | null;
  reb: number | null;
  ast: number | null;
  fgm: number | null;
  fga: number | null;
  fg_pct: number | null;
  fg2m: number | null;
  fg2a: number | null;
  fg2_pct: number | null;
  fg3m: number | null;
  fg3a: number | null;
  fg3_pct: number | null;
  ftm: number | null;
  fta: number | null;
  ft_pct: number | null;
  dreb: number | null;
  oreb: number | null;
  tov: number | null;
  stl: number | null;
  blk: number | null;
  stocks: number | null;
  plus_minus: number | null;
  pf: number | null;
};

export function playersWithData(): Player[] {
  return all<Player>(
    `SELECT DISTINCT p.player_id, p.full_name
     FROM players p
     JOIN player_boxscores pb ON pb.player_id = p.player_id
     ORDER BY p.full_name`,
  );
}

export function seasonsForPlayer(playerId: number): string[] {
  const rows = all<SeasonRow>(
    `SELECT DISTINCT tg.season_label
     FROM player_boxscores pb
     JOIN team_games tg ON tg.game_id = pb.game_id AND tg.team_id = pb.team_id
     WHERE pb.player_id = ?
     ORDER BY tg.season_label DESC`,
    [playerId],
  );
  return rows.map((r) => r.season_label);
}

export function primaryTeamForPlayer(
  playerId: number,
  seasonLabel: string,
): TeamMeta | undefined {
  return one<TeamMeta>(
    `SELECT t.team_id, t.abbreviation, t.full_name, t.nickname,
            COUNT(*) AS gp
     FROM player_boxscores pb
     JOIN teams t ON t.team_id = pb.team_id
     JOIN team_games tg
       ON tg.game_id = pb.game_id AND tg.team_id = pb.team_id
     WHERE pb.player_id = ? AND tg.season_label = ?
       AND COALESCE(pb.minutes, 0) > 0
     GROUP BY t.team_id
     ORDER BY gp DESC
     LIMIT 1`,
    [playerId, seasonLabel],
  );
}

export function playerById(playerId: number): Player | undefined {
  return one<Player>(
    `SELECT player_id, full_name FROM players WHERE player_id = ?`,
    [playerId],
  );
}

const PLAYER_GAME_LOG_SQL = `
WITH first_played AS (
    SELECT pb.team_id, tg.season_type,
           MIN(tg.game_date) AS first_played
    FROM player_boxscores pb
    JOIN team_games tg ON tg.game_id = pb.game_id AND tg.team_id = pb.team_id
    WHERE pb.player_id = :pid
      AND tg.season_label = :season
      AND COALESCE(pb.minutes, 0) > 0
    GROUP BY pb.team_id, tg.season_type
),
season_bounds AS (
    SELECT season_type,
           MIN(game_date) AS season_first,
           MAX(game_date) AS season_last
    FROM team_games
    WHERE season_label = :season
    GROUP BY season_type
),
windows AS (
    SELECT
        fp.team_id,
        fp.season_type,
        CASE
          WHEN LAG(fp.first_played) OVER (
                   PARTITION BY fp.season_type ORDER BY fp.first_played
               ) IS NULL
          THEN sb.season_first
          ELSE fp.first_played
        END AS w_start,
        CASE
          WHEN LEAD(fp.first_played) OVER (
                   PARTITION BY fp.season_type ORDER BY fp.first_played
               ) IS NULL
          THEN sb.season_last
          ELSE date(LEAD(fp.first_played) OVER (
                   PARTITION BY fp.season_type ORDER BY fp.first_played
               ), '-1 day')
        END AS w_end
    FROM first_played fp
    JOIN season_bounds sb ON sb.season_type = fp.season_type
)
SELECT
    t.abbreviation                                        AS team,
    ROW_NUMBER() OVER (PARTITION BY tg.season_type
                       ORDER BY tg.game_date, tg.game_id) AS game_num,
    tg.season_type                                        AS season_type,
    tg.game_date                                          AS date,
    opp.abbreviation                                      AS opp,
    CASE WHEN tg.is_home = 1 THEN 'H' ELSE 'A' END        AS loc,
    tg.wl                                                 AS team_wl,
    tg.pts                                                AS team_pts,
    opp_tg.pts                                            AS opp_pts,
    ROUND(pb.minutes, 1)                                  AS min,
    pb.pts, pb.reb, pb.ast,
    pb.fgm, pb.fga,
    CASE WHEN pb.fga > 0
         THEN ROUND(pb.fgm * 100.0 / pb.fga, 1) END       AS fg_pct,
    (pb.fgm - COALESCE(pb.fg3m, 0))                       AS fg2m,
    (pb.fga - COALESCE(pb.fg3a, 0))                       AS fg2a,
    CASE WHEN (pb.fga - COALESCE(pb.fg3a, 0)) > 0
         THEN ROUND(
             (pb.fgm - COALESCE(pb.fg3m, 0)) * 100.0 /
             (pb.fga - COALESCE(pb.fg3a, 0)), 1)
    END                                                   AS fg2_pct,
    pb.fg3m, pb.fg3a,
    CASE WHEN pb.fg3a > 0
         THEN ROUND(pb.fg3m * 100.0 / pb.fg3a, 1) END     AS fg3_pct,
    pb.ftm, pb.fta,
    CASE WHEN pb.fta > 0
         THEN ROUND(pb.ftm * 100.0 / pb.fta, 1) END       AS ft_pct,
    pb.dreb, pb.oreb,
    pb.tov, pb.stl, pb.blk,
    (pb.stl + pb.blk)                                     AS stocks,
    pb.plus_minus,
    pb.pf
FROM team_games tg
JOIN windows w
  ON w.team_id    = tg.team_id
 AND w.season_type = tg.season_type
 AND tg.game_date BETWEEN w.w_start AND w.w_end
JOIN teams t ON t.team_id = tg.team_id
LEFT JOIN team_games opp_tg
       ON opp_tg.game_id = tg.game_id AND opp_tg.team_id != tg.team_id
LEFT JOIN teams opp ON opp.team_id = opp_tg.team_id
LEFT JOIN player_boxscores pb
       ON pb.game_id = tg.game_id
      AND pb.team_id = tg.team_id
      AND pb.player_id = :pid
WHERE tg.season_label = :season
ORDER BY
    CASE tg.season_type
        WHEN 'Pre Season'     THEN 0
        WHEN 'Regular Season' THEN 1
        WHEN 'Play In'        THEN 2
        WHEN 'Playoffs'       THEN 3
        ELSE 4
    END,
    tg.game_date,
    tg.game_id
`;

export function playerGameLog(
  playerId: number,
  seasonLabel: string,
): GameLogRow[] {
  return all<GameLogRow>(PLAYER_GAME_LOG_SQL, {
    pid: playerId,
    season: seasonLabel,
  });
}

export type SeasonAggRow = {
  player_id: number;
  gp: number;
  mpg: number;
  ppg: number;
  rpg: number;
  apg: number;
  spg: number;
  bpg: number;
  topg: number;
  fta_pg: number;
  pm_pg: number;
  stk_pg: number;
  ast_to_ratio: number | null;
  fg_pct: number | null;
  fg3_pct: number | null;
  ft_pct: number | null;
  ts_pct: number | null;
  efg_pct: number | null;
  tot_fgm: number;
  tot_3pm: number;
  tot_ftm: number;
};

// ===== TEAM QUERIES =====

export type Team = {
  team_id: number;
  abbreviation: string;
  full_name: string;
  nickname: string;
  city: string;
};

export function listTeams(): Team[] {
  return all<Team>(
    `SELECT team_id, abbreviation, full_name, nickname, city
     FROM teams
     ORDER BY city`,
  );
}

export function teamByAbbr(abbr: string): Team | undefined {
  return one<Team>(
    `SELECT team_id, abbreviation, full_name, nickname, city
     FROM teams WHERE LOWER(abbreviation) = LOWER(?)`,
    [abbr],
  );
}

export function seasonsForTeam(teamId: number): string[] {
  return all<{ season_label: string }>(
    `SELECT DISTINCT season_label FROM team_games
     WHERE team_id = ? ORDER BY season_label DESC`,
    [teamId],
  ).map((r) => r.season_label);
}

export type TeamGameRow = {
  game_id: string;
  game_num: number;
  season_type: string;
  date: string;
  loc: "H" | "A";
  opp: string;
  opp_team_id: number;
  wl: "W" | "L";
  // Their stats
  pts: number;
  fgm: number; fga: number; fg_pct: number | null;
  fg3m: number; fg3a: number; fg3_pct: number | null;
  ftm: number; fta: number; ft_pct: number | null;
  oreb: number; dreb: number; reb: number;
  ast: number; stl: number; blk: number; tov: number; pf: number;
  poss: number;
  // Opponent stats
  opp_pts: number;
  opp_fgm: number; opp_fga: number; opp_fg_pct: number | null;
  opp_fg3m: number; opp_fg3a: number; opp_fg3_pct: number | null;
  opp_ftm: number; opp_fta: number; opp_ft_pct: number | null;
  opp_oreb: number; opp_dreb: number; opp_reb: number;
  opp_ast: number; opp_stl: number; opp_blk: number; opp_tov: number; opp_pf: number;
  opp_poss: number;
};

const TEAM_GAME_LOG_SQL = `
WITH team_box AS (
  SELECT
    tg.game_id, tg.team_id, tg.season_label, tg.season_type,
    tg.game_date, tg.is_home, tg.wl, tg.pts,
    SUM(pb.fgm)  AS fgm,  SUM(pb.fga)  AS fga,
    SUM(pb.fg3m) AS fg3m, SUM(pb.fg3a) AS fg3a,
    SUM(pb.ftm)  AS ftm,  SUM(pb.fta)  AS fta,
    SUM(pb.oreb) AS oreb, SUM(pb.dreb) AS dreb, SUM(pb.reb) AS reb,
    SUM(pb.ast)  AS ast,
    SUM(pb.stl)  AS stl, SUM(pb.blk) AS blk,
    SUM(pb.tov)  AS tov, SUM(pb.pf)  AS pf
  FROM team_games tg
  LEFT JOIN player_boxscores pb
    ON pb.game_id = tg.game_id AND pb.team_id = tg.team_id
  WHERE tg.season_label = :season
  GROUP BY tg.game_id, tg.team_id
)
SELECT
  t.game_id,
  ROW_NUMBER() OVER (PARTITION BY t.season_type
                     ORDER BY t.game_date, t.game_id) AS game_num,
  t.season_type,
  t.game_date AS date,
  CASE WHEN t.is_home = 1 THEN 'H' ELSE 'A' END AS loc,
  opp_t.abbreviation AS opp,
  o.team_id AS opp_team_id,
  t.wl AS wl,
  t.pts AS pts, o.pts AS opp_pts,
  t.fgm, t.fga,
  CASE WHEN t.fga > 0 THEN ROUND(t.fgm * 100.0 / t.fga, 1) END AS fg_pct,
  o.fgm AS opp_fgm, o.fga AS opp_fga,
  CASE WHEN o.fga > 0 THEN ROUND(o.fgm * 100.0 / o.fga, 1) END AS opp_fg_pct,
  t.fg3m, t.fg3a,
  CASE WHEN t.fg3a > 0 THEN ROUND(t.fg3m * 100.0 / t.fg3a, 1) END AS fg3_pct,
  o.fg3m AS opp_fg3m, o.fg3a AS opp_fg3a,
  CASE WHEN o.fg3a > 0 THEN ROUND(o.fg3m * 100.0 / o.fg3a, 1) END AS opp_fg3_pct,
  t.ftm, t.fta,
  CASE WHEN t.fta > 0 THEN ROUND(t.ftm * 100.0 / t.fta, 1) END AS ft_pct,
  o.ftm AS opp_ftm, o.fta AS opp_fta,
  CASE WHEN o.fta > 0 THEN ROUND(o.ftm * 100.0 / o.fta, 1) END AS opp_ft_pct,
  t.oreb, t.dreb, t.reb,
  o.oreb AS opp_oreb, o.dreb AS opp_dreb, o.reb AS opp_reb,
  t.ast, o.ast AS opp_ast,
  t.stl, o.stl AS opp_stl,
  t.blk, o.blk AS opp_blk,
  t.tov, o.tov AS opp_tov,
  t.pf, o.pf AS opp_pf,
  ROUND(t.fga + 0.44 * t.fta + t.tov - t.oreb, 1) AS poss,
  ROUND(o.fga + 0.44 * o.fta + o.tov - o.oreb, 1) AS opp_poss
FROM team_box t
JOIN team_box o ON o.game_id = t.game_id AND o.team_id != t.team_id
JOIN teams opp_t ON opp_t.team_id = o.team_id
WHERE t.team_id = :team_id
ORDER BY
  CASE t.season_type
    WHEN 'Pre Season'     THEN 0
    WHEN 'Regular Season' THEN 1
    WHEN 'Play In'        THEN 2
    WHEN 'Playoffs'       THEN 3
    ELSE 4
  END,
  t.game_date,
  t.game_id
`;

export function teamGameLog(
  teamId: number,
  seasonLabel: string,
): TeamGameRow[] {
  return all<TeamGameRow>(TEAM_GAME_LOG_SQL, {
    team_id: teamId,
    season: seasonLabel,
  });
}

/** Per-team per-game comprehensive stats — boxscore + shot buckets + fouls. */
export type TeamGameFullStats = {
  game_id: string;
  team_id: number;
  game_date: string;
  season_type: string;
  is_home: 0 | 1;
  // Team's box score (summed from player_boxscores)
  pts: number;
  fgm: number; fga: number;
  fg3m: number; fg3a: number;
  ftm: number; fta: number;
  fg2m: number; fg2a: number;
  oreb: number; dreb: number; reb: number;
  ast: number; stl: number; blk: number; tov: number; pf: number;
  // Opponent's box score
  opp_pts: number;
  opp_fgm: number; opp_fga: number;
  opp_fg3m: number; opp_fg3a: number;
  opp_ftm: number; opp_fta: number;
  opp_oreb: number; opp_dreb: number; opp_reb: number;
  opp_ast: number; opp_tov: number;
  // Possessions (Dean Oliver formula)
  poss: number;
  opp_poss: number;
  // Shot bucket counts (NULL if shots data not ingested for this game)
  rim_a: number | null; rim_m: number | null;
  short_a: number | null; short_m: number | null;
  long_a: number | null; long_m: number | null;
  corner3_a: number | null; corner3_m: number | null;
  atb3_a: number | null; atb3_m: number | null;
  // Foul subtypes (NULL if PBP not ingested)
  pf_tech: number | null;
  pf_flag: number | null;
};

/** Per-game advanced metrics derived from PBP. Null for games without PBP. */
export type TeamGamePbpDerived = {
  game_id: string;
  team_id: number;
  max_lead: number;
  max_deficit: number;          // positive number = how far behind they got
  pct_time_leading: number;     // 0-100
  biggest_run_for: number;
  biggest_run_against: number;
  clutch_pts_for: number;
  clutch_pts_against: number;
  clutch_seconds: number;
};

/** Walk all PBP for a team's season, return per-game advanced stats. */
export function teamPbpDerivedStats(
  teamId: number,
  seasonLabel: string,
): Map<string, TeamGamePbpDerived> {
  // Get is_home flag per game so we know which score column is "ours"
  const teamGames = all<{ game_id: string; is_home: 0 | 1 }>(
    `SELECT game_id, is_home FROM team_games
     WHERE team_id = ? AND season_label = ?`,
    [teamId, seasonLabel],
  );
  const homeMap = new Map(teamGames.map((g) => [g.game_id, g.is_home === 1]));
  if (homeMap.size === 0) return new Map();

  // Load only plays for games this team played, only ones with usable
  // seconds_elapsed (we'll drop the rest)
  const placeholders = teamGames.map(() => "?").join(",");
  const plays = all<{
    game_id: string; period: number; seconds_elapsed: number | null;
    score_home: unknown; score_away: unknown;
  }>(
    `SELECT game_id, period, seconds_elapsed, score_home, score_away
     FROM plays
     WHERE game_id IN (${placeholders})
     ORDER BY game_id, COALESCE(seconds_elapsed, 0), action_number`,
    teamGames.map((g) => g.game_id),
  );

  const byGame = new Map<string, typeof plays>();
  for (const p of plays) {
    if (!byGame.has(p.game_id)) byGame.set(p.game_id, []);
    byGame.get(p.game_id)!.push(p);
  }

  const parseNum = (v: unknown, fb: number): number => {
    if (v == null) return fb;
    if (typeof v === "number") return Number.isNaN(v) ? fb : v;
    if (typeof v === "string") {
      if (v === "") return fb;
      const n = Number(v);
      return Number.isNaN(n) ? fb : n;
    }
    return fb;
  };

  const result = new Map<string, TeamGamePbpDerived>();
  for (const [game_id, gPlays] of byGame.entries()) {
    if (gPlays.length === 0) continue;
    const isHome = homeMap.get(game_id);
    if (isHome === undefined) continue;

    let maxLead = 0;
    let maxDeficit = 0;
    let timeLeading = 0;
    let timeTotal = 0;
    let prevSec = 0;
    let prevTeamScore = 0;
    let prevOppScore = 0;
    let curRunFor = 0;
    let curRunAgainst = 0;
    let biggestRunFor = 0;
    let biggestRunAgainst = 0;
    let clutchPtsFor = 0;
    let clutchPtsAgainst = 0;
    let clutchSec = 0;

    for (const p of gPlays) {
      const sec = parseNum(p.seconds_elapsed, prevSec);
      const teamScore = parseNum(isHome ? p.score_home : p.score_away, prevTeamScore);
      const oppScore = parseNum(isHome ? p.score_away : p.score_home, prevOppScore);
      const dt = Math.max(0, sec - prevSec);
      const dPF = Math.max(0, teamScore - prevTeamScore);
      const dPA = Math.max(0, oppScore - prevOppScore);
      const prevDiff = prevTeamScore - prevOppScore;

      // Lead tracking — uses cumulative score AT this play
      const currDiff = teamScore - oppScore;
      if (currDiff > maxLead) maxLead = currDiff;
      if (-currDiff > maxDeficit) maxDeficit = -currDiff;

      // Time leading: dt before this play was spent at prevDiff state
      timeTotal += dt;
      if (prevDiff > 0) timeLeading += dt;

      // Scoring runs: extend or break
      if (dPF > 0 && dPA === 0) {
        curRunFor += dPF;
        if (curRunAgainst > 0) {
          biggestRunAgainst = Math.max(biggestRunAgainst, curRunAgainst);
          curRunAgainst = 0;
        }
      } else if (dPA > 0 && dPF === 0) {
        curRunAgainst += dPA;
        if (curRunFor > 0) {
          biggestRunFor = Math.max(biggestRunFor, curRunFor);
          curRunFor = 0;
        }
      } else if (dPF > 0 && dPA > 0) {
        // Same play credited both? Defensive. Treat as run-breaks for both.
        biggestRunFor = Math.max(biggestRunFor, curRunFor);
        biggestRunAgainst = Math.max(biggestRunAgainst, curRunAgainst);
        curRunFor = 0; curRunAgainst = 0;
      }

      // Clutch: last 5 min of Q4 (sec ≥ 2580) OR any OT (period ≥ 5),
      // score margin ≤ 5 at the time of the play
      const isClutchTime = (p.period === 4 && sec >= 4 * 720 - 300) || p.period >= 5;
      if (isClutchTime && Math.abs(prevDiff) <= 5) {
        clutchSec += dt;
        clutchPtsFor += dPF;
        clutchPtsAgainst += dPA;
      }

      prevSec = sec;
      prevTeamScore = teamScore;
      prevOppScore = oppScore;
    }
    biggestRunFor = Math.max(biggestRunFor, curRunFor);
    biggestRunAgainst = Math.max(biggestRunAgainst, curRunAgainst);

    result.set(game_id, {
      game_id, team_id: teamId,
      max_lead: maxLead,
      max_deficit: maxDeficit,
      pct_time_leading: timeTotal > 0 ? (timeLeading / timeTotal) * 100 : 0,
      biggest_run_for: biggestRunFor,
      biggest_run_against: biggestRunAgainst,
      clutch_pts_for: clutchPtsFor,
      clutch_pts_against: clutchPtsAgainst,
      clutch_seconds: clutchSec,
    });
  }
  return result;
}

export function teamSeasonGameStats(
  teamId: number,
  seasonLabel: string,
  seasonType?: string,
): TeamGameFullStats[] {
  const filter = seasonType
    ? "AND tg.season_type = ?"
    : "";
  // Param order: season_label, [season_type], team_id
  const params: Array<number | string> = [seasonLabel];
  if (seasonType) params.push(seasonType);
  params.push(teamId);
  return all<TeamGameFullStats>(
    `WITH box AS (
       SELECT
         tg.game_id, tg.team_id, tg.game_date, tg.season_type, tg.is_home,
         tg.pts AS pts,
         SUM(pb.fgm)  AS fgm,  SUM(pb.fga)  AS fga,
         SUM(pb.fg3m) AS fg3m, SUM(pb.fg3a) AS fg3a,
         SUM(pb.ftm)  AS ftm,  SUM(pb.fta)  AS fta,
         SUM(pb.fgm - COALESCE(pb.fg3m, 0)) AS fg2m,
         SUM(pb.fga - COALESCE(pb.fg3a, 0)) AS fg2a,
         SUM(pb.oreb) AS oreb, SUM(pb.dreb) AS dreb, SUM(pb.reb) AS reb,
         SUM(pb.ast)  AS ast,
         SUM(pb.stl)  AS stl,  SUM(pb.blk) AS blk,
         SUM(pb.tov)  AS tov,  SUM(pb.pf)  AS pf
       FROM team_games tg
       LEFT JOIN player_boxscores pb
         ON pb.game_id = tg.game_id AND pb.team_id = tg.team_id
       WHERE tg.season_label = ? ${filter}
       GROUP BY tg.game_id, tg.team_id
     ),
     shotbuckets AS (
       SELECT
         game_id, team_id,
         SUM(CASE WHEN action_type LIKE '%Dunk%'
               OR action_type LIKE '%Layup%'
               OR action_type LIKE '%Tip%' THEN 1 ELSE 0 END) AS rim_a,
         SUM(CASE WHEN (action_type LIKE '%Dunk%'
               OR action_type LIKE '%Layup%'
               OR action_type LIKE '%Tip%') AND shot_made = 1 THEN 1 ELSE 0 END) AS rim_m,
         SUM(CASE WHEN action_type NOT LIKE '%Dunk%'
               AND action_type NOT LIKE '%Layup%'
               AND action_type NOT LIKE '%Tip%'
               AND shot_distance < 15
               AND shot_type = '2PT Field Goal' THEN 1 ELSE 0 END) AS short_a,
         SUM(CASE WHEN action_type NOT LIKE '%Dunk%'
               AND action_type NOT LIKE '%Layup%'
               AND action_type NOT LIKE '%Tip%'
               AND shot_distance < 15
               AND shot_type = '2PT Field Goal' AND shot_made = 1 THEN 1 ELSE 0 END) AS short_m,
         SUM(CASE WHEN action_type NOT LIKE '%Dunk%'
               AND action_type NOT LIKE '%Layup%'
               AND action_type NOT LIKE '%Tip%'
               AND shot_distance >= 15
               AND shot_type = '2PT Field Goal' THEN 1 ELSE 0 END) AS long_a,
         SUM(CASE WHEN action_type NOT LIKE '%Dunk%'
               AND action_type NOT LIKE '%Layup%'
               AND action_type NOT LIKE '%Tip%'
               AND shot_distance >= 15
               AND shot_type = '2PT Field Goal' AND shot_made = 1 THEN 1 ELSE 0 END) AS long_m,
         SUM(CASE WHEN shot_type = '3PT Field Goal'
               AND (shot_zone_basic LIKE '%Corner 3%') THEN 1 ELSE 0 END) AS corner3_a,
         SUM(CASE WHEN shot_type = '3PT Field Goal'
               AND (shot_zone_basic LIKE '%Corner 3%')
               AND shot_made = 1 THEN 1 ELSE 0 END) AS corner3_m,
         SUM(CASE WHEN shot_type = '3PT Field Goal'
               AND shot_zone_basic NOT LIKE '%Corner 3%' THEN 1 ELSE 0 END) AS atb3_a,
         SUM(CASE WHEN shot_type = '3PT Field Goal'
               AND shot_zone_basic NOT LIKE '%Corner 3%'
               AND shot_made = 1 THEN 1 ELSE 0 END) AS atb3_m
       FROM shots
       GROUP BY game_id, team_id
     ),
     fouls AS (
       SELECT game_id, team_id,
         SUM(CASE WHEN sub_type LIKE '%Technical%' THEN 1 ELSE 0 END) AS pf_tech,
         SUM(CASE WHEN sub_type LIKE 'Flagrant%'  THEN 1 ELSE 0 END) AS pf_flag
       FROM plays
       WHERE action_type = 'Foul' AND team_id IS NOT NULL
       GROUP BY game_id, team_id
     ),
     -- For the "team has shots data" check: a row exists in shots for this (game,team)
     has_shots AS (
       SELECT DISTINCT game_id, team_id FROM shots
     ),
     has_pbp AS (
       SELECT DISTINCT game_id FROM plays
     )
     SELECT
       b.game_id, b.team_id, b.game_date, b.season_type, b.is_home,
       b.pts, b.fgm, b.fga, b.fg3m, b.fg3a, b.ftm, b.fta, b.fg2m, b.fg2a,
       b.oreb, b.dreb, b.reb, b.ast, b.stl, b.blk, b.tov, b.pf,
       o.pts  AS opp_pts,
       o.fgm  AS opp_fgm, o.fga AS opp_fga,
       o.fg3m AS opp_fg3m, o.fg3a AS opp_fg3a,
       o.ftm  AS opp_ftm, o.fta AS opp_fta,
       o.oreb AS opp_oreb, o.dreb AS opp_dreb, o.reb AS opp_reb,
       o.ast  AS opp_ast, o.tov AS opp_tov,
       (b.fga + 0.44 * b.fta + b.tov - b.oreb) AS poss,
       (o.fga + 0.44 * o.fta + o.tov - o.oreb) AS opp_poss,
       CASE WHEN hs.game_id IS NOT NULL THEN COALESCE(sb.rim_a, 0) ELSE NULL END    AS rim_a,
       CASE WHEN hs.game_id IS NOT NULL THEN COALESCE(sb.rim_m, 0) ELSE NULL END    AS rim_m,
       CASE WHEN hs.game_id IS NOT NULL THEN COALESCE(sb.short_a, 0) ELSE NULL END  AS short_a,
       CASE WHEN hs.game_id IS NOT NULL THEN COALESCE(sb.short_m, 0) ELSE NULL END  AS short_m,
       CASE WHEN hs.game_id IS NOT NULL THEN COALESCE(sb.long_a, 0) ELSE NULL END   AS long_a,
       CASE WHEN hs.game_id IS NOT NULL THEN COALESCE(sb.long_m, 0) ELSE NULL END   AS long_m,
       CASE WHEN hs.game_id IS NOT NULL THEN COALESCE(sb.corner3_a, 0) ELSE NULL END AS corner3_a,
       CASE WHEN hs.game_id IS NOT NULL THEN COALESCE(sb.corner3_m, 0) ELSE NULL END AS corner3_m,
       CASE WHEN hs.game_id IS NOT NULL THEN COALESCE(sb.atb3_a, 0) ELSE NULL END    AS atb3_a,
       CASE WHEN hs.game_id IS NOT NULL THEN COALESCE(sb.atb3_m, 0) ELSE NULL END    AS atb3_m,
       CASE WHEN hp.game_id IS NOT NULL THEN COALESCE(f.pf_tech, 0) ELSE NULL END   AS pf_tech,
       CASE WHEN hp.game_id IS NOT NULL THEN COALESCE(f.pf_flag, 0) ELSE NULL END   AS pf_flag
     FROM box b
     JOIN box o ON o.game_id = b.game_id AND o.team_id != b.team_id
     LEFT JOIN shotbuckets sb ON sb.game_id = b.game_id AND sb.team_id = b.team_id
     LEFT JOIN has_shots   hs ON hs.game_id = b.game_id AND hs.team_id = b.team_id
     LEFT JOIN fouls       f  ON f.game_id  = b.game_id AND f.team_id  = b.team_id
     LEFT JOIN has_pbp     hp ON hp.game_id = b.game_id
     WHERE b.team_id = ?
     ORDER BY b.game_date, b.game_id`,
    params,
  );
}

export type TeamSeasonAggRow = {
  team_id: number;
  gp: number;
  wins: number;
  losses: number;
  ppg: number;
  opp_ppg: number;
  net_rtg: number;
  poss: number;          // possessions per game
  reb_pg: number;
  opp_reb_pg: number;
  reb_diff: number;
  oreb_pg: number;
  opp_oreb_pg: number;
  ast_pg: number;
  opp_ast_pg: number;
  ast_diff: number;
  tov_pg: number;
  opp_tov_pg: number;
  tov_diff: number;     // their TOV - opp TOV (lower is better)
  fg_pct: number | null;
  opp_fg_pct: number | null;
  fg3_pct: number | null;
  opp_fg3_pct: number | null;
  ft_pct: number | null;
  efg_pct: number | null;
  opp_efg_pct: number | null;
  stl_pg: number;
  blk_pg: number;
  pf_pg: number;
};

export type SeriesGame = {
  game_id: string;
  game_date: string;
  is_home: 0 | 1;
  wl: "W" | "L";
  pts: number;
  opp_pts: number;
  team_id: number;
  opp_team_id: number;
};

export function seriesGames(
  teamId: number,
  oppTeamId: number,
  seasonLabel: string,
  seasonType = "Playoffs",
): SeriesGame[] {
  return all<SeriesGame>(
    `SELECT
       tg.game_id, tg.game_date, tg.is_home, tg.wl, tg.pts,
       opp.pts AS opp_pts, tg.team_id, opp.team_id AS opp_team_id
     FROM team_games tg
     JOIN team_games opp
       ON opp.game_id = tg.game_id AND opp.team_id != tg.team_id
     WHERE tg.team_id = ?
       AND opp.team_id = ?
       AND tg.season_label = ?
       AND tg.season_type = ?
     ORDER BY tg.game_date`,
    [teamId, oppTeamId, seasonLabel, seasonType],
  );
}

export type PlayRow = {
  game_id: string;
  action_number: number;
  period: number;
  seconds_elapsed: number | null;
  team_id: number | null;
  person_id: number | null;
  action_type: string;
  description: string | null;
  score_home: number | null;
  score_away: number | null;
};

export function playsForGames(gameIds: string[]): PlayRow[] {
  if (!gameIds.length) return [];
  const placeholders = gameIds.map(() => "?").join(",");
  // Sort by seconds_elapsed (true chronological order) with action_number as
  // tiebreaker. This avoids double-counting time when instant replays /
  // corrections appear at later action_numbers but reference earlier moments.
  return all<PlayRow>(
    `SELECT game_id, action_number, period, seconds_elapsed,
            team_id, person_id, action_type, description,
            score_home, score_away
     FROM plays
     WHERE game_id IN (${placeholders})
     ORDER BY game_id,
              COALESCE(seconds_elapsed, 0),
              action_number`,
    gameIds,
  );
}

export type RosterRow = {
  player_id: number;
  player_name: string;
  starter: number;
  full_name: string | null;
  last_name: string | null;
};

export function gameRoster(gameId: string, teamId: number): RosterRow[] {
  return all<RosterRow>(
    `SELECT pb.player_id, pb.player_name, pb.starter,
            p.full_name, p.last_name
     FROM player_boxscores pb
     LEFT JOIN players p ON p.player_id = pb.player_id
     WHERE pb.game_id = ? AND pb.team_id = ?`,
    [gameId, teamId],
  );
}

export function teamSeasonAggregates(
  seasonLabel: string,
  seasonType = "Regular Season",
): TeamSeasonAggRow[] {
  return all<TeamSeasonAggRow>(
    `WITH team_box AS (
       SELECT
         tg.game_id, tg.team_id, tg.pts AS pts,
         SUM(pb.fgm)  AS fgm,  SUM(pb.fga)  AS fga,
         SUM(pb.fg3m) AS fg3m, SUM(pb.fg3a) AS fg3a,
         SUM(pb.ftm)  AS ftm,  SUM(pb.fta)  AS fta,
         SUM(pb.oreb) AS oreb, SUM(pb.dreb) AS dreb, SUM(pb.reb) AS reb,
         SUM(pb.ast)  AS ast,
         SUM(pb.stl)  AS stl, SUM(pb.blk) AS blk,
         SUM(pb.tov)  AS tov, SUM(pb.pf)  AS pf
       FROM team_games tg
       LEFT JOIN player_boxscores pb
         ON pb.game_id = tg.game_id AND pb.team_id = tg.team_id
       WHERE tg.season_label = ? AND tg.season_type = ?
       GROUP BY tg.game_id, tg.team_id
     ),
     paired AS (
       SELECT t.team_id,
              t.pts  AS pts, o.pts AS opp_pts,
              t.fgm  AS fgm,  t.fga  AS fga,  o.fgm AS opp_fgm, o.fga AS opp_fga,
              t.fg3m AS fg3m, t.fg3a AS fg3a, o.fg3m AS opp_fg3m, o.fg3a AS opp_fg3a,
              t.ftm  AS ftm,  t.fta  AS fta,  o.ftm AS opp_ftm,  o.fta AS opp_fta,
              t.oreb AS oreb, t.dreb AS dreb, t.reb AS reb,
              o.oreb AS opp_oreb, o.dreb AS opp_dreb, o.reb AS opp_reb,
              t.ast AS ast, o.ast AS opp_ast,
              t.stl AS stl, t.blk AS blk,
              t.tov AS tov, o.tov AS opp_tov,
              t.pf  AS pf,
              (t.fga + 0.44 * t.fta + t.tov - t.oreb)        AS poss,
              CASE WHEN t.pts > o.pts THEN 1 ELSE 0 END      AS win
       FROM team_box t
       JOIN team_box o ON o.game_id = t.game_id AND o.team_id != t.team_id
     )
     SELECT
       team_id,
       COUNT(*)                                AS gp,
       SUM(win)                                AS wins,
       COUNT(*) - SUM(win)                     AS losses,
       AVG(pts)                                AS ppg,
       AVG(opp_pts)                            AS opp_ppg,
       AVG(pts) - AVG(opp_pts)                 AS net_rtg,
       AVG(poss)                               AS poss,
       AVG(reb)                                AS reb_pg,
       AVG(opp_reb)                            AS opp_reb_pg,
       AVG(reb) - AVG(opp_reb)                 AS reb_diff,
       AVG(oreb)                               AS oreb_pg,
       AVG(opp_oreb)                           AS opp_oreb_pg,
       AVG(ast)                                AS ast_pg,
       AVG(opp_ast)                            AS opp_ast_pg,
       AVG(ast) - AVG(opp_ast)                 AS ast_diff,
       AVG(tov)                                AS tov_pg,
       AVG(opp_tov)                            AS opp_tov_pg,
       AVG(tov) - AVG(opp_tov)                 AS tov_diff,
       CASE WHEN SUM(fga)  > 0 THEN SUM(fgm)  * 100.0 / SUM(fga)  END AS fg_pct,
       CASE WHEN SUM(opp_fga)  > 0 THEN SUM(opp_fgm)  * 100.0 / SUM(opp_fga)  END AS opp_fg_pct,
       CASE WHEN SUM(fg3a) > 0 THEN SUM(fg3m) * 100.0 / SUM(fg3a) END AS fg3_pct,
       CASE WHEN SUM(opp_fg3a) > 0 THEN SUM(opp_fg3m) * 100.0 / SUM(opp_fg3a) END AS opp_fg3_pct,
       CASE WHEN SUM(fta)  > 0 THEN SUM(ftm)  * 100.0 / SUM(fta)  END AS ft_pct,
       CASE WHEN SUM(fga)  > 0 THEN (SUM(fgm) + 0.5 * SUM(fg3m)) * 100.0 / SUM(fga) END AS efg_pct,
       CASE WHEN SUM(opp_fga)  > 0 THEN (SUM(opp_fgm) + 0.5 * SUM(opp_fg3m)) * 100.0 / SUM(opp_fga) END AS opp_efg_pct,
       AVG(stl)                                AS stl_pg,
       AVG(blk)                                AS blk_pg,
       AVG(pf)                                 AS pf_pg
     FROM paired
     GROUP BY team_id`,
    [seasonLabel, seasonType],
  );
}

export function seasonAggregates(
  seasonLabel: string,
  seasonType = "Regular Season",
): SeasonAggRow[] {
  return all<SeasonAggRow>(
    `SELECT
       pb.player_id,
       COUNT(*)                                             AS gp,
       AVG(pb.minutes)                                      AS mpg,
       AVG(pb.pts)                                          AS ppg,
       AVG(pb.reb)                                          AS rpg,
       AVG(pb.ast)                                          AS apg,
       AVG(pb.stl)                                          AS spg,
       AVG(pb.blk)                                          AS bpg,
       AVG(pb.tov)                                          AS topg,
       AVG(pb.fta)                                          AS fta_pg,
       AVG(pb.plus_minus)                                   AS pm_pg,
       AVG(COALESCE(pb.stl, 0) + COALESCE(pb.blk, 0))       AS stk_pg,
       CASE WHEN SUM(pb.tov) > 0
            THEN SUM(pb.ast) * 1.0 / SUM(pb.tov) END        AS ast_to_ratio,
       CASE WHEN SUM(pb.fga)  > 0
            THEN SUM(pb.fgm)  * 100.0 / SUM(pb.fga)  END    AS fg_pct,
       CASE WHEN SUM(pb.fg3a) > 0
            THEN SUM(pb.fg3m) * 100.0 / SUM(pb.fg3a) END    AS fg3_pct,
       CASE WHEN SUM(pb.fta)  > 0
            THEN SUM(pb.ftm)  * 100.0 / SUM(pb.fta)  END    AS ft_pct,
       CASE WHEN (SUM(pb.fga) + 0.44 * SUM(pb.fta)) > 0
            THEN SUM(pb.pts) * 100.0 /
                 (2.0 * (SUM(pb.fga) + 0.44 * SUM(pb.fta))) END
                                                            AS ts_pct,
       CASE WHEN SUM(pb.fga) > 0
            THEN (SUM(pb.fgm) + 0.5 * SUM(pb.fg3m)) * 100.0
                 / SUM(pb.fga) END                          AS efg_pct,
       SUM(pb.fgm)                                          AS tot_fgm,
       SUM(pb.fg3m)                                         AS tot_3pm,
       SUM(pb.ftm)                                          AS tot_ftm
     FROM player_boxscores pb
     JOIN team_games tg
       ON tg.game_id = pb.game_id AND tg.team_id = pb.team_id
     WHERE tg.season_label = ?
       AND tg.season_type  = ?
       AND COALESCE(pb.minutes, 0) > 0
     GROUP BY pb.player_id`,
    [seasonLabel, seasonType],
  );
}
