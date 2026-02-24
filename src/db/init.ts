import Database from "better-sqlite3";
import { getDatabasePath } from "./path";
import { applyMigrations } from "./migrate";

export function initDatabase(dbPath = getDatabasePath()): Database.Database {
  const db = new Database(dbPath);

  db.pragma("foreign_keys = ON");
  db.pragma("journal_mode = WAL");

  applyMigrations(db);
  return db;
}
