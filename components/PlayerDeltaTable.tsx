// Per-player table: how is each player performing in the playoff series
// vs their regular-season averages? One row per player. Cell content =
// absolute delta (large), with % delta + reg→series in small text.

import type { PlayerSeriesVsReg } from "@/lib/queries";

type Stat = {
  key: string;
  label: string;
  /** Higher is better (true) | lower is better (false) | neutral (undefined) */
  higherIsBetter?: boolean;
  decimals: number;
  suffix?: string;
  /** Pull the value from a player record, given prefix "r_" or "s_" */
  pick: (p: PlayerSeriesVsReg, prefix: "r" | "s") => number | null | undefined;
};

const STATS: Stat[] = [
  { key: "min",    label: "MIN", higherIsBetter: true,  decimals: 1, pick: (p, x) => x === "r" ? p.r_min   : p.s_min },
  { key: "pts",    label: "PTS", higherIsBetter: true,  decimals: 1, pick: (p, x) => x === "r" ? p.r_pts   : p.s_pts },
  { key: "reb",    label: "REB", higherIsBetter: true,  decimals: 1, pick: (p, x) => x === "r" ? p.r_reb   : p.s_reb },
  { key: "ast",    label: "AST", higherIsBetter: true,  decimals: 1, pick: (p, x) => x === "r" ? p.r_ast   : p.s_ast },
  { key: "stocks", label: "STK", higherIsBetter: true,  decimals: 1, pick: (p, x) => x === "r" ? p.r_stocks: p.s_stocks },
  { key: "tov",    label: "TOV", higherIsBetter: false, decimals: 1, pick: (p, x) => x === "r" ? p.r_tov   : p.s_tov },
  { key: "fga",    label: "FGA", higherIsBetter: true,  decimals: 1, pick: (p, x) => x === "r" ? p.r_fga   : p.s_fga },
  { key: "fg_pct", label: "FG%", higherIsBetter: true,  decimals: 0, suffix: "%", pick: (p, x) => x === "r" ? p.r_fg_pct : p.s_fg_pct },
  { key: "fta",    label: "FTA", higherIsBetter: true,  decimals: 1, pick: (p, x) => x === "r" ? p.r_fta   : p.s_fta },
  { key: "ft_pct", label: "FT%", higherIsBetter: true,  decimals: 0, suffix: "%", pick: (p, x) => x === "r" ? p.r_ft_pct : p.s_ft_pct },
];

/**
 * Color from t in [0, 1] using red → yellow → green linear interp.
 * 0 = full red, 0.5 = pure yellow, 1 = full green.
 */
function tintFromT(t: number): React.CSSProperties {
  if (!Number.isFinite(t)) return {};
  let r, g, b;
  if (t < 0.5) {
    const k = t * 2;
    r = 220 + (234 - 220) * k;
    g = 38  + (179 - 38)  * k;
    b = 38  + (8   - 38)  * k;
  } else {
    const k = (t - 0.5) * 2;
    r = 234 + (22  - 234) * k;
    g = 179 + (163 - 179) * k;
    b = 8   + (74  - 8)   * k;
  }
  return { backgroundColor: `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, 0.18)` };
}

function fmt(v: number | null | undefined, decimals: number, suffix?: string): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return `${v.toFixed(decimals)}${suffix ?? ""}`;
}

function fmtSigned(v: number, decimals: number, suffix?: string): string {
  const sign = v > 0 ? "+" : "";
  return `${sign}${v.toFixed(decimals)}${suffix ?? ""}`;
}

type Props = {
  title: string;
  teamColor: string;
  players: PlayerSeriesVsReg[];
};

export default function PlayerDeltaTable({ title, teamColor, players }: Props) {
  // Filter to players who actually played meaningful series minutes
  const visible = players.filter((p) => p.s_min >= 1).sort((a, b) => b.s_min - a.s_min);
  if (!visible.length) {
    return (
      <div className="nba-card p-4 mb-4">
        <div className="nba-eyebrow" style={{ color: teamColor }}>{title}</div>
        <p className="text-[11px] text-(--nba-subtle) mt-2">No player data.</p>
      </div>
    );
  }

  const STRONG_BORDER = "2px solid #a1a1aa";

  // ---------- Per-column linear scaling, anchored at 0 = yellow ----------
  // For each column, compute min/max of direction-flipped absolute deltas.
  // Then for each cell:
  //   t > 0.5 (above 0)  → yellow → green, scaled by val/columnMaxPositive
  //   t < 0.5 (below 0)  → red → yellow, scaled by val/columnMinNegative
  //   t = 0.5 (at 0)     → pure yellow
  // This way: most-negative absolute delta in column = full red,
  // most-positive = full green, intermediate values get linear shades.
  const colRange = new Map<string, { posMax: number; negMin: number }>();
  for (const s of STATS) {
    const deltas: number[] = [];
    for (const p of visible) {
      const reg = s.pick(p, "r");
      const ser = s.pick(p, "s");
      if (reg == null || ser == null || !Number.isFinite(reg) || !Number.isFinite(ser)) continue;
      const directional = (ser - reg) * (s.higherIsBetter === false ? -1 : 1);
      deltas.push(directional);
    }
    if (!deltas.length) {
      colRange.set(s.key, { posMax: 0, negMin: 0 });
      continue;
    }
    const posMax = Math.max(0, ...deltas);
    const negMin = Math.min(0, ...deltas);
    colRange.set(s.key, { posMax, negMin });
  }

  // Maps a directional delta to t in [0,1] via the column's min/max
  const deltaT = (statKey: string, directional: number): number => {
    const range = colRange.get(statKey);
    if (!range) return 0.5;
    if (directional > 0) {
      return range.posMax > 0 ? 0.5 + 0.5 * (directional / range.posMax) : 0.5;
    } else if (directional < 0) {
      return range.negMin < 0 ? 0.5 - 0.5 * (directional / range.negMin) : 0.5;
    }
    return 0.5;
  };
  // grid: name | stat columns
  const gridTemplate = `minmax(0,1.7fr) ${STATS.map(() => "minmax(0,1fr)").join(" ")}`;

  return (
    <div className="nba-card p-3 mb-4">
      <div className="mb-2">
        <div className="nba-eyebrow" style={{ color: teamColor }}>{title}</div>
        <div className="text-[10px] text-(--nba-muted) mt-0.5 leading-relaxed">
          Each cell shows <b>absolute delta</b> (series avg − reg-season avg) on top, then{" "}
          <b>% delta</b> and <b>reg → series</b> raw values below. Tinted vs reg baseline (green = better, red = worse).
        </div>
      </div>

      {/* Header */}
      <div
        className="grid items-end pb-1 border-b-2 border-(--nba-border-2) font-mono text-[10px] uppercase tracking-[0.10em] text-(--nba-subtle)"
        style={{ gridTemplateColumns: gridTemplate }}
      >
        <div className="px-2">Player</div>
        {STATS.map((s, i) => (
          <div
            key={s.key}
            className="text-center px-1"
            style={{ borderLeft: i === 0 ? STRONG_BORDER : "1px solid var(--nba-border)" }}
          >
            {s.label}
          </div>
        ))}
      </div>

      <div>
        {visible.map((p, idx) => (
          <div
            key={p.player_id}
            className="grid items-stretch"
            style={{
              gridTemplateColumns: gridTemplate,
              borderBottom: idx < visible.length - 1 ? "1px solid var(--nba-divider)" : undefined,
            }}
          >
            {/* Player ID column */}
            <div className="flex items-center gap-2 px-2 py-1">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`https://cdn.nba.com/headshots/nba/latest/260x190/${p.player_id}.png`}
                alt=""
                width={26}
                height={26}
                style={{
                  width: 26, height: 26, borderRadius: "50%", objectFit: "cover",
                  objectPosition: "top", background: "var(--nba-divider)",
                  border: `1.5px solid ${teamColor}`,
                  flexShrink: 0,
                }}
              />
              <div className="min-w-0">
                <div className="text-[12px] font-medium truncate">{p.player_name}</div>
                <div className="text-[9px] text-(--nba-subtle) tabular-nums">
                  {p.series_games}/{p.reg_games} GP
                </div>
              </div>
            </div>

            {/* Stat cells */}
            {STATS.map((s, i) => {
              const reg = s.pick(p, "r");
              const ser = s.pick(p, "s");
              if (reg == null || ser == null || !Number.isFinite(reg) || !Number.isFinite(ser)) {
                return (
                  <div
                    key={s.key}
                    className="flex items-center justify-center text-[10px] text-(--nba-subtle)"
                    style={{ borderLeft: i === 0 ? STRONG_BORDER : "1px solid var(--nba-border)" }}
                  >
                    —
                  </div>
                );
              }
              const delta = ser - reg;
              const pctDelta = reg !== 0 ? (delta / Math.abs(reg)) * 100 : 0;
              const directional = delta * (s.higherIsBetter === false ? -1 : 1);
              const style = tintFromT(deltaT(s.key, directional));
              const better = s.higherIsBetter !== undefined
                ? (s.higherIsBetter ? delta > 0 : delta < 0)
                : delta > 0;
              // Text colors: lock to dark text for legibility on saturated bg
              const deltaColor = Math.abs(delta) < 0.05
                ? "#52525b"
                : better ? "#0f3617" : "#5c1410";
              return (
                <div
                  key={s.key}
                  className="flex flex-col items-center justify-center px-1 py-1"
                  style={{
                    ...style,
                    borderLeft: i === 0 ? STRONG_BORDER : "1px solid var(--nba-border)",
                  }}
                >
                  <div
                    className="text-[12px] tabular-nums font-bold"
                    style={{ color: deltaColor, lineHeight: 1.1 }}
                  >
                    {fmtSigned(delta, s.decimals, s.suffix)}
                  </div>
                  <div
                    className="text-[8.5px] tabular-nums text-(--nba-muted)"
                    style={{ lineHeight: 1.1 }}
                  >
                    {pctDelta > 0 ? "+" : ""}{pctDelta.toFixed(0)}%
                  </div>
                  <div
                    className="text-[8.5px] tabular-nums text-(--nba-subtle)"
                    style={{ lineHeight: 1.1 }}
                  >
                    {fmt(reg, s.decimals, s.suffix)}→{fmt(ser, s.decimals, s.suffix)}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
