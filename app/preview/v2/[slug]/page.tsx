// Preview variant V2 — "Classic Dense"
// Bordered grid everywhere, small type, no dead space, attention to detail.
// Reference: FBref + a printed media guide + Bloomberg.

import { notFound } from "next/navigation";
import Link from "next/link";
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

const BORDER = "1px solid #d4d4d8";
const BG = "#fafaf7"; // newsprint cream — slightly darker than white

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ season?: string }>;
};

function StatCell({
  label,
  value,
  rank,
}: {
  label: string;
  value: string;
  rank: Rank;
}) {
  let rankColor = "#71717a";
  if (rank) {
    if (rank.rank <= 5) rankColor = "#15803d";
    else if (rank.rank / rank.total <= 0.25) rankColor = "#16a34a";
    else if (rank.rank / rank.total >= 0.75) rankColor = "#dc2626";
  }
  return (
    <div
      style={{
        borderRight: BORDER,
        borderBottom: BORDER,
        padding: "5px 8px",
        background: "#ffffff",
        minWidth: 0,
      }}
    >
      <div
        style={{
          fontSize: 9,
          fontWeight: 700,
          letterSpacing: "0.10em",
          textTransform: "uppercase",
          color: "#71717a",
          lineHeight: 1.2,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 16,
          fontWeight: 600,
          color: "#18181b",
          fontVariantNumeric: "tabular-nums",
          lineHeight: 1.2,
          marginTop: 2,
        }}
      >
        {value}
      </div>
      {rank && (
        <div
          style={{
            fontSize: 9.5,
            color: rankColor,
            fontVariantNumeric: "tabular-nums",
            lineHeight: 1.2,
            marginTop: 2,
            fontWeight: 600,
          }}
        >
          #{rank.rank}
          <span style={{ color: "#a1a1aa", fontWeight: 400 }}>
            {" "}/ {rank.total}
          </span>
        </div>
      )}
    </div>
  );
}

function SectionHeader({ title, sub }: { title: string; sub?: string }) {
  return (
    <div
      style={{
        borderTop: "1.5px solid #18181b",
        borderBottom: BORDER,
        padding: "5px 10px",
        background: "#ffffff",
        display: "flex",
        alignItems: "baseline",
        justifyContent: "space-between",
        gap: 10,
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "0.10em",
          textTransform: "uppercase",
          color: "#18181b",
        }}
      >
        {title}
      </div>
      {sub && (
        <div style={{ fontSize: 10, color: "#71717a", fontVariantNumeric: "tabular-nums" }}>
          {sub}
        </div>
      )}
    </div>
  );
}

export default async function PlayerClassicPreview({
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
    { key: "pts",  label: "Points",           values: ptsVals,  color: "#dc2626" },
    { key: "ast",  label: "Assists",          values: astVals,  color: "#16a34a" },
    { key: "reb",  label: "Rebounds",         values: rebVals,  color: "#2563eb" },
    { key: "fga",  label: "FG attempts",      values: fgaVals,  color: "#0891b2" },
    { key: "fta",  label: "FT attempts",      values: ftaVals,  color: "#a16207" },
    { key: "stk",  label: "Stocks (STL+BLK)", values: stkVals,  color: "#7c3aed" },
    { key: "tov",  label: "Turnovers",        values: tovVals,  color: "#f59e0b" },
    { key: "asto", label: "AST / TO",         values: astoVals, color: "#0d9488" },
  ];

  const playedGames = log.filter((g) => g.min != null && g.pts != null);
  const hiGame = playedGames.length
    ? [...playedGames].sort((a, b) => b.pts! - a.pts!)[0]
    : null;
  const loGame = playedGames.length
    ? [...playedGames].sort((a, b) => a.pts! - b.pts!)[0]
    : null;

  const headlineSummary = headline
    ? `${headline.gp} GP · ${fmt(headline.mpg)} MIN · ${fmt(headline.ppg)}/${fmt(headline.rpg)}/${fmt(headline.apg)}`
    : "";

  return (
    <div style={{ background: BG, minHeight: "100vh", color: "#18181b" }}>
      {/* Top bar — minimal, hairline */}
      <div
        style={{
          background: "#ffffff",
          color: "#18181b",
          padding: "8px 14px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          fontSize: 11,
          letterSpacing: "0.04em",
          borderBottom: BORDER,
        }}
      >
        <Link href="/preview" style={{ fontWeight: 700, color: "#18181b", letterSpacing: "-0.01em" }}>
          parquet nerds<span style={{ color: "#dc2626" }}>.</span>
        </Link>
        <span style={{ color: "#a1a1aa", fontWeight: 600, fontSize: 9.5, letterSpacing: "0.14em", textTransform: "uppercase" }}>
          Preview · V2 · Classic Dense
        </span>
      </div>

      <div style={{ maxWidth: 1320, margin: "0 auto", padding: "0 14px 60px" }}>
        {/* Identity row — bordered grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "60px 1fr auto auto",
            border: BORDER,
            background: "#ffffff",
            marginTop: 12,
          }}
        >
          {/* Photo */}
          <div style={{ borderRight: BORDER, padding: 0, height: 60, overflow: "hidden" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photoUrl}
              alt=""
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                objectPosition: "top",
                background: "#f4f4f5",
              }}
            />
          </div>
          {/* Name + meta */}
          <div style={{ borderRight: BORDER, padding: "8px 12px", display: "flex", flexDirection: "column", justifyContent: "center" }}>
            <div style={{ fontSize: 17, fontWeight: 700, lineHeight: 1.1, letterSpacing: "-0.01em" }}>
              {player.full_name}
            </div>
            <div
              style={{
                fontSize: 10.5,
                color: "#71717a",
                marginTop: 2,
                fontVariantNumeric: "tabular-nums",
                letterSpacing: "0.02em",
              }}
            >
              {team?.full_name ?? "—"} · {season} · {headlineSummary}
            </div>
          </div>
          {/* Team logo */}
          {teamLogoUrl && (
            <div
              style={{
                borderRight: BORDER,
                padding: "8px 14px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 64,
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={teamLogoUrl} alt="" style={{ width: 36, height: 36, objectFit: "contain" }} />
            </div>
          )}
          {/* Season pills */}
          <div style={{ display: "flex", alignItems: "center", padding: "0 8px", gap: 4 }}>
            {seasons.slice(0, 5).map((s) => (
              <Link
                key={s}
                href={`/preview/v2/${slug}?season=${s}`}
                style={{
                  fontSize: 10,
                  fontWeight: s === season ? 700 : 500,
                  letterSpacing: "0.04em",
                  padding: "3px 8px",
                  border: BORDER,
                  background: s === season ? "#18181b" : "#ffffff",
                  color: s === season ? "#fafafa" : "#52525b",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {s}
              </Link>
            ))}
          </div>
        </div>

        {/* Section: Season averages */}
        {headline && (
          <div style={{ marginTop: 14, border: BORDER, borderBottom: "none" }}>
            <SectionHeader
              title="Season averages"
              sub={`Regular season · ranks among ${ranks.ppg?.total ?? "—"} qualified players (≥58 GP)`}
            />
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(11, 1fr)",
                borderTop: "none",
              }}
            >
              <StatCell label="MIN"   value={fmt(headline.mpg)} rank={ranks.mpg ?? null} />
              <StatCell label="PPG"   value={fmt(headline.ppg)} rank={ranks.ppg ?? null} />
              <StatCell label="APG"   value={fmt(headline.apg)} rank={ranks.apg ?? null} />
              <StatCell label="RPG"   value={fmt(headline.rpg)} rank={ranks.rpg ?? null} />
              <StatCell label="STK"   value={fmt(headline.spg + headline.bpg)} rank={ranks.stk_pg ?? null} />
              <StatCell label="TOV"   value={fmt(headline.topg)} rank={ranks.topg ?? null} />
              <StatCell label="AST/TO" value={headline.topg > 0 ? (headline.apg / headline.topg).toFixed(2) : "—"} rank={ranks.ast_to_ratio ?? null} />
              <StatCell label="FTA"   value={fmt(headline.fta_pg)} rank={ranks.fta_pg ?? null} />
              <StatCell label="FG%"   value={headline.fg_pct  != null ? `${headline.fg_pct.toFixed(1)}%`  : "—"} rank={ranks.fg_pct ?? null} />
              <StatCell label="3P%"   value={headline.fg3_pct != null ? `${headline.fg3_pct.toFixed(1)}%` : "—"} rank={ranks.fg3_pct ?? null} />
              <StatCell label="TS%"   value={headline.ts_pct  != null ? `${headline.ts_pct.toFixed(1)}%`  : "—"} rank={ranks.ts_pct ?? null} />
            </div>
          </div>
        )}

        {/* Section: Trends — 4 cols, smaller */}
        {playedChrono.length > 0 && (
          <div style={{ marginTop: 14, border: BORDER, borderBottom: "none" }}>
            <SectionHeader
              title="Trends"
              sub={`Per game with ${ROLLING}-game rolling avg · ref line = reg-season avg · amber bars = playoffs`}
            />
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                background: "#ffffff",
              }}
            >
              {trendSpecs.map((spec, i) => (
                <div
                  key={spec.key}
                  style={{
                    borderRight: i % 3 !== 2 ? BORDER : "none",
                    borderBottom: i < 6 ? BORDER : "none",
                    padding: 6,
                  }}
                >
                  <TrendChart
                    label={spec.label}
                    values={spec.values}
                    rolling={rollingMean(spec.values, ROLLING)}
                    isPlayoff={isPlayoff}
                    color={spec.color}
                    rollingWindow={ROLLING}
                    height={150}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Section: Scoring distribution + callouts — bordered grid */}
        {playedGames.length > 0 && (
          <div style={{ marginTop: 14, border: BORDER, borderBottom: "none" }}>
            <SectionHeader title="Scoring distribution" />
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "3fr 1fr 1fr",
                background: "#ffffff",
              }}
            >
              <div style={{ borderRight: BORDER, padding: 6 }}>
                <DistributionChart values={ptsVals} label="Points" height={170} />
              </div>
              {hiGame && (
                <div style={{ borderRight: BORDER, padding: "10px 12px" }}>
                  <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.10em", textTransform: "uppercase", color: "#16a34a" }}>
                    Season high
                  </div>
                  <div style={{ fontSize: 22, fontWeight: 700, marginTop: 4, fontVariantNumeric: "tabular-nums" }}>
                    {hiGame.pts} <span style={{ fontSize: 11, color: "#71717a", fontWeight: 500 }}>PTS</span>
                  </div>
                  <div style={{ fontSize: 10.5, marginTop: 6, fontVariantNumeric: "tabular-nums", color: "#52525b" }}>
                    {hiGame.reb} REB · {hiGame.ast} AST · {hiGame.fgm}/{hiGame.fga} FG
                  </div>
                  <div style={{ fontSize: 10, marginTop: 3, color: "#71717a" }}>
                    {hiGame.loc === "A" ? "@" : "vs"} {hiGame.opp} · {formatGameDate(hiGame.date)} · {hiGame.team_wl} {hiGame.team_pts}-{hiGame.opp_pts}
                    {hiGame.plus_minus != null ? ` · ${fmtSigned(hiGame.plus_minus)}` : ""}
                  </div>
                </div>
              )}
              {loGame && (
                <div style={{ padding: "10px 12px" }}>
                  <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.10em", textTransform: "uppercase", color: "#dc2626" }}>
                    Season low
                  </div>
                  <div style={{ fontSize: 22, fontWeight: 700, marginTop: 4, fontVariantNumeric: "tabular-nums" }}>
                    {loGame.pts} <span style={{ fontSize: 11, color: "#71717a", fontWeight: 500 }}>PTS</span>
                  </div>
                  <div style={{ fontSize: 10.5, marginTop: 6, fontVariantNumeric: "tabular-nums", color: "#52525b" }}>
                    {loGame.reb} REB · {loGame.ast} AST · {loGame.fgm}/{loGame.fga} FG
                  </div>
                  <div style={{ fontSize: 10, marginTop: 3, color: "#71717a" }}>
                    {loGame.loc === "A" ? "@" : "vs"} {loGame.opp} · {formatGameDate(loGame.date)} · {loGame.team_wl} {loGame.team_pts}-{loGame.opp_pts}
                    {loGame.plus_minus != null ? ` · ${fmtSigned(loGame.plus_minus)}` : ""}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Section: Game log */}
        <div style={{ marginTop: 14 }}>
          <div style={{ border: BORDER, borderBottom: "none" }}>
            <SectionHeader
              title="Game log"
              sub={`${log.length.toLocaleString()} games · ${log.filter((g) => g.min != null).length} played · ${log.filter((g) => g.min == null).length} DNP`}
            />
          </div>
          <GameLogTable rows={log} />
        </div>

        {/* Footer crumbs */}
        <div
          style={{
            marginTop: 18,
            padding: "8px 4px",
            borderTop: BORDER,
            display: "flex",
            justifyContent: "space-between",
            fontSize: 10.5,
            color: "#71717a",
            letterSpacing: "0.04em",
          }}
        >
          <Link href={`/player/${slug}`} style={{ color: "inherit" }}>
            ← Current design (V0)
          </Link>
          <Link href={`/preview/v1/${slug}`} style={{ color: "inherit" }}>
            V1 — Editorial (rejected: too big)
          </Link>
          <Link href="/preview" style={{ color: "inherit" }}>
            All variants →
          </Link>
        </div>
      </div>
    </div>
  );
}
