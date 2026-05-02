import "server-only";
import type { PlayRow, RosterRow, SeriesGame } from "./queries";

/**
 * Coerce DB cell value to a number, with a fallback for null / "" / non-numeric.
 * better-sqlite3 returns "" for empty TEXT cells; SQLite stored these here even
 * though the schema declares INTEGER (the score columns end up as text on
 * non-scoring plays).
 */
function parseNum(v: unknown, fallback: number): number {
  if (v == null) return fallback;
  if (typeof v === "number") return Number.isNaN(v) ? fallback : v;
  if (typeof v === "string") {
    if (v === "") return fallback;
    const n = Number(v);
    return Number.isNaN(n) ? fallback : n;
  }
  return fallback;
}

// Strip diacritics, lowercase, normalize whitespace.
function norm(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function buildRosterIndex(roster: RosterRow[]): Map<string, number> {
  const idx = new Map<string, number>();
  for (const r of roster) {
    const last = r.last_name ?? r.player_name.split(/\.\s+/).pop() ?? r.player_name;
    const key = norm(last);
    if (!idx.has(key)) idx.set(key, r.player_id);
    const bare = norm(last.replace(/\s+(Jr\.?|Sr\.?|II|III|IV)$/i, ""));
    if (bare && !idx.has(bare)) idx.set(bare, r.player_id);
  }
  return idx;
}

/**
 * Pre-scan a game's plays to infer the on-floor lineup at the start of each
 * period. NBA PBP doesn't always emit substitution events at period
 * boundaries — players can change between Q1 → Q2 implicitly.
 *
 * Strategy: for each period, walk plays in order. A player counts as
 * "period-start" if they appear (as person_id) BEFORE being subbed in via a
 * substitution event. This excludes mid-period sub-ins from being mistaken
 * for period-start players.
 */
function inferPeriodStartLineups(
  plays: PlayRow[],
  teamId: number,
  rosterIdx: Map<string, number>,
): Map<number, Set<number>> {
  const result = new Map<number, Set<number>>();
  let seen: Set<number> | null = null;
  let subbedIn = new Set<number>();

  for (const p of plays) {
    if (p.action_type === "period") {
      if ((p.description ?? "").includes("Start")) {
        seen = new Set<number>();
        subbedIn = new Set<number>();
        result.set(p.period, seen);
      } else {
        seen = null;
      }
      continue;
    }
    if (seen === null) continue;
    if (p.team_id !== teamId) continue;

    if (p.action_type === "Substitution") {
      // Resolve the IN player and remember them as a mid-period arrival
      const parsed = parseSubDescription(p.description);
      if (parsed) {
        const inId = rosterIdx.get(norm(parsed.inName))
          ?? rosterIdx.get(norm(parsed.inName.replace(/\s+(Jr\.?|Sr\.?|II|III|IV)$/i, "")));
        if (inId != null) subbedIn.add(inId);
      }
      // The OUT player (person_id) was on the floor before the sub —
      // they're a valid period-start candidate (unless we've already noted
      // them as subbed-in earlier this period, which shouldn't happen).
      if (p.person_id != null && !subbedIn.has(p.person_id) && seen.size < 5) {
        seen.add(p.person_id);
      }
      continue;
    }

    // Non-sub event: any team-T player appearing here was on the floor
    // (unless they were subbed in earlier this period).
    if (p.person_id == null) continue;
    if (subbedIn.has(p.person_id)) continue;
    if (seen.size >= 5) continue;
    if (!seen.has(p.person_id)) seen.add(p.person_id);
  }
  return result;
}

function parseSubDescription(desc: string | null): { inName: string; outName: string } | null {
  if (!desc) return null;
  const m = desc.match(/^SUB:\s+(.+?)\s+FOR\s+(.+)$/);
  if (!m) return null;
  return { inName: m[1].trim(), outName: m[2].trim() };
}

export type LineupKey = string; // sorted CSV of 5 player_ids

export type LineupStat = {
  key: LineupKey;
  team_id: number;
  players: number[];
  player_names: string[];
  seconds: number;
  pts_for: number;          // points scored by THIS lineup's team while on floor
  pts_against: number;      // points scored by OPP while this lineup was on floor
  team_poss: number;        // FGA + 0.44*FTA + TOV - OREB for THIS team
  opp_poss: number;         // same for opponent
  games_appeared: Set<string>;
  seconds_by_game: Map<string, number>;     // game_id → seconds played in that game
  pts_for_by_game: Map<string, number>;
  pts_against_by_game: Map<string, number>;
};

function lineupKey(playerIds: Set<number>): LineupKey {
  return [...playerIds].sort((a, b) => a - b).join(",");
}

export function computeTeamLineups(
  games: SeriesGame[],
  rostersByGame: Map<string, RosterRow[]>,
  playsByGame: Map<string, PlayRow[]>,
  teamId: number,
): LineupStat[] {
  const stats = new Map<LineupKey, LineupStat>();

  for (const game of games) {
    const roster = rostersByGame.get(game.game_id) ?? [];
    const plays  = playsByGame.get(game.game_id)  ?? [];
    if (!roster.length || !plays.length) continue;

    const idx = buildRosterIndex(roster);
    const startingFive = roster
      .filter((r) => r.starter === 1)
      .map((r) => r.player_id);
    if (startingFive.length !== 5) continue;

    const isHome = game.is_home === 1;
    const oppTeamId = game.opp_team_id;
    const periodStartLineups = inferPeriodStartLineups(plays, teamId, idx);

    let currentLineup = new Set<number>(startingFive);
    let prevSec = 0;
    let prevTeamScore = 0;
    let prevOppScore  = 0;
    let lastShotTeam: number | null = null;

    const idToName = new Map<number, string>();
    for (const r of roster) idToName.set(r.player_id, r.player_name);

    const ensureLineup = (): LineupStat => {
      const key = lineupKey(currentLineup);
      let s = stats.get(key);
      if (!s) {
        const players = [...currentLineup].sort((a, b) => a - b);
        s = {
          key,
          team_id: teamId,
          players,
          player_names: players.map((p) => idToName.get(p) ?? `#${p}`),
          seconds: 0,
          pts_for: 0,
          pts_against: 0,
          team_poss: 0,
          opp_poss: 0,
          games_appeared: new Set<string>(),
          seconds_by_game: new Map<string, number>(),
          pts_for_by_game: new Map<string, number>(),
          pts_against_by_game: new Map<string, number>(),
        };
        stats.set(key, s);
      }
      return s;
    };

    for (const p of plays) {
      const sec = parseNum(p.seconds_elapsed, prevSec);
      const teamScore = parseNum(isHome ? p.score_home : p.score_away, prevTeamScore);
      const oppScore  = parseNum(isHome ? p.score_away : p.score_home, prevOppScore);
      const dt = Math.max(0, sec - prevSec);
      const dPtsFor     = Math.max(0, teamScore - prevTeamScore);
      const dPtsAgainst = Math.max(0, oppScore  - prevOppScore);

      // At a period-start event (period > 1), reset the lineup to whatever the
      // period-start inference came up with (NBA PBP has implicit substitutions
      // between periods we'd otherwise miss).
      if (p.action_type === "period" && (p.description ?? "").includes("Start") && p.period > 1) {
        const inferred = periodStartLineups.get(p.period);
        if (inferred && inferred.size === 5) {
          currentLineup = new Set(inferred);
        }
      }

      // Attribute everything to the CURRENT lineup before any sub change
      if (currentLineup.size === 5) {
        const s = ensureLineup();
        s.seconds      += dt;
        s.pts_for      += dPtsFor;
        s.pts_against  += dPtsAgainst;
        if (dPtsFor > 0)
          s.pts_for_by_game.set(game.game_id, (s.pts_for_by_game.get(game.game_id) ?? 0) + dPtsFor);
        if (dPtsAgainst > 0)
          s.pts_against_by_game.set(game.game_id, (s.pts_against_by_game.get(game.game_id) ?? 0) + dPtsAgainst);
        if (dt > 0) {
          s.games_appeared.add(game.game_id);
          s.seconds_by_game.set(
            game.game_id,
            (s.seconds_by_game.get(game.game_id) ?? 0) + dt,
          );
        }

        // Possession contributors — count events that happened on this play
        const eventTeam = p.team_id;
        const isOurEvent = eventTeam === teamId;
        const isOppEvent = eventTeam === oppTeamId;

        if (p.action_type === "Made Shot" || p.action_type === "Missed Shot") {
          if (isOurEvent)      s.team_poss += 1;
          else if (isOppEvent) s.opp_poss  += 1;
          if (eventTeam != null) lastShotTeam = eventTeam;
        } else if (p.action_type === "Free Throw") {
          if (isOurEvent)      s.team_poss += 0.44;
          else if (isOppEvent) s.opp_poss  += 0.44;
        } else if (p.action_type === "Turnover") {
          if (isOurEvent)      s.team_poss += 1;
          else if (isOppEvent) s.opp_poss  += 1;
        } else if (p.action_type === "Rebound" && eventTeam != null) {
          // Offensive rebound subtracts a possession (we keep playing)
          if (lastShotTeam === eventTeam) {
            if (isOurEvent)      s.team_poss -= 1;
            else if (isOppEvent) s.opp_poss  -= 1;
          }
        }
      }

      // Apply substitution AFTER attributing events to current lineup
      if (p.action_type === "Substitution" && p.team_id === teamId) {
        const parsed = parseSubDescription(p.description);
        const outId = p.person_id ?? null;
        if (parsed) {
          const inId = idx.get(norm(parsed.inName))
            ?? idx.get(norm(parsed.inName.replace(/\s+(Jr\.?|Sr\.?|II|III|IV)$/i, "")));
          if (inId != null && outId != null) {
            currentLineup.delete(outId);
            currentLineup.add(inId);
          }
        }
      }

      prevSec = sec;
      prevTeamScore = teamScore;
      prevOppScore = oppScore;
    }
  }

  return [...stats.values()].sort((a, b) => b.seconds - a.seconds);
}

export function lineupShortLabel(lineup: LineupStat): string {
  return lineup.player_names
    .map((n) => {
      const dot = n.indexOf(". ");
      return dot >= 0 ? n.slice(dot + 2) : n;
    })
    .sort((a, b) => a.localeCompare(b, "en", { sensitivity: "base" }))
    .join(" / ");
}

// Convenience derived metrics
export function offRating(l: LineupStat): number {
  return l.team_poss > 0 ? (l.pts_for / l.team_poss) * 100 : 0;
}
export function defRating(l: LineupStat): number {
  return l.opp_poss > 0 ? (l.pts_against / l.opp_poss) * 100 : 0;
}
export function netRating(l: LineupStat): number {
  return offRating(l) - defRating(l);
}
