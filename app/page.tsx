import Link from "next/link";

export default function Home() {
  return (
    <div className="max-w-4xl">
      <div className="nba-eyebrow mb-2">2025-26 season</div>
      <h1 className="text-3xl font-semibold tracking-tight mb-3">
        NBA stats, the way analysts actually want them.
      </h1>
      <p className="text-(--nba-muted) text-base leading-relaxed mb-10">
        Game-by-game breakdowns with conditional formatting, distribution
        charts, and shot data — built for people who read box scores like
        spreadsheets.
      </p>

      <div className="mb-10">
        <div className="nba-eyebrow mb-3">Stats</div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Link
            href="/player/nikola-jokic"
            className="nba-card p-4 hover:border-(--nba-border-2) transition-colors"
          >
            <div className="text-base font-semibold mb-1">Player Logs</div>
            <div className="text-xs text-(--nba-subtle) leading-relaxed">
              Per-game performance with heatmaps, rolling averages, and rank context.
            </div>
          </Link>
          <Link
            href="/series"
            className="nba-card p-4 hover:border-(--nba-border-2) transition-colors"
          >
            <div className="text-base font-semibold mb-1">Series</div>
            <div className="text-xs text-(--nba-subtle) leading-relaxed">
              Playoff deep dives — lineup scatter, comparison tables, game flow, player deltas.
            </div>
          </Link>
          <Link
            href="/preview"
            className="nba-card p-4 hover:border-(--nba-border-2) transition-colors"
          >
            <div className="text-base font-semibold mb-1">Team Games</div>
            <div className="text-xs text-(--nba-subtle) leading-relaxed">
              Team-by-team game logs with offense / defense / diff views. Design preview.
            </div>
          </Link>
        </div>
      </div>

      <div className="mb-10">
        <div className="nba-eyebrow mb-3">Analysis</div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="nba-card p-4 opacity-60">
            <div className="text-base font-semibold mb-1">Weekly articles</div>
            <div className="text-xs text-(--nba-subtle) leading-relaxed">
              Coming soon — a question, a chart, and a take.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
