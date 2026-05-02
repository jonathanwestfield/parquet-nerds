// Preview team page — Variant C (stacked rows table)
import { notFound } from "next/navigation";
import Link from "next/link";
import TeamGameLogTableC from "@/components/TeamGameLogTableC";
import { teamByAbbr, teamGameLog, seasonsForTeam } from "@/lib/queries";

type Props = {
  params: Promise<{ abbr: string }>;
  searchParams: Promise<{ season?: string }>;
};

export default async function TeamPreviewC({ params, searchParams }: Props) {
  const { abbr } = await params;
  const { season: seasonParam } = await searchParams;

  const team = teamByAbbr(abbr);
  if (!team) notFound();

  const seasons = seasonsForTeam(team.team_id);
  if (!seasons.length) notFound();

  const season = seasonParam && seasons.includes(seasonParam) ? seasonParam : seasons[0];
  const log = teamGameLog(team.team_id, season);

  const wins   = log.filter((g) => g.wl === "W").length;
  const losses = log.filter((g) => g.wl === "L").length;
  const logoUrl = `https://cdn.nba.com/logos/nba/${team.team_id}/primary/L/logo.svg`;

  return (
    <div>
      {/* Header */}
      <div className="nba-player-header">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logoUrl} alt="" style={{ width: 64, height: 64, objectFit: "contain" }} />
        <div className="nba-player-text">
          <div className="nba-player-name">{team.full_name}</div>
          <div className="nba-player-meta">
            {season} · {wins}-{losses} · {log.length} games
          </div>
        </div>
        <span
          className="text-[10px] font-bold tracking-[0.18em] uppercase"
          style={{ color: "#0891b2" }}
        >
          Preview · Variant C · Stacked rows
        </span>
      </div>

      {/* Season switcher */}
      {seasons.length > 1 && (
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <span className="nba-eyebrow mr-1">Season</span>
          {seasons.map((s) => (
            <Link
              key={s}
              href={`/preview/team-c/${abbr}?season=${s}`}
              className="text-xs px-2.5 py-1 rounded border"
              style={{
                borderColor: s === season ? "var(--nba-text)" : "var(--nba-border)",
                color: s === season ? "var(--nba-text)" : "var(--nba-muted)",
                fontWeight: s === season ? 600 : 500,
              }}
            >
              {s}
            </Link>
          ))}
        </div>
      )}

      <div className="nba-rule" />
      <div className="nba-eyebrow mb-2">Game log — stacked rows variant</div>
      <p className="text-[11px] text-(--nba-muted) mb-3 max-w-2xl">
        Each game = 2 rows. Top row is {team.abbreviation}&apos;s stats. Bottom row (faded) is the opponent&apos;s stats. Compact width, double height.
      </p>
      <TeamGameLogTableC rows={log} teamAbbr={team.abbreviation} />

      <div className="mt-6 flex justify-between text-[11px] text-(--nba-muted)">
        <Link href={`/preview/team-d/${abbr}?season=${season}`}>
          → See variant D (smart cells with delta)
        </Link>
        <Link href="/preview">All previews</Link>
      </div>
    </div>
  );
}
