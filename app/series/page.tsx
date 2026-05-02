// Playoff series index — every postseason matchup in the DB.
// Today: only 2025-26 is loaded; layout is grouped by season so it
// scales cleanly when older years get ingested.
import Link from "next/link";
import { all } from "@/lib/db";

export const dynamic = "force-dynamic";

type SeriesRow = {
  season_label: string;
  a_id: number;
  a_abbr: string;
  a_name: string;
  b_id: number;
  b_abbr: string;
  b_name: string;
  games: number;
  a_wins: number;
  b_wins: number;
  first_game: string;
  last_game: string;
};

function listSeries(): SeriesRow[] {
  return all<SeriesRow>(
    `SELECT
       tg.season_label,
       tg.team_id   AS a_id,
       t1.abbreviation AS a_abbr,
       t1.full_name    AS a_name,
       opp.team_id  AS b_id,
       t2.abbreviation AS b_abbr,
       t2.full_name    AS b_name,
       COUNT(DISTINCT tg.game_id) AS games,
       SUM(CASE WHEN tg.wl  = 'W' THEN 1 ELSE 0 END) AS a_wins,
       SUM(CASE WHEN opp.wl = 'W' THEN 1 ELSE 0 END) AS b_wins,
       MIN(tg.game_date) AS first_game,
       MAX(tg.game_date) AS last_game
     FROM team_games tg
     JOIN team_games opp
       ON opp.game_id = tg.game_id AND opp.team_id != tg.team_id
     JOIN teams t1 ON t1.team_id = tg.team_id
     JOIN teams t2 ON t2.team_id = opp.team_id
     WHERE tg.season_type = 'Playoffs'
       AND tg.team_id < opp.team_id
     GROUP BY tg.season_label, tg.team_id, opp.team_id
     ORDER BY tg.season_label DESC, first_game ASC`,
  );
}

function endYearForLabel(label: string): number {
  // "2024-25" → 2025
  const [start, end2] = label.split("-");
  const startN = parseInt(start, 10);
  const endN = parseInt(end2, 10);
  // Handle century rollover ('99-'00 etc.)
  return startN >= 2000 ? 2000 + endN : (endN >= 50 ? 1900 + endN : 2000 + endN);
}

function slugFor(a: string, b: string, year: number): string {
  return `${a.toLowerCase()}-${b.toLowerCase()}-${year}`;
}

export default function SeriesIndex() {
  const rows = listSeries();

  // Group by season for scalable layout.
  const grouped = new Map<string, SeriesRow[]>();
  for (const r of rows) {
    if (!grouped.has(r.season_label)) grouped.set(r.season_label, []);
    grouped.get(r.season_label)!.push(r);
  }
  const labels = [...grouped.keys()];

  return (
    <div>
      <h1 className="text-xl font-semibold mb-1">Playoff series</h1>
      <p className="text-sm text-(--nba-muted) mb-6">
        Every playoff matchup in the dataset. Click any series for the full
        deep-dive — lineup scatter, comparison tables, game flow, and player
        deltas.
      </p>

      {labels.length === 0 ? (
        <div className="nba-card p-4 text-sm text-(--nba-muted)">
          No playoff games loaded yet. Run the ETL with{" "}
          <code className="text-(--nba-text)">--season-type Playoffs</code>.
        </div>
      ) : (
        labels.map((label) => {
          const seriesList = grouped.get(label)!;
          const year = endYearForLabel(label);
          return (
            <section key={label} className="mb-8">
              <div className="flex items-baseline gap-3 mb-3">
                <div className="nba-eyebrow">{label} Playoffs</div>
                <div className="text-[11px] text-(--nba-subtle)">
                  {seriesList.length} {seriesList.length === 1 ? "series" : "series"}
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {seriesList.map((s) => {
                  const decided = s.a_wins >= 4 || s.b_wins >= 4;
                  const aWon = s.a_wins > s.b_wins;
                  return (
                    <Link
                      key={`${s.a_id}-${s.b_id}-${label}`}
                      href={`/series/${slugFor(s.a_abbr, s.b_abbr, year)}`}
                      className="nba-card p-3 hover:border-(--nba-border-2) transition-colors block"
                    >
                      <div className="flex items-center gap-2 mb-2">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={`https://cdn.nba.com/logos/nba/${s.a_id}/primary/L/logo.svg`}
                          alt=""
                          style={{ width: 28, height: 28, objectFit: "contain" }}
                        />
                        <div className="flex-1 min-w-0">
                          <div
                            className="text-sm font-semibold truncate"
                            style={{
                              color: decided && aWon ? "var(--nba-text)" : decided ? "var(--nba-muted)" : "var(--nba-text)",
                            }}
                          >
                            {s.a_abbr} {s.a_wins}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 mb-2">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={`https://cdn.nba.com/logos/nba/${s.b_id}/primary/L/logo.svg`}
                          alt=""
                          style={{ width: 28, height: 28, objectFit: "contain" }}
                        />
                        <div className="flex-1 min-w-0">
                          <div
                            className="text-sm font-semibold truncate"
                            style={{
                              color: decided && !aWon ? "var(--nba-text)" : decided ? "var(--nba-muted)" : "var(--nba-text)",
                            }}
                          >
                            {s.b_abbr} {s.b_wins}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-baseline justify-between text-[11px] text-(--nba-subtle) tabular-nums pt-1.5 border-t border-(--nba-divider)">
                        <span>{s.games} {s.games === 1 ? "game" : "games"}</span>
                        <span>
                          {decided ? "Final" : "In progress"}
                          {" · "}
                          {s.last_game}
                        </span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </section>
          );
        })
      )}
    </div>
  );
}
