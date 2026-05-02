import "server-only";
import { all } from "./db";
import { slugify } from "./format";

type SlugRow = { player_id: number; full_name: string };

let cache: { slugToId: Map<string, number>; idToSlug: Map<number, string> } | null = null;

function build() {
  const rows = all<SlugRow>(
    `SELECT DISTINCT p.player_id, p.full_name
     FROM players p
     JOIN player_boxscores pb ON pb.player_id = p.player_id
     ORDER BY p.full_name`,
  );

  const slugToId = new Map<string, number>();
  const idToSlug = new Map<number, string>();
  const used = new Map<string, number>();
  for (const r of rows) {
    let s = slugify(r.full_name);
    if (used.has(s)) {
      s = `${s}-${r.player_id}`;
    }
    used.set(s, r.player_id);
    slugToId.set(s, r.player_id);
    idToSlug.set(r.player_id, s);
  }
  cache = { slugToId, idToSlug };
  return cache;
}

export function playerIdFromSlug(slug: string): number | undefined {
  return (cache ?? build()).slugToId.get(slug);
}

export function slugForPlayer(playerId: number): string | undefined {
  return (cache ?? build()).idToSlug.get(playerId);
}

export function allPlayerSlugs(): { slug: string; id: number; name: string }[] {
  const c = cache ?? build();
  const out: { slug: string; id: number; name: string }[] = [];
  // Reverse lookup name from id via a fresh query (cheap, infrequent)
  const rows = all<{ player_id: number; full_name: string }>(
    `SELECT DISTINCT p.player_id, p.full_name
     FROM players p
     JOIN player_boxscores pb ON pb.player_id = p.player_id
     ORDER BY p.full_name`,
  );
  for (const r of rows) {
    const slug = c.idToSlug.get(r.player_id);
    if (slug) out.push({ slug, id: r.player_id, name: r.full_name });
  }
  return out;
}
