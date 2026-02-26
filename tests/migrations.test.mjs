import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

function createTempDb() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "bazzza-migrate-"));
  const dbPath = path.join(dir, "test.db");
  return { dir, dbPath, db: new DatabaseSync(dbPath) };
}

test("applies migration and creates required tables and indexes", () => {
  const { dir, dbPath, db } = createTempDb();
  try {
    db.exec("PRAGMA foreign_keys = ON;");

    db.exec(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id TEXT PRIMARY KEY,
        applied_at TEXT NOT NULL
      );
    `);

    const migrationSql = fs.readFileSync(path.join(process.cwd(), "src/db/migrations/001_initial.sql"), "utf8");
    db.exec(migrationSql);

    const tableNames = new Set(
      db
        .prepare("SELECT name FROM sqlite_master WHERE type='table'")
        .all()
        .map((row) => row.name),
    );

    const expectedTables = [
      "schema_migrations",
      "imports",
      "stored_files",
      "mappings",
      "build_logs",
      "raw_sheets",
      "raw_merges",
      "raw_cells",
      "patients",
      "courses",
      "events",
      "overrides",
      "conflicts",
    ];

    for (const table of expectedTables) {
      assert.equal(tableNames.has(table), true, `missing table: ${table}`);
    }

    const rawCellPkInfo = db.prepare("PRAGMA table_info(raw_cells)").all();
    const pkCols = rawCellPkInfo.filter((c) => c.pk > 0).sort((a, b) => a.pk - b.pk).map((c) => c.name);
    assert.deepEqual(pkCols, ["sheet_id", "row_idx", "col_idx"]);

    const rawSheetsIndexes = db.prepare("PRAGMA index_list(raw_sheets)").all();
    const hasSheetOrderUnique = rawSheetsIndexes.some((idx) => idx.unique === 1 && idx.name.includes("sqlite_autoindex_raw_sheets"));
    assert.equal(hasSheetOrderUnique, true, "raw_sheets unique(import_id, sheet_index) is required");

    const userIndexes = new Set(
      db
        .prepare("SELECT name FROM sqlite_master WHERE type='index' AND name NOT LIKE 'sqlite_autoindex%'")
        .all()
        .map((row) => row.name),
    );

    for (const indexName of [
      "idx_raw_sheets_import",
      "idx_raw_cells_sheet_row_col",
      "idx_conflicts_import",
      "idx_courses_patient",
      "idx_events_course",
    ]) {
      assert.equal(userIndexes.has(indexName), true, `missing index: ${indexName}`);
    }
  } finally {
    db.close();
    fs.rmSync(dir, { recursive: true, force: true });
    fs.rmSync(dbPath, { force: true });
  }
});
