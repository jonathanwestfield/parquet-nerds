const DASH = "—";

export function fmt(value: number | null | undefined, places = 1): string {
  if (value == null || Number.isNaN(value)) return DASH;
  return Number(value).toFixed(places);
}

export function fmtInt(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return DASH;
  return String(Math.round(Number(value)));
}

export function fmtSigned(value: number | null | undefined, places = 0): string {
  if (value == null || Number.isNaN(value)) return DASH;
  const v = Number(value);
  return places === 0 ? `${v >= 0 ? "+" : ""}${Math.round(v)}` : `${v >= 0 ? "+" : ""}${v.toFixed(places)}`;
}

export function fmtPct(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return DASH;
  return `${Number(value).toFixed(1)}%`;
}

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function formatGameDate(iso: string): string {
  // iso = '2025-10-21'
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "2-digit",
    timeZone: "UTC",
  });
}
