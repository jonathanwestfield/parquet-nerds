import Link from "next/link";
import { allPlayerSlugs } from "@/lib/slug";

export const dynamic = "force-dynamic";

export default function PlayersIndex() {
  const players = allPlayerSlugs();

  // Group by first letter for a quick alphabetical browse
  const groups = new Map<string, typeof players>();
  for (const p of players) {
    const letter = (p.name[0] || "?").toUpperCase();
    if (!groups.has(letter)) groups.set(letter, []);
    groups.get(letter)!.push(p);
  }
  const letters = [...groups.keys()].sort();

  return (
    <div>
      <h1 className="text-xl font-semibold mb-1">Players</h1>
      <p className="text-sm text-(--nba-muted) mb-5">
        {players.length.toLocaleString()} players with game data
      </p>

      <div className="flex flex-wrap gap-1.5 mb-6">
        {letters.map((l) => (
          <a
            key={l}
            href={`#letter-${l}`}
            className="text-xs px-2 py-1 rounded border border-(--nba-border) text-(--nba-muted) hover:text-(--nba-text)"
          >
            {l}
          </a>
        ))}
      </div>

      <div className="space-y-6">
        {letters.map((l) => (
          <section key={l} id={`letter-${l}`}>
            <div className="nba-eyebrow mb-2">{l}</div>
            <ul className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-1.5">
              {groups.get(l)!.map((p) => (
                <li key={p.id} className="text-sm">
                  <Link
                    href={`/player/${p.slug}`}
                    className="text-(--nba-text) hover:underline underline-offset-2"
                  >
                    {p.name}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
