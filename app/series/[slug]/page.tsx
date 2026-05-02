// Playoff series analysis page — lineup scatter plot.
// Each dot = one 5-man lineup used in the series.
//   X = points per 100 possessions (offensive rating)
//   Y = points allowed per 100 possessions (defensive rating, axis reversed
//       so "better defense" is at the top)
//   Bubble size = total minutes played
//   Color = team
export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import Link from "next/link";
import LineupScatter, { type ScatterPoint } from "@/components/LineupScatter";
import TeamComparisonTable from "@/components/TeamComparisonTable";
import GameFlowGrid from "@/components/GameFlowGrid";
import PlayerDeltaTable from "@/components/PlayerDeltaTable";
import {
  teamByAbbr,
  seriesGames,
  playsForGames,
  gameRoster,
  teamSeasonGameStats,
  teamPbpDerivedStats,
  playerSeriesVsRegSeason,
} from "@/lib/queries";
import {
  computeTeamLineups,
  lineupShortLabel,
  offRating,
  defRating,
  netRating,
  type LineupStat,
} from "@/lib/lineups";

type Props = { params: Promise<{ slug: string }> };

const TEAM_COLOR: Record<string, string> = {
  // Per request: Celtics green, Sixers blue
  BOS: "#16a34a",
  PHI: "#3b82f6",
  // Sensible fallbacks for other teams (used if you change the slug)
  ATL: "#E03A3E", BKN: "#000000", CHA: "#1D1160",
  CHI: "#CE1141", CLE: "#860038", DAL: "#00538C", DEN: "#0E2240",
  DET: "#C8102E", GSW: "#1D428A", HOU: "#CE1141", IND: "#FDBB30",
  LAC: "#C8102E", LAL: "#552583", MEM: "#5D76A9", MIA: "#98002E",
  MIL: "#00471B", MIN: "#0C2340", NOP: "#0C2340", NYK: "#006BB6",
  OKC: "#007AC1", ORL: "#0077C0", PHX: "#1D1160",
  POR: "#E03A3E", SAC: "#5A2D81", SAS: "#000000", TOR: "#CE1141",
  UTA: "#002B5C", WAS: "#002B5C",
};

function parseSlug(slug: string): { a: string; b: string; year: number } | null {
  const parts = slug.toUpperCase().split("-");
  if (parts.length !== 3) return null;
  const [a, b, yearStr] = parts;
  const year = parseInt(yearStr, 10);
  if (Number.isNaN(year)) return null;
  return { a, b, year };
}

function seasonLabelForYear(year: number): string {
  const start = year - 1;
  return `${start}-${String(year).slice(-2)}`;
}

export default async function SeriesPage({ params }: Props) {
  const { slug } = await params;
  const parsed = parseSlug(slug);
  if (!parsed) notFound();

  const teamA = teamByAbbr(parsed.a);
  const teamB = teamByAbbr(parsed.b);
  if (!teamA || !teamB) notFound();

  const seasonLabel = seasonLabelForYear(parsed.year);
  const gamesA = seriesGames(teamA.team_id, teamB.team_id, seasonLabel, "Playoffs");
  if (!gamesA.length) {
    return (
      <div>
        <h1 className="text-xl font-semibold mb-2">{teamA.full_name} vs {teamB.full_name}</h1>
        <p className="text-sm text-(--nba-muted)">
          No playoff games found between these teams in {seasonLabel}.
        </p>
      </div>
    );
  }

  const gameIds = gamesA.map((g) => g.game_id);
  const allPlays = playsForGames(gameIds);
  const playsByGame = new Map<string, typeof allPlays>();
  for (const p of allPlays) {
    if (!playsByGame.has(p.game_id)) playsByGame.set(p.game_id, []);
    playsByGame.get(p.game_id)!.push(p);
  }

  const rosterAByGame = new Map<string, ReturnType<typeof gameRoster>>();
  const rosterBByGame = new Map<string, ReturnType<typeof gameRoster>>();
  for (const gid of gameIds) {
    rosterAByGame.set(gid, gameRoster(gid, teamA.team_id));
    rosterBByGame.set(gid, gameRoster(gid, teamB.team_id));
  }

  // For team B's analysis, flip is_home so score deltas come out right.
  const gamesB = gamesA.map((g) => ({
    ...g,
    team_id: g.opp_team_id,
    opp_team_id: g.team_id,
    is_home: (g.is_home === 1 ? 0 : 1) as 0 | 1,
    pts: g.opp_pts,
    opp_pts: g.pts,
    wl: (g.wl === "W" ? "L" : "W") as "W" | "L",
  }));

  const lineupsA = computeTeamLineups(gamesA, rosterAByGame, playsByGame, teamA.team_id);
  const lineupsB = computeTeamLineups(gamesB, rosterBByGame, playsByGame, teamB.team_id);

  const winsA = gamesA.filter((g) => g.wl === "W").length;
  const winsB = gamesA.length - winsA;

  // Filters: only show lineups with meaningful sample size
  const MIN_MINUTES = 8.0;
  const MIN_POSS = 5;

  const toScatter = (lineups: LineupStat[], teamAbbr: string): ScatterPoint[] =>
    lineups
      .filter((l) => l.seconds / 60 >= MIN_MINUTES && l.team_poss >= MIN_POSS && l.opp_poss >= MIN_POSS)
      .map((l) => ({
        team: teamAbbr,
        label: lineupShortLabel(l),
        off: offRating(l),
        def: defRating(l),
        netRtg: netRating(l),
        minutes: l.seconds / 60,
      }));

  const scatterPoints = [
    ...toScatter(lineupsA, teamA.abbreviation),
    ...toScatter(lineupsB, teamB.abbreviation),
  ];

  // Sanity totals — answers "do all the lineups add to 6 × 48 min?"
  const totalMinA = lineupsA.reduce((s, l) => s + l.seconds, 0) / 60;
  const totalMinB = lineupsB.reduce((s, l) => s + l.seconds, 0) / 60;
  const expectedMin = 48 * gamesA.length; // ignores OT — 288 for 6 games
  const totalPmA = lineupsA.reduce((s, l) => s + (l.pts_for - l.pts_against), 0);
  const totalPmB = lineupsB.reduce((s, l) => s + (l.pts_for - l.pts_against), 0);

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-4 mb-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`https://cdn.nba.com/logos/nba/${teamA.team_id}/primary/L/logo.svg`} alt="" style={{ width: 48, height: 48, objectFit: "contain" }} />
        <h1 className="text-xl font-semibold">
          {teamA.full_name} vs {teamB.full_name}
        </h1>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`https://cdn.nba.com/logos/nba/${teamB.team_id}/primary/L/logo.svg`} alt="" style={{ width: 48, height: 48, objectFit: "contain" }} />
        <span className="text-sm text-(--nba-muted) ml-auto">
          {seasonLabel} Playoffs · {gamesA.length} games · {winsA}-{winsB}
        </span>
      </div>

      {/* Order:
          1. Cumulative scoring grid (game flow per game)
          2. Player deltas (each team)
          3. Reg-season vs playoff series comparison table
          4. Lineups bar charts (each team)
          5. Lineup scatter plot
       */}

      {/* 1. Cumulative scoring per game */}
      <GameFlowGrid
        teamAAbbr={teamA.abbreviation}
        teamBAbbr={teamB.abbreviation}
        teamAColor={TEAM_COLOR[teamA.abbreviation] ?? "#16a34a"}
        teamBColor={TEAM_COLOR[teamB.abbreviation] ?? "#3b82f6"}
        games={gamesA.map((g) => ({
          game_id: g.game_id,
          game_date: g.game_date,
          is_home: g.is_home,
          pts: g.pts,
          opp_pts: g.opp_pts,
          wl: g.wl,
        }))}
        playsByGame={playsByGame}
      />

      {/* 2. Player deltas — series vs reg-season */}
      <PlayerDeltaTable
        title={`${teamA.full_name} — players: series vs reg-season`}
        teamColor={TEAM_COLOR[teamA.abbreviation] ?? "#0f172a"}
        players={playerSeriesVsRegSeason(teamA.team_id, seasonLabel, gameIds)}
      />
      <PlayerDeltaTable
        title={`${teamB.full_name} — players: series vs reg-season`}
        teamColor={TEAM_COLOR[teamB.abbreviation] ?? "#0f172a"}
        players={playerSeriesVsRegSeason(teamB.team_id, seasonLabel, gameIds)}
      />

      {/* 3. Reg-season vs playoff series team comparison */}
      <TeamComparisonTable
        teams={[
          {
            abbreviation: teamA.abbreviation,
            full_name: teamA.full_name,
            team_id: teamA.team_id,
            color: TEAM_COLOR[teamA.abbreviation] ?? "#0f172a",
            games: teamSeasonGameStats(teamA.team_id, seasonLabel),
            pbpStats: teamPbpDerivedStats(teamA.team_id, seasonLabel),
            seriesGameInfo: gamesA.map((g) => ({
              game_id: g.game_id, wl: g.wl, pts: g.pts, opp_pts: g.opp_pts,
            })),
          },
          {
            abbreviation: teamB.abbreviation,
            full_name: teamB.full_name,
            team_id: teamB.team_id,
            color: TEAM_COLOR[teamB.abbreviation] ?? "#0f172a",
            games: teamSeasonGameStats(teamB.team_id, seasonLabel),
            pbpStats: teamPbpDerivedStats(teamB.team_id, seasonLabel),
            seriesGameInfo: gamesB.map((g) => ({
              game_id: g.game_id, wl: g.wl, pts: g.pts, opp_pts: g.opp_pts,
            })),
          },
        ]}
      />

      {/* 4. Top-20 lineup bar charts per team */}
      <LineupBarTable
        title={`${teamA.full_name} — top 20 lineups by minutes`}
        teamColor={TEAM_COLOR[teamA.abbreviation] ?? "#0f172a"}
        lineups={lineupsA}
        topN={19}
        games={gamesA.map((g) => ({
          game_id: g.game_id,
          wl: g.wl,
          pts: g.pts,
          opp_pts: g.opp_pts,
        }))}
      />
      <LineupBarTable
        title={`${teamB.full_name} — top 20 lineups by minutes`}
        teamColor={TEAM_COLOR[teamB.abbreviation] ?? "#0f172a"}
        lineups={lineupsB}
        topN={19}
        games={gamesB.map((g) => ({
          game_id: g.game_id,
          wl: g.wl,
          pts: g.pts,
          opp_pts: g.opp_pts,
        }))}
      />

      {/* 5. Lineup scatter plot */}
      <p className="text-xs text-(--nba-muted) mb-3 mt-6 max-w-3xl leading-relaxed">
        <b>Lineup efficiency scatter:</b> each dot is a 5-man lineup.{" "}
        <b>X</b> = points per 100 possessions (offense — further right is better).{" "}
        <b>Y</b> = points allowed per 100 possessions (defense — axis reversed, further <i>up</i> is better).{" "}
        <b>Bubble size</b> = total minutes played.{" "}
        <b style={{ color: TEAM_COLOR[teamA.abbreviation] }}>{teamA.abbreviation}</b> /{" "}
        <b style={{ color: TEAM_COLOR[teamB.abbreviation] }}>{teamB.abbreviation}</b>{" "}
        colored by team. Top-right = best, bottom-left = worst.
      </p>
      <div className="nba-card p-4 mb-4">
        <LineupScatter
          data={scatterPoints}
          teamColors={TEAM_COLOR}
        />
      </div>

      {/* Sanity totals */}
      <div className="text-[11px] text-(--nba-muted) mb-6 grid grid-cols-2 gap-4 max-w-3xl">
        <div className="nba-card p-3">
          <div className="nba-eyebrow mb-1" style={{ color: TEAM_COLOR[teamA.abbreviation] }}>{teamA.abbreviation}</div>
          <div className="tabular-nums">
            {lineupsA.length} unique lineups · {totalMinA.toFixed(1)} min accounted (expected ≈ {expectedMin})
          </div>
          <div className="tabular-nums">
            Σ +/- across lineups: <b className={totalPmA >= 0 ? "text-(--nba-good)" : "text-(--nba-bad)"}>{totalPmA > 0 ? "+" : ""}{totalPmA}</b> · series net: {gamesA.reduce((s, g) => s + (g.pts - g.opp_pts), 0)}
          </div>
        </div>
        <div className="nba-card p-3">
          <div className="nba-eyebrow mb-1" style={{ color: TEAM_COLOR[teamB.abbreviation] }}>{teamB.abbreviation}</div>
          <div className="tabular-nums">
            {lineupsB.length} unique lineups · {totalMinB.toFixed(1)} min accounted (expected ≈ {expectedMin})
          </div>
          <div className="tabular-nums">
            Σ +/- across lineups: <b className={totalPmB >= 0 ? "text-(--nba-good)" : "text-(--nba-bad)"}>{totalPmB > 0 ? "+" : ""}{totalPmB}</b> · series net: {gamesA.reduce((s, g) => s + (g.opp_pts - g.pts), 0)}
          </div>
        </div>
      </div>

      {/* Game-by-game footer */}
      <div className="nba-eyebrow mb-2">Series games</div>
      <div className="text-xs text-(--nba-muted) flex flex-wrap gap-3">
        {gamesA.map((g, i) => (
          <span key={g.game_id} className="tabular-nums">
            G{i + 1} · {g.game_date} · {teamA.abbreviation}{" "}
            <span className={g.wl === "W" ? "font-semibold text-(--nba-good)" : "font-semibold text-(--nba-bad)"}>
              {g.wl}
            </span>{" "}
            {g.pts}-{g.opp_pts}
          </span>
        ))}
      </div>

      <div className="mt-8 text-[11px] text-(--nba-muted)">
        <Link href="/" className="hover:underline">← Home</Link>
      </div>
    </div>
  );
}

type GameInfo = { game_id: string; wl: "W" | "L"; pts: number; opp_pts: number };

function LineupBarTable({
  title,
  teamColor,
  lineups,
  topN,
  games,
}: {
  title: string;
  teamColor: string;
  lineups: LineupStat[];
  topN: number;
  games: GameInfo[];
}) {
  // Sort by total minutes descending
  const sorted = [...lineups].sort((a, b) => b.seconds - a.seconds);
  const top = sorted.slice(0, topN);
  const rest = sorted.slice(topN);

  // Each game = 48 min × 60 = 2880 sec total floor time per team
  const gameTotalSec = 48 * 60;
  const gameIds = games.map((g) => g.game_id);

  type PlayerChip = { id: number; lastName: string };
  type Row = {
    label: string;            // text-only fallback (used in the all-else row + tooltip)
    players: PlayerChip[];    // empty for all-else row
    minutes: number;
    plusMinus: number;
    isAll: boolean;
    gameSec: number[];
    gamePm: number[];
  };

  const stripInitial = (n: string) => {
    const i = n.indexOf(". ");
    return i >= 0 ? n.slice(i + 2) : n;
  };

  const rows: Row[] = top.map((l) => {
    // Pair player_id with stripped last name, then sort alphabetically.
    const players: PlayerChip[] = l.players
      .map((id, i) => ({ id, lastName: stripInitial(l.player_names[i]) }))
      .sort((a, b) => a.lastName.localeCompare(b.lastName, "en", { sensitivity: "base" }));
    return {
      label: lineupShortLabel(l),
      players,
      minutes: l.seconds / 60,
      plusMinus: l.pts_for - l.pts_against,
      isAll: false,
      gameSec: gameIds.map((gid) => l.seconds_by_game.get(gid) ?? 0),
      gamePm: gameIds.map((gid) =>
        (l.pts_for_by_game.get(gid) ?? 0) - (l.pts_against_by_game.get(gid) ?? 0),
      ),
    };
  });
  if (rest.length > 0) {
    const restMin = rest.reduce((s, l) => s + l.seconds, 0) / 60;
    const restPm  = rest.reduce((s, l) => s + (l.pts_for - l.pts_against), 0);
    const restGameSec = gameIds.map((gid) =>
      rest.reduce((s, l) => s + (l.seconds_by_game.get(gid) ?? 0), 0),
    );
    const restGamePm = gameIds.map((gid) =>
      rest.reduce((s, l) =>
        s + (l.pts_for_by_game.get(gid) ?? 0) - (l.pts_against_by_game.get(gid) ?? 0), 0),
    );
    rows.push({
      label: `All else (${rest.length} lineups)`,
      players: [],
      minutes: restMin,
      plusMinus: restPm,
      isAll: true,
      gameSec: restGameSec,
      gamePm: restGamePm,
    });
  }

  const maxMin = Math.max(...rows.map((r) => r.minutes), 1);
  const totalMin = rows.reduce((s, r) => s + r.minutes, 0);
  const totalPm  = rows.reduce((s, r) => s + r.plusMinus, 0);
  const gameTotalsSec = gameIds.map((_, gi) => rows.reduce((s, r) => s + r.gameSec[gi], 0));
  const gameTotalsPm  = gameIds.map((_, gi) => rows.reduce((s, r) => s + r.gamePm[gi], 0));

  // For color scaling: find max abs +/- in any per-game cell
  const maxAbsGamePm = Math.max(
    1,
    ...rows.flatMap((r) => r.gamePm.map((v) => Math.abs(v))),
  );

  // Parse the team color hex to rgb for tinting
  const hexToRgb = (h: string): [number, number, number] => {
    const c = h.replace("#", "");
    return [parseInt(c.slice(0, 2), 16), parseInt(c.slice(2, 4), 16), parseInt(c.slice(4, 6), 16)];
  };
  const [tR, tG, tB] = hexToRgb(teamColor);

  // Layout: Lineup (faces + names) | Bar ‖ Total (min/+/-) ‖ G1 | G2 | ... | G6
  const gridTemplate =
    `minmax(0,3fr) minmax(0,2.6fr) 60px ${gameIds.map(() => "60px").join(" ")}`;
  const STRONG_BORDER = "2px solid #a1a1aa";

  const dash = (
    <span style={{ color: "var(--nba-subtle)", fontSize: "8px", display: "inline-block", lineHeight: "13px" }}>—</span>
  );

  return (
    <div className="nba-card p-3 mb-3">
      <div className="mb-2">
        <div className="nba-eyebrow" style={{ color: teamColor }}>{title}</div>
        <div className="text-[10px] text-(--nba-muted) mt-0.5">
          Sorted by total minutes. Each Total / G1-G6 cell stacks{" "}
          <b>minutes played</b> (top) over{" "}
          <b>+/-</b> (bottom). Tints show heat: team color = more minutes; green/red = bigger +/-.
        </div>
      </div>
      {/* Header — 2 rows: column labels + (for game cols) game result */}
      <div
        className="font-mono text-[10px] uppercase tracking-[0.10em] text-(--nba-subtle) grid items-end gap-x-2 pb-1 border-b border-(--nba-border)"
        style={{ gridTemplateColumns: gridTemplate }}
      >
        <div>Lineup</div>
        <div>Minutes</div>
        <div
          className="text-center font-bold text-(--nba-text)"
          style={{
            borderLeft: STRONG_BORDER,
            borderRight: STRONG_BORDER,
            paddingLeft: 2,
            paddingRight: 2,
          }}
        >
          <div>Total</div>
          <div className="text-[8.5px] font-normal text-(--nba-subtle)" style={{ textTransform: "none" }}>
            series
          </div>
          <div className="text-[8px] font-normal text-(--nba-subtle) mt-0.5 leading-[10px]" style={{ textTransform: "none" }}>
            <div>min</div>
            <div>+/-</div>
          </div>
        </div>
        {games.map((g, i) => (
          <div
            key={i}
            className="text-center"
            style={{
              paddingLeft: 2,
              paddingRight: 2,
              borderRight: i < games.length - 1 ? "1px solid var(--nba-border)" : undefined,
            }}
          >
            <div className="font-bold" style={{ color: g.wl === "W" ? "var(--nba-good)" : "var(--nba-bad)" }}>
              G{i + 1}
            </div>
            <div className="text-[8.5px] font-normal" style={{ color: g.wl === "W" ? "var(--nba-good)" : "var(--nba-bad)", textTransform: "none" }}>
              {g.wl} {g.pts}-{g.opp_pts}
            </div>
            <div className="text-[8px] font-normal text-(--nba-subtle) mt-0.5 leading-[10px]" style={{ textTransform: "none" }}>
              <div>min</div>
              <div>+/-</div>
            </div>
          </div>
        ))}
      </div>
      <div>
        {rows.map((r, i) => {
          const widthPct = (r.minutes / maxMin) * 100;
          const rowBorder = i === rows.length - 1
            ? undefined
            : (i + 1) % 5 === 0
              ? "1px solid var(--nba-border-2)"
              : "1px solid var(--nba-divider)";
          // For the Total cell heatmap, scale by series total (288 min)
          const totalShare = totalMin > 0 ? (r.minutes / totalMin) : 0;
          const totalMinAlpha = Math.min(0.55, totalShare / 0.20 * 0.45); // ~20% share = full tint
          const totalMinBg = r.minutes === 0 ? "transparent" : `rgba(${tR}, ${tG}, ${tB}, ${totalMinAlpha})`;
          const maxAbsTotalPm = Math.max(1, ...rows.map(rr => Math.abs(rr.plusMinus)));
          const totalPmAlpha = Math.min(0.40, Math.abs(r.plusMinus) / maxAbsTotalPm * 0.40);
          let totalPmBg = "transparent";
          let totalPmText = "var(--nba-subtle)";
          if (r.plusMinus > 0) { totalPmBg = `rgba(22, 163, 74, ${totalPmAlpha})`; totalPmText = "#15803d"; }
          else if (r.plusMinus < 0) { totalPmBg = `rgba(220, 38, 38, ${totalPmAlpha})`; totalPmText = "#b91c1c"; }
          return (
            <div
              key={i}
              className="grid items-center py-0.5 gap-x-2"
              style={{ gridTemplateColumns: gridTemplate, borderBottom: rowBorder }}
            >
              <div className="flex items-center gap-1.5 min-w-0" title={r.label}>
                {r.players.length > 0 ? (
                  <>
                    <div className="flex -space-x-1.5 shrink-0">
                      {r.players.map((p) => (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          key={p.id}
                          src={`https://cdn.nba.com/headshots/nba/latest/260x190/${p.id}.png`}
                          alt={p.lastName}
                          title={p.lastName}
                          width={22}
                          height={22}
                          style={{
                            width: 22,
                            height: 22,
                            borderRadius: "50%",
                            objectFit: "cover",
                            objectPosition: "top",
                            background: "var(--nba-divider)",
                            border: `1.5px solid ${teamColor}`,
                          }}
                        />
                      ))}
                    </div>
                    <div className="text-[11px] text-(--nba-text) truncate">
                      {r.players.map((p) => p.lastName).join(" / ")}
                    </div>
                  </>
                ) : (
                  <div className="text-[11px] italic text-(--nba-muted) truncate">
                    {r.label}
                  </div>
                )}
              </div>
              <div className="relative h-4 bg-(--nba-divider) rounded-sm overflow-hidden">
                <div
                  style={{
                    width: `${widthPct}%`,
                    background: teamColor,
                    opacity: r.isAll ? 0.45 : 0.85,
                    height: "100%",
                  }}
                />
              </div>
              {/* Total cell: stacked min (top) / +/- (bottom), strong borders both sides */}
              <div
                className="flex flex-col"
                style={{ borderLeft: STRONG_BORDER, borderRight: STRONG_BORDER }}
              >
                <div
                  className="text-[10px] tabular-nums text-center font-bold"
                  style={{
                    background: totalMinBg,
                    color: r.minutes === 0 ? "var(--nba-subtle)" : "#18181b",
                    padding: "0 2px",
                    lineHeight: "14px",
                  }}
                >
                  {Math.round(r.minutes)}
                </div>
                <div
                  className="text-[10px] tabular-nums text-center font-bold"
                  style={{
                    background: totalPmBg,
                    color: totalPmText,
                    padding: "0 2px",
                    lineHeight: "14px",
                  }}
                >
                  {r.plusMinus > 0 ? `+${r.plusMinus}` : `${r.plusMinus}`}
                </div>
              </div>
              {/* Per-game cells: stacked min (top) + +/- (bottom), heatmapped */}
              {r.gameSec.map((sec, gi) => {
                const min = sec / 60;
                const pm  = r.gamePm[gi];
                // Minutes heatmap based on share of game (out of 48)
                const minAlpha = Math.min(0.55, (min / 24) * 0.45); // 24 min = full tint
                const minBg = min === 0 ? "transparent" : `rgba(${tR}, ${tG}, ${tB}, ${minAlpha})`;
                const pmAlpha = Math.min(0.40, Math.abs(pm) / maxAbsGamePm * 0.40);
                let pmBg = "transparent";
                let pmText = "var(--nba-subtle)";
                if (pm > 0) { pmBg = `rgba(22, 163, 74, ${pmAlpha})`; pmText = "#15803d"; }
                else if (pm < 0) { pmBg = `rgba(220, 38, 38, ${pmAlpha})`; pmText = "#b91c1c"; }
                return (
                  <div
                    key={gi}
                    className="flex flex-col"
                    style={{
                      borderRight: gi < games.length - 1 ? "1px solid var(--nba-border)" : undefined,
                    }}
                  >
                    <div
                      className="text-[9px] tabular-nums text-center font-medium"
                      style={{
                        background: minBg,
                        color: min === 0 ? "var(--nba-subtle)" : "#18181b",
                        padding: "0 2px",
                        lineHeight: "13px",
                      }}
                      title={`${min.toFixed(1)} min`}
                    >
                      {min === 0 ? dash : Math.round(min)}
                    </div>
                    <div
                      className="text-[9px] tabular-nums text-center font-semibold"
                      style={{
                        background: pmBg,
                        color: pmText,
                        padding: "0 2px",
                        lineHeight: "13px",
                      }}
                    >
                      {pm === 0 && min === 0 ? dash : (pm > 0 ? `+${pm}` : `${pm}`)}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
      {/* Totals footer */}
      <div
        className="grid items-center pt-1.5 mt-0.5 border-t-2 border-(--nba-border-2) gap-x-2"
        style={{ gridTemplateColumns: gridTemplate }}
      >
        <div className="text-[11px] uppercase tracking-[0.10em] font-bold text-(--nba-text)">
          Total
        </div>
        <div></div>
        <div
          className="flex flex-col"
          style={{ borderLeft: STRONG_BORDER, borderRight: STRONG_BORDER }}
        >
          <div className="text-[10px] tabular-nums text-center font-bold text-(--nba-text)" style={{ lineHeight: "14px" }}>
            {Math.round(totalMin)}
          </div>
          <div
            className={`text-[10px] tabular-nums text-center font-bold ${totalPm >= 0 ? "text-(--nba-good)" : "text-(--nba-bad)"}`}
            style={{ lineHeight: "14px" }}
          >
            {totalPm > 0 ? "+" : ""}{totalPm}
          </div>
        </div>
        {gameTotalsSec.map((t, gi) => {
          const totalPmGame = gameTotalsPm[gi];
          return (
            <div
              key={gi}
              className="flex flex-col"
              style={{
                borderRight: gi < games.length - 1 ? "1px solid var(--nba-border)" : undefined,
              }}
            >
              <div className="text-[10px] tabular-nums text-center font-bold text-(--nba-text)" style={{ lineHeight: "14px" }}>
                {Math.round(t / 60)}
              </div>
              <div
                className={`text-[10px] tabular-nums text-center font-bold ${totalPmGame >= 0 ? "text-(--nba-good)" : "text-(--nba-bad)"}`}
                style={{ lineHeight: "14px" }}
              >
                {totalPmGame > 0 ? "+" : ""}{totalPmGame}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
