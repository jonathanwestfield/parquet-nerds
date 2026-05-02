import { notFound } from "next/navigation";
import Link from "next/link";
import GameLogTable from "@/components/GameLogTable";
import MetricCard from "@/components/MetricCard";
import TrendChart from "@/components/TrendChart";
import DistributionChart from "@/components/DistributionChart";
import PlayerPicker from "@/components/PlayerPicker";
import {
  playerById,
  playerGameLog,
  primaryTeamForPlayer,
  seasonsForPlayer,
  seasonAggregates,
} from "@/lib/queries";
import { allPlayerSlugs, playerIdFromSlug } from "@/lib/slug";

export const dynamic = "force-dynamic";
import { computeSeasonAverages, rollingMean } from "@/lib/stats";
import { computePlayerRanks } from "@/lib/ranks";
import { fmt, fmtSigned, formatGameDate } from "@/lib/format";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ season?: string }>;
};

export default async function PlayerPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const { season: seasonParam } = await searchParams;

  const playerId = playerIdFromSlug(slug);
  if (!playerId) notFound();

  const player = playerById(playerId);
  if (!player) notFound();

  const seasons = seasonsForPlayer(playerId);
  if (!seasons.length) {
    return (
      <div>
        <h1 className="text-xl font-semibold mb-2">{player.full_name}</h1>
        <p className="text-sm text-(--nba-muted)">No game data for this player yet.</p>
      </div>
    );
  }

  const season = seasonParam && seasons.includes(seasonParam) ? seasonParam : seasons[0];
  const team = primaryTeamForPlayer(playerId, season);
  const log = playerGameLog(playerId, season);

  const photoUrl = `https://cdn.nba.com/headshots/nba/latest/1040x760/${playerId}.png`;
  const teamLogoUrl = team
    ? `https://cdn.nba.com/logos/nba/${team.team_id}/primary/L/logo.svg`
    : null;

  // Played, regular-season-first ordering for charts (chronological)
  const playedChrono = log
    .filter((g) => g.min != null)
    .sort((a, b) => {
      // Pre Season < Regular Season < Play In < Playoffs (chronological order in season)
      if (a.season_type !== b.season_type) {
        const order: Record<string, number> = {
          "Pre Season": 0,
          "Regular Season": 1,
          "Play In": 2,
          Playoffs: 3,
        };
        return (order[a.season_type] ?? 4) - (order[b.season_type] ?? 4);
      }
      return a.date < b.date ? -1 : 1;
    });

  const reg = computeSeasonAverages(log, "Regular Season");
  const playoffs = computeSeasonAverages(log, "Playoffs");
  const headline = reg ?? playoffs ?? computeSeasonAverages(log, "Play In");

  // NBA ranks are regular-season only (per league convention)
  const seasonAgg = reg ? seasonAggregates(season, "Regular Season") : [];
  const ranks = reg ? computePlayerRanks(seasonAgg, playerId) : {};

  // Trend chart series — order: MIN, PTS, AST, REB, FGA, FTA, STK, TOV, AST/TO
  const isPlayoff = playedChrono.map((g) => g.season_type === "Playoffs");
  const minVals  = playedChrono.map((g) => g.min ?? 0);
  const ptsVals  = playedChrono.map((g) => g.pts ?? 0);
  const astVals  = playedChrono.map((g) => g.ast ?? 0);
  const rebVals  = playedChrono.map((g) => g.reb ?? 0);
  const fgaVals  = playedChrono.map((g) => g.fga ?? 0);
  const ftaVals  = playedChrono.map((g) => g.fta ?? 0);
  const stkVals  = playedChrono.map((g) => g.stocks ?? 0);
  const tovVals  = playedChrono.map((g) => g.tov ?? 0);
  // AST/TO per game: when TOV = 0, fall back to AST (cap-friendly upper bound).
  const astoVals = playedChrono.map((g) => {
    const a = g.ast ?? 0;
    const t = g.tov ?? 0;
    return t > 0 ? a / t : a;
  });

  const ROLLING_WINDOW = 10;
  const trendSpecs: { key: string; label: string; values: number[]; color: string }[] = [
    { key: "min",  label: "Minutes",           values: minVals,  color: "#0f172a" },
    { key: "pts",  label: "Points",            values: ptsVals,  color: "#dc2626" },
    { key: "ast",  label: "Assists",           values: astVals,  color: "#16a34a" },
    { key: "reb",  label: "Rebounds",          values: rebVals,  color: "#3b82f6" },
    { key: "fga",  label: "FG attempts",       values: fgaVals,  color: "#0891b2" },
    { key: "fta",  label: "FT attempts",       values: ftaVals,  color: "#a16207" },
    { key: "stk",  label: "Stocks (STL+BLK)",  values: stkVals,  color: "#7c3aed" },
    { key: "tov",  label: "Turnovers",         values: tovVals,  color: "#f59e0b" },
    { key: "asto", label: "AST / TO",          values: astoVals, color: "#0d9488" },
  ];

  // High / low scoring game callouts
  const playedGames = log.filter((g) => g.min != null && g.pts != null);
  const hiGame = playedGames.length
    ? [...playedGames].sort((a, b) => (b.pts! - a.pts!))[0]
    : null;
  const loGame = playedGames.length
    ? [...playedGames].sort((a, b) => (a.pts! - b.pts!))[0]
    : null;

  const playedN = playedGames.length;
  const dnpN = log.length - log.filter((g) => g.min != null).length;

  const allPlayers = allPlayerSlugs();

  return (
    <div>
      {/* Picker bar — search any player + switch seasons inline */}
      <div className="flex flex-wrap items-center gap-3 mb-3 pb-3 border-b border-(--nba-border)">
        <PlayerPicker players={allPlayers} currentName={player.full_name} />
        {seasons.length > 1 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="nba-eyebrow mr-1">Season</span>
            {seasons.map((s) => (
              <Link
                key={s}
                href={`/player/${slug}?season=${s}`}
                className="text-xs px-2 py-1 rounded border tabular-nums"
                style={{
                  borderColor: s === season ? "var(--nba-text)" : "var(--nba-border-2)",
                  color: s === season ? "var(--nba-text)" : "var(--nba-muted)",
                  fontWeight: s === season ? 600 : 500,
                }}
              >
                {s}
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Header */}
      <div className="nba-player-header">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={photoUrl} alt="" className="nba-player-photo" />
        <div className="nba-player-text">
          <div className="nba-player-name">{player.full_name}</div>
          <div className="nba-player-meta">
            {season}
            {team ? ` · ${team.full_name}` : ""}
            {headline ? ` · ${headline.gp} GP` : ""}
          </div>
        </div>
        {teamLogoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={teamLogoUrl} alt="" className="nba-player-team" />
        )}
      </div>

      {/* KPI strip */}
      {headline && (
        <>
          <div className="nba-eyebrow mb-2 flex items-center gap-2">
            <span>Season averages</span>
            <span className="text-(--nba-subtle) font-normal normal-case tracking-normal text-[0.62rem]">
              regular season · ranks among 58+ GP qualifiers
            </span>
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 xl:grid-cols-11 gap-2 mb-6">
            <MetricCard label="MIN"   value={fmt(headline.mpg)} rank={ranks.mpg ?? null} />
            <MetricCard label="PPG"   value={fmt(headline.ppg)} rank={ranks.ppg ?? null} />
            <MetricCard label="APG"   value={fmt(headline.apg)} rank={ranks.apg ?? null} />
            <MetricCard label="RPG"   value={fmt(headline.rpg)} rank={ranks.rpg ?? null} />
            <MetricCard label="STK"   value={fmt(headline.spg + headline.bpg)} rank={ranks.stk_pg ?? null} />
            <MetricCard label="TOV"   value={fmt(headline.topg)} rank={ranks.topg ?? null} />
            <MetricCard label="AST/TO" value={headline.topg > 0 ? (headline.apg / headline.topg).toFixed(2) : "—"} rank={ranks.ast_to_ratio ?? null} />
            <MetricCard label="FTA"   value={fmt(headline.fta_pg)} rank={ranks.fta_pg ?? null} />
            <MetricCard label="FG%"   value={headline.fg_pct  != null ? `${headline.fg_pct.toFixed(1)}%`  : "—"} rank={ranks.fg_pct ?? null} />
            <MetricCard label="3P%"   value={headline.fg3_pct != null ? `${headline.fg3_pct.toFixed(1)}%` : "—"} rank={ranks.fg3_pct ?? null} />
            <MetricCard label="TS%"   value={headline.ts_pct  != null ? `${headline.ts_pct.toFixed(1)}%`  : "—"} rank={ranks.ts_pct ?? null} />
          </div>
        </>
      )}

      {/* Trend charts */}
      {playedChrono.length > 0 && (
        <>
          <div className="nba-rule" />
          <div className="nba-eyebrow mb-2 flex items-center gap-2">
            <span>Trends — per game and {ROLLING_WINDOW}-game rolling average</span>
            <span className="text-(--nba-subtle) font-normal normal-case tracking-normal text-[0.62rem]">
              avg line = regular season ·{" "}
              <span style={{ color: "#b45309", fontWeight: 600 }}>amber</span> = playoffs
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
            {trendSpecs.map((spec) => (
              <TrendChart
                key={spec.key}
                label={spec.label}
                values={spec.values}
                rolling={rollingMean(spec.values, ROLLING_WINDOW)}
                isPlayoff={isPlayoff}
                color={spec.color}
                rollingWindow={ROLLING_WINDOW}
              />
            ))}
          </div>
        </>
      )}

      {/* Distribution + callouts */}
      {playedGames.length > 0 && (
        <>
          <div className="nba-rule" />
          <div className="nba-eyebrow mb-2">Scoring distribution</div>
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-3 mb-6">
            <div className="lg:col-span-3">
              <DistributionChart values={ptsVals} label="Points" />
            </div>
            <div className="lg:col-span-2 flex flex-col gap-2">
              {hiGame && <ScoringCallout title="Season high" row={hiGame} accent="var(--nba-good)" />}
              {loGame && <ScoringCallout title="Season low"  row={loGame} accent="var(--nba-bad)" />}
            </div>
          </div>
        </>
      )}

      {/* Game log */}
      <div className="nba-rule" />
      <div className="nba-eyebrow mb-2">Game log</div>
      <GameLogTable rows={log} />

      <div className="mt-2 text-[0.72rem] text-(--nba-subtle)">
        {log.length.toLocaleString()} games · {playedN} played · {dnpN} DNP
      </div>
    </div>
  );
}

function ScoringCallout({
  title,
  row,
  accent,
}: {
  title: string;
  row: import("@/lib/queries").GameLogRow;
  accent: string;
}) {
  const opp = row.opp ?? "—";
  const loc = row.loc === "A" ? "@" : "vs";
  const date = formatGameDate(row.date);
  return (
    <div
      className="nba-metric"
      style={{ borderLeft: `3px solid ${accent}`, borderRadius: "0 6px 6px 0" }}
    >
      <div className="nba-metric-label">{title}</div>
      <div className="nba-metric-value">{row.pts ?? 0} PTS</div>
      <div className="nba-metric-sub">
        {row.reb ?? 0} REB · {row.ast ?? 0} AST · {row.fgm ?? 0}/{row.fga ?? 0} FG
        {row.fg3a ? ` · ${row.fg3m ?? 0}/${row.fg3a} 3P` : ""}
      </div>
      <div className="nba-metric-sub">
        {loc} {opp} · {date} · {row.team_wl ?? ""}{" "}
        {row.team_pts != null && row.opp_pts != null
          ? `${row.team_pts}-${row.opp_pts}`
          : ""}
        {row.plus_minus != null ? ` · ${fmtSigned(row.plus_minus)}` : ""}
      </div>
    </div>
  );
}
