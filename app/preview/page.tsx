import Link from "next/link";

const PLAYER_VARIANTS = [
  {
    slug: "v0",
    name: "V0 — Current (Linear / Vercel)",
    desc: "What's live now. Hairline borders, restrained color, dense.",
    href: "/player/nikola-jokic",
    status: "live",
  },
  {
    slug: "v1",
    name: "V1 — Editorial (Guste-inspired)",
    desc: "Lexend, sunshine yellow accents, massive section headers, generous whitespace.",
    href: "/preview/v1/nikola-jokic",
    status: "rejected — too big, too airy",
  },
  {
    slug: "v2",
    name: "V2 — Classic Dense",
    desc: "Bordered grid throughout. Small type. No dead space. FBref + printed media guide.",
    href: "/preview/v2/nikola-jokic",
    status: "active direction",
  },
];

const TEAM_VARIANTS = [
  {
    slug: "team-b",
    name: "Team — Variant B — 3-view toggle (Offense / Defense / Diff)",
    desc: "Tabs to swap perspective. Full-cell green/red/yellow tinting in every view. Darker row borders.",
    href: "/preview/team-b/BOS",
    status: "sampling",
  },
  {
    slug: "team-c",
    name: "Team — Variant C — Stacked rows",
    desc: "Each game = 2 rows. Top: team stats. Bottom (faded): opponent stats. Compact width, double height.",
    href: "/preview/team-c/BOS",
    status: "sampling",
  },
  {
    slug: "team-d",
    name: "Team — Variant D — Smart cells with delta",
    desc: "One row per game. Each cell stacks team value, opp value, and the colored delta.",
    href: "/preview/team-d/BOS",
    status: "sampling",
  },
  {
    slug: "team-e",
    name: "Team — Variant E — Stacked rows + color coding",
    desc: "Variant C with team row tinted green/red/yellow per cell based on whether they beat the opponent in that stat.",
    href: "/preview/team-e/BOS",
    status: "sampling",
  },
];

const SAMPLE_PLAYERS = [
  { slug: "nikola-jokic", name: "Nikola Jokic" },
  { slug: "shai-gilgeous-alexander", name: "Shai Gilgeous-Alexander" },
  { slug: "victor-wembanyama", name: "Victor Wembanyama" },
  { slug: "anthony-edwards", name: "Anthony Edwards" },
];

const SAMPLE_TEAMS = [
  { abbr: "BOS", name: "Boston" },
  { abbr: "DEN", name: "Denver" },
  { abbr: "OKC", name: "Oklahoma City" },
  { abbr: "MIN", name: "Minnesota" },
  { abbr: "NYK", name: "New York" },
];

function statusColor(status: string): string {
  return status === "live"
    ? "#16a34a"
    : status === "active direction"
    ? "#0891b2"
    : status === "sampling"
    ? "#d97706"
    : "#a1a1aa";
}

export default function PreviewIndex() {
  return (
    <div>
      <h1 className="text-2xl font-semibold mb-1">Design previews</h1>
      <p className="text-sm text-(--nba-muted) mb-6">
        Same data, different aesthetic. Click through, pick a winner, mix &amp; match.
      </p>

      <div className="nba-eyebrow mb-3">Player page</div>
      <div className="space-y-3 mb-8">
        {PLAYER_VARIANTS.map((v) => (
          <div key={v.slug} className="nba-card p-5">
            <div className="flex items-baseline justify-between gap-4 mb-1.5">
              <h2 className="text-base font-semibold">{v.name}</h2>
              <Link
                href={v.href}
                className="text-xs px-3 py-1.5 rounded border border-(--nba-text) font-medium hover:bg-(--nba-text) hover:text-white transition-colors"
              >
                Open Jokic →
              </Link>
            </div>
            <p className="text-sm text-(--nba-muted) mb-1">{v.desc}</p>
            <p
              className="text-[11px] uppercase tracking-[0.10em] font-bold"
              style={{ color: statusColor(v.status) }}
            >
              {v.status}
            </p>
            <div className="flex flex-wrap gap-2 mt-3">
              <span className="text-[10px] font-bold tracking-[0.18em] uppercase text-(--nba-subtle) self-center mr-2">
                Try
              </span>
              {SAMPLE_PLAYERS.map((p) => {
                const url =
                  v.slug === "v0"
                    ? `/player/${p.slug}`
                    : `/preview/${v.slug}/${p.slug}`;
                return (
                  <Link
                    key={p.slug}
                    href={url}
                    className="text-xs px-2.5 py-1 border border-(--nba-border) rounded hover:border-(--nba-text)"
                  >
                    {p.name}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="nba-eyebrow mb-3">Team page — game-log table layout</div>
      <div className="space-y-3 mb-8">
        {TEAM_VARIANTS.map((v) => (
          <div key={v.slug} className="nba-card p-5">
            <div className="flex items-baseline justify-between gap-4 mb-1.5">
              <h2 className="text-base font-semibold">{v.name}</h2>
              <Link
                href={v.href}
                className="text-xs px-3 py-1.5 rounded border border-(--nba-text) font-medium hover:bg-(--nba-text) hover:text-white transition-colors"
              >
                Open Boston →
              </Link>
            </div>
            <p className="text-sm text-(--nba-muted) mb-1">{v.desc}</p>
            <p
              className="text-[11px] uppercase tracking-[0.10em] font-bold"
              style={{ color: statusColor(v.status) }}
            >
              {v.status}
            </p>
            <div className="flex flex-wrap gap-2 mt-3">
              <span className="text-[10px] font-bold tracking-[0.18em] uppercase text-(--nba-subtle) self-center mr-2">
                Try
              </span>
              {SAMPLE_TEAMS.map((t) => (
                <Link
                  key={t.abbr}
                  href={`/preview/${v.slug}/${t.abbr}`}
                  className="text-xs px-2.5 py-1 border border-(--nba-border) rounded hover:border-(--nba-text)"
                >
                  {t.name}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>

      <p className="text-xs text-(--nba-subtle) mt-8 leading-relaxed max-w-2xl">
        Drop more design references and I&apos;ll spin up new variants — or refine the active direction.
      </p>
    </div>
  );
}
