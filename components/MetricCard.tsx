import type { Rank } from "@/lib/ranks";

type Props = {
  label: string;
  value: string;
  sub?: string;
  rank?: Rank;
};

function rankColor(rank: number, total: number): string {
  // Top 5 → green, top 25th pctile → muted green, bottom 25th → red, else neutral
  if (rank <= 5) return "var(--nba-good)";
  const pct = rank / total;
  if (pct <= 0.25) return "#15803d";
  if (pct >= 0.75) return "var(--nba-bad)";
  return "var(--nba-muted)";
}

export default function MetricCard({ label, value, sub, rank }: Props) {
  return (
    <div className="nba-metric">
      <div className="nba-metric-label">{label}</div>
      <div className="nba-metric-value">{value}</div>
      {rank ? (
        <div
          className="nba-metric-sub"
          style={{ color: rankColor(rank.rank, rank.total), fontWeight: 600 }}
          title={`${rank.rank} of ${rank.total} qualified players`}
        >
          #{rank.rank}
          <span style={{ color: "var(--nba-subtle)", fontWeight: 400 }}>
            {" "}/ {rank.total}
          </span>
        </div>
      ) : sub ? (
        <div className="nba-metric-sub">{sub}</div>
      ) : null}
    </div>
  );
}
