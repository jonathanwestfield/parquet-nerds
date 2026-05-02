import "server-only";
import path from "node:path";
import Database from "better-sqlite3";

// Default to the bundled slim DB inside nba-web/data so deploys are
// self-contained. Override with NBA_DB_PATH for local dev pointing at
// the full ETL output.
const DB_PATH =
  process.env.NBA_DB_PATH ??
  path.join(process.cwd(), "data", "nba.db");

declare global {
  // eslint-disable-next-line no-var
  var __nba_db: Database.Database | undefined;
}

export function getDb(): Database.Database {
  if (!globalThis.__nba_db) {
    const db = new Database(DB_PATH, { readonly: true, fileMustExist: true });
    db.pragma("journal_mode = WAL");
    db.pragma("query_only = true");
    globalThis.__nba_db = db;
  }
  return globalThis.__nba_db;
}

export function all<T = unknown>(
  sql: string,
  params: Record<string, unknown> | unknown[] = [],
): T[] {
  return getDb().prepare(sql).all(params as never) as T[];
}

export function one<T = unknown>(
  sql: string,
  params: Record<string, unknown> | unknown[] = [],
): T | undefined {
  return getDb().prepare(sql).get(params as never) as T | undefined;
}
