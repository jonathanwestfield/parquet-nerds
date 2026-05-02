import "server-only";
import path from "node:path";
import Database from "better-sqlite3";

const DB_PATH =
  process.env.NBA_DB_PATH ??
  path.join(process.cwd(), "..", "nba-stats 6", "data", "nba.db");

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
