CREATE TABLE IF NOT EXISTS manual_rows (
  import_id TEXT NOT NULL DEFAULT 'manual',
  sheet_index INTEGER NOT NULL DEFAULT 0,
  row_idx INTEGER NOT NULL,
  region TEXT NOT NULL DEFAULT '',
  cohort_kind TEXT NOT NULL DEFAULT 'retrospective',
  values_json TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (import_id, sheet_index, row_idx)
);

CREATE INDEX IF NOT EXISTS idx_manual_rows_import ON manual_rows(import_id, sheet_index, row_idx);
