import fs from "node:fs";
import path from "node:path";
import type { DbClient } from "./client";

export interface Migration {
  id: string;
  fileName: string;
  sql: string;
}

function loadMigration(fileName: string): Migration {
  const migrationPath = path.join(__dirname, "migrations", fileName);
  const sql = fs.readFileSync(migrationPath, "utf8");
  return { id: fileName.replace(/\.sql$/, ""), fileName, sql };
}

export const MIGRATIONS: Migration[] = [loadMigration("001_initial.sql"), loadMigration("002_manual_rows.sql"), loadMigration("003_mapping_templates.sql"), loadMigration("004_imports_mapping_template.sql")];

export function applyMigrations(db: DbClient): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL
    );
  `);

  const hasMigration = db.prepare("SELECT 1 FROM schema_migrations WHERE id = ?");
  const insertMigration = db.prepare("INSERT INTO schema_migrations (id, applied_at) VALUES (?, ?)");

  const tx = db.transaction(() => {
    for (const migration of MIGRATIONS) {
      const existing = hasMigration.get(migration.id);
      if (existing) continue;

      db.exec(migration.sql);
      insertMigration.run(migration.id, new Date().toISOString());
    }
  });

  tx();
}
