// Preview variant V1 — "Editorial / Guste-inspired"
// Lexend, big breathing room, sunshine-yellow highlight on top-5 ranks,
// massive wordmarks. Same data as /player/[slug].

import { notFound } from "next/navigation";
import Link from "next/link";
import { Lexend } from "next/font/google";
import GameLogTable from "@/components/GameLogTable";
import TrendChart from "@/components/TrendChart";
import DistributionChart from "@/components/DistributionChart";
import {
  playerById,
  playerGameLog,
  primaryTeamForPlayer,
  seasonsForPlayer,
  seasonAggregates,
} from "@/lib/queries";
import { playerIdFromSlug } from "@/lib/slug";
import { computeSeasonAverages, rollingMean } from "@/lib/stats";
import { computePlayerRanks, type Rank } from "@/lib/ranks";
import { fmt, formatGameDate, fmtSigned } from "@/lib/format";

const lexend = Lexend({
  subsets: ["latin"],
  display: "swap",
  weight: ["300", "400", "500", "600", "700"],
});

const POP = "#FFE000"; // guste sunshine yellow

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ season?: string }>;
};

function StatBlock({
  label,
  value,
  rank,
}: {
  label: string;
  value: string;
  rank: Rank;
}) {
  const isTop5 = rank && rank.rank <= 5;
  const isTop25 = rank && rank.rank / rank.total <= 0.25;

  return (
    <div
      className="relative px-4 py-5"
      style={{
        background: isTop5 ? POP : "transparent",
        borderTop: "1px solid #e4e4e7",
        borderRight: "1px solid #e4e4e7",
      }}
    >
      <div
        className="text-[10px] font-bold tracking-[0.18em] uppercase"
        style={{ color: isTop5 ? "#1e1e1e" : "#52525b" }}
      >
        {label}
      </div>
      <div
        className="text-3xl font-semibold mt-1.5"
        style={{
          color: "#1e1e1e",
          fontVariantNumeric: "tabular-nums",
          letterSpacing: "-0.02em",
        }}
      >
        {value}
      </div>
      {rank && (
        <div
          className="text-[11px] mt-1.5 font-medium"
          style={{
            color: isTop5
              ? "#1e1e1e"
              : isTop25
              ? "#15803d"
              : rank.rank / rank.total >= 0.75
              ? "#dc2626"
              : "#52525b",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          #{rank.rank}{" "}
          <span style={{ opacity: 0.55, fontWeight: 400 }}>
            of {rank.total}
          </span>
        </div>
      )}
    </div>
  );
}

export default async function PlayerEditorialPreview({
  params,
  searchParams,
}: Props) {
  const { slug } = await params;
  const { season: seasonParam } = await searchParams;

  const playerId = playerIdFromSlug(slug);
  if (!playerId) notFound();

  const player = playerById(playerId);
  if (!player) notFound();

  const seasons = seasonsForPlayer(playerId);
  if (!seasons.length) notFound();

  const season =
    seasonParam && seasons.includes(seasonParam) ? seasonParam : seasons[0];
  const team = primaryTeamForPlayer(playerId, season);
  const log = playerGameLog(playerId, season);

  const photoUrl = `https://cdn.nba.com/headshots/nba/latest/1040x760/${playerId}.png`;
  const teamLogoUrl = team
    ? `https://cdn.nba.com/logos/nba/${team.team_id}/primary/L/logo.svg`
    : null;

  const reg = computeSeasonAverages(log, "Regular Season");
  const playoffs = computeSeasonAverages(log, "Playoffs");
  const headline = reg ?? playoffs ?? computeSeasonAverages(log, "Play In");

  const seasonAgg = reg ? seasonAggregates(season, "Regular Season") : [];
  const ranks = reg ? computePlayerRanks(seasonAgg, playerId) : {};

  const playedChrono = log
    .filter((g) => g.min != null)
    .sort((a, b) => {
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

  const isPlayoff = playedChrono.map((g) => g.season_type === "Playoffs");
  const minVals = playedChrono.map((g) => g.min ?? 0);
  const ptsVals = playedChrono.map((g) => g.pts ?? 0);
  const astVals = playedChrono.map((g) => g.ast ?? 0);
  const rebVals = playedChrono.map((g) => g.reb ?? 0);
  const fgaVals = playedChrono.map((g) => g.fga ?? 0);
  const ftaVals = playedChrono.map((g) => g.fta ?? 0);
  const stkVals = playedChrono.map((g) => g.stocks ?? 0);
  const tovVals = playedChrono.map((g) => g.tov ?? 0);
  const astoVals = playedChrono.map((g) => {
    const a = g.ast ?? 0;
    const t = g.tov ?? 0;
    return t > 0 ? a / t : a;
  });

  const ROLLING = 10;
  const trendSpecs = [
    { key: "min",  label: "Minutes",          values: minVals,  color: "#1e1e1e" },
    { key: "pts",  label: "Points",           values: ptsVals,  color: "#c8167c" },
    { key: "ast",  label: "Assists",          values: astVals,  color: "#3d9c31" },
    { key: "reb",  label: "Rebounds",         values: rebVals,  color: "#277FC3" },
    { key: "fga",  label: "FG attempts",      values: fgaVals,  color: "#56b78f" },
    { key: "fta",  label: "FT attempts",      values: ftaVals,  color: "#e56420" },
    { key: "stk",  label: "Stocks (STL+BLK)", values: stkVals,  color: "#6164AB" },
    { key: "tov",  label: "Turnovers",        values: tovVals,  color: "#E94A3B" },
    { key: "asto", label: "AST / TO",         values: astoVals, color: "#01579b" },
  ];

  const playedGames = log.filter((g) => g.min != null && g.pts != null);
  const hiGame = playedGames.length
    ? [...playedGames].sort((a, b) => b.pts! - a.pts!)[0]
    : null;
  const loGame = playedGames.length
    ? [...playedGames].sort((a, b) => a.pts! - b.pts!)[0]
    : null;

  return (
    <div
      className={lexend.className}
      style={{ background: "#ffffff", minHeight: "100vh", color: "#1e1e1e" }}
    >
      {/* Top wordmark bar */}
      <div className="px-10 py-6 flex items-center justify-between border-b border-(--nba-border)">
        <Link
          href="/preview"
          className="text-[15px] font-bold tracking-[-0.01em]"
          style={{ color: "#1e1e1e" }}
        >
          PARQUET NERDS<span style={{ background: POP, padding: "0 4px" }}>.</span>
        </Link>
        <div className="text-[10px] font-bold tracking-[0.18em] uppercase text-(--nba-muted)">
          Preview · V1 · Editorial
        </div>
      </div>

      <div className="max-w-[1280px] mx-auto px-10 pb-32">
        {/* Hero — massive */}
        <section className="pt-20 pb-16 grid grid-cols-12 gap-8 items-end border-b border-(--nba-border)">
          <div className="col-span-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photoUrl}
              alt=""
              className="w-full aspect-[3/4] object-cover object-top"
              style={{ background: "#f4f4f5" }}
            />
          </div>
          <div className="col-span-9 pb-3">
            <div className="text-[10px] font-bold tracking-[0.2em] uppercase text-(--nba-muted) mb-3">
              {season} · {team?.full_name ?? "—"}
            </div>
            <h1
              className="font-bold leading-[0.92] tracking-[-0.035em]"
              style={{ fontSize: "clamp(56px, 7vw, 104px)", color: "#1e1e1e" }}
            >
              {player.full_name.split(" ").map((part, i, arr) => (
                <span key={i}>
                  {part}
                  {i < arr.length - 1 ? <br /> : null}
                </span>
              ))}
            </h1>
            <div className="flex items-center gap-6 mt-6">
              {teamLogoUrl && (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={teamLogoUrl} alt="" className="w-10 h-10 object-contain" />
              )}
              {headline && (
                <div className="text-[13px] text-(--nba-muted) tabular-nums">
                  {headline.gp} GP · {fmt(headline.mpg)} MPG · {fmt(headline.ppg)}/{fmt(headline.rpg)}/{fmt(headline.apg)}
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Season switcher */}
        {seasons.length > 1 && (
          <div className="flex items-center gap-3 mt-8 flex-wrap">
            <span className="text-[10px] font-bold tracking-[0.18em] uppercase text-(--nba-muted)">
              SEASON
            </span>
            {seasons.map((s) => (
              <Link
                key={s}
                href={`/preview/v1/${slug}?season=${s}`}
                className="text-xs px-3 py-1.5 rounded-full border"
                style={{
                  borderColor: s === season ? "#1e1e1e" : "#e4e4e7",
                  color: s === season ? "#1e1e1e" : "#52525b",
                  background: s === season ? POP : "transparent",
                  fontWeight: s === season ? 600 : 500,
                }}
              >
                {s}
              </Link>
            ))}
          </div>
        )}

        {/* Section: Season averages — big editorial label */}
        {headline && (
          <section className="mt-24">
            <div className="grid grid-cols-12 gap-8 mb-8 items-end">
              <h2
                className="col-span-7 font-bold tracking-[-0.025em]"
                style={{ fontSize: "clamp(36px, 4vw, 56px)", lineHeight: 1 }}
              >
                Season averages
              </h2>
              <div className="col-span-5 text-[11px] text-(--nba-muted) leading-relaxed">
                Regular-season per-game averages. Ranks among the {ranks.ppg?.total ?? "—"} qualified players (≥58 GP). Gold cells = top 5 in the league.
              </div>
            </div>

            <div
              className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-11"
              style={{ borderLeft: "1px solid #e4e4e7", borderBottom: "1px solid #e4e4e7" }}
            >
              <StatBlock label="MIN"   value={fmt(headline.mpg)} rank={ranks.mpg ?? null} />
              <StatBlock label="PPG"   value={fmt(headline.ppg)} rank={ranks.ppg ?? null} />
              <StatBlock label="APG"   value={fmt(headline.apg)} rank={ranks.apg ?? null} />
              <StatBlock label="RPG"   value={fmt(headline.rpg)} rank={ranks.rpg ?? null} />
              <StatBlock label="STK"   value={fmt(headline.spg + headline.bpg)} rank={ranks.stk_pg ?? null} />
              <StatBlock label="TOV"   value={fmt(headline.topg)} rank={ranks.topg ?? null} />
              <StatBlock label="AST/TO" value={headline.topg > 0 ? (headline.apg / headline.topg).toFixed(2) : "—"} rank={ranks.ast_to_ratio ?? null} />
              <StatBlock label="FTA"   value={fmt(headline.fta_pg)} rank={ranks.fta_pg ?? null} />
              <StatBlock label="FG%"   value={headline.fg_pct  != null ? `${headline.fg_pct.toFixed(1)}%`  : "—"} rank={ranks.fg_pct ?? null} />
              <StatBlock label="3P%"   value={headline.fg3_pct != null ? `${headline.fg3_pct.toFixed(1)}%` : "—"} rank={ranks.fg3_pct ?? null} />
              <StatBlock label="TS%"   value={headline.ts_pct  != null ? `${headline.ts_pct.toFixed(1)}%`  : "—"} rank={ranks.ts_pct ?? null} />
            </div>
          </section>
        )}

        {/* Section: Trends */}
        {playedChrono.length > 0 && (
          <section className="mt-24">
            <div className="grid grid-cols-12 gap-8 mb-8 items-end">
              <h2
                className="col-span-7 font-bold tracking-[-0.025em]"
                style={{ fontSize: "clamp(36px, 4vw, 56px)", lineHeight: 1 }}
              >
                Trends
              </h2>
              <div className="col-span-5 text-[11px] text-(--nba-muted) leading-relaxed">
                Per game with {ROLLING}-game rolling average. Reference line locks to regular-season average. Amber bars are playoff games.
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {trendSpecs.map((spec) => (
                <TrendChart
                  key={spec.key}
                  label={spec.label}
                  values={spec.values}
                  rolling={rollingMean(spec.values, ROLLING)}
                  isPlayoff={isPlayoff}
                  color={spec.color}
                  rollingWindow={ROLLING}
                />
              ))}
            </div>
          </section>
        )}

        {/* Section: Scoring distribution */}
        {playedGames.length > 0 && (
          <section className="mt-24">
            <div className="grid grid-cols-12 gap-8 mb-8 items-end">
              <h2
                className="col-span-7 font-bold tracking-[-0.025em]"
                style={{ fontSize: "clamp(36px, 4vw, 56px)", lineHeight: 1 }}
              >
                Scoring shape
              </h2>
              <div className="col-span-5 text-[11px] text-(--nba-muted) leading-relaxed">
                How {player.full_name.split(" ").slice(-1)[0]}&apos;s scoring distributes across {playedGames.length} games this season.
              </div>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
              <div className="lg:col-span-3">
                <DistributionChart values={ptsVals} label="Points" />
              </div>
              <div className="lg:col-span-2 flex flex-col gap-3">
                {hiGame && (
                  <div className="p-5" style={{ background: POP }}>
                    <div className="text-[10px] font-bold tracking-[0.18em] uppercase">
                      Season high
                    </div>
                    <div className="text-4xl font-bold mt-2 tabular-nums">
                      {hiGame.pts} PTS
                    </div>
                    <div className="text-[12px] mt-2 tabular-nums">
                      {hiGame.reb} REB · {hiGame.ast} AST · {hiGame.fgm}/{hiGame.fga} FG
                    </div>
                    <div className="text-[12px] mt-1 text-(--nba-muted)">
                      {hiGame.loc === "A" ? "@" : "vs"} {hiGame.opp} · {formatGameDate(hiGame.date)} · {hiGame.team_wl}{" "}
                      {hiGame.team_pts}-{hiGame.opp_pts}
                      {hiGame.plus_minus != null ? ` · ${fmtSigned(hiGame.plus_minus)}` : ""}
                    </div>
                  </div>
                )}
                {loGame && (
                  <div className="p-5 border border-(--nba-border)">
                    <div className="text-[10px] font-bold tracking-[0.18em] uppercase text-(--nba-muted)">
                      Season low
                    </div>
                    <div className="text-4xl font-semibold mt-2 tabular-nums">
                      {loGame.pts} PTS
                    </div>
                    <div className="text-[12px] mt-2 tabular-nums">
                      {loGame.reb} REB · {loGame.ast} AST · {loGame.fgm}/{loGame.fga} FG
                    </div>
                    <div className="text-[12px] mt-1 text-(--nba-muted)">
                      {loGame.loc === "A" ? "@" : "vs"} {loGame.opp} · {formatGameDate(loGame.date)} · {loGame.team_wl}{" "}
                      {loGame.team_pts}-{loGame.opp_pts}
                      {loGame.plus_minus != null ? ` · ${fmtSigned(loGame.plus_minus)}` : ""}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </section>
        )}

        {/* Section: Game log */}
        <section className="mt-24">
          <div className="grid grid-cols-12 gap-8 mb-8 items-end">
            <h2
              className="col-span-7 font-bold tracking-[-0.025em]"
              style={{ fontSize: "clamp(36px, 4vw, 56px)", lineHeight: 1 }}
            >
              Game log
            </h2>
            <div className="col-span-5 text-[11px] text-(--nba-muted) leading-relaxed">
              Every game including DNPs. {log.length.toLocaleString()} total · {log.filter((g) => g.min != null).length} played.
            </div>
          </div>
          <GameLogTable rows={log} />
        </section>

        {/* Footer breadcrumb */}
        <div className="mt-20 pt-8 border-t border-(--nba-border) flex items-center justify-between text-[11px] text-(--nba-muted)">
          <Link href={`/player/${slug}`} className="hover:text-(--nba-text)">
            ← Back to current design (V0)
          </Link>
          <Link href="/preview" className="hover:text-(--nba-text)">
            All preview variants →
          </Link>
        </div>
      </div>
    </div>
  );
}
