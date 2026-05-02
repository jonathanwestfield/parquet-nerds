"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type PlayerLite = { slug: string; id: number; name: string };

type Props = {
  players: PlayerLite[];
  currentName?: string;
};

export default function PlayerPicker({ players, currentName }: Props) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close on outside click
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const matches = useMemo(() => {
    if (!q.trim()) return players.slice(0, 30);
    const needle = q.trim().toLowerCase();
    // Prefix matches first, then contains
    const prefix: PlayerLite[] = [];
    const contains: PlayerLite[] = [];
    for (const p of players) {
      const n = p.name.toLowerCase();
      if (n.startsWith(needle)) prefix.push(p);
      else if (n.includes(needle)) contains.push(p);
      // Also check last name prefix (e.g. "jokic" matches "Nikola Jokić")
      else {
        const last = n.split(" ").slice(-1)[0];
        if (last.startsWith(needle)) prefix.push(p);
      }
    }
    return [...prefix, ...contains].slice(0, 30);
  }, [q, players]);

  function go(p: PlayerLite) {
    setOpen(false);
    setQ("");
    router.push(`/player/${p.slug}`);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, matches.length - 1));
      setOpen(true);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (matches[activeIdx]) go(matches[activeIdx]);
    } else if (e.key === "Escape") {
      setOpen(false);
      inputRef.current?.blur();
    }
  }

  return (
    <div ref={wrapRef} className="relative" style={{ width: 280 }}>
      <input
        ref={inputRef}
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
          setActiveIdx(0);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        placeholder={currentName ? `Switch player… (current: ${currentName})` : "Search player…"}
        className="w-full text-sm px-3 py-1.5 rounded border bg-(--nba-card) outline-none transition-colors"
        style={{ borderColor: "var(--nba-border-2)" }}
        onFocusCapture={(e) => (e.currentTarget.style.borderColor = "var(--nba-text)")}
        onBlurCapture={(e) => (e.currentTarget.style.borderColor = "var(--nba-border-2)")}
      />
      {open && matches.length > 0 && (
        <div
          className="absolute left-0 right-0 mt-1 z-20 bg-(--nba-card) border border-(--nba-border-2) rounded shadow-lg max-h-80 overflow-auto"
          style={{ boxShadow: "var(--nba-shadow-lg)" }}
        >
          {matches.map((p, i) => (
            <button
              key={p.slug}
              type="button"
              onClick={() => go(p)}
              onMouseEnter={() => setActiveIdx(i)}
              className="block w-full text-left px-3 py-1.5 text-sm tabular-nums"
              style={{
                background: i === activeIdx ? "var(--nba-divider)" : "transparent",
                color: "var(--nba-text)",
              }}
            >
              {p.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
