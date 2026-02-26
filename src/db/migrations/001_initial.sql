CREATE TABLE IF NOT EXISTS imports (
  id TEXT PRIMARY KEY,
  region_code TEXT NOT NULL,
  source_filename TEXT NOT NULL,
  file_hash TEXT NOT NULL,
  template_signature TEXT NOT NULL,
  imported_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS stored_files (
  import_id TEXT PRIMARY KEY,
  stored_path TEXT NOT NULL,
  FOREIGN KEY(import_id) REFERENCES imports(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS mappings (
  id TEXT PRIMARY KEY,
  template_signature TEXT NOT NULL,
  region_code TEXT NOT NULL,
  version INTEGER NOT NULL,
  mapping_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(template_signature, region_code, version)
);

CREATE TABLE IF NOT EXISTS build_logs (
  id TEXT PRIMARY KEY,
  import_id TEXT NOT NULL,
  level TEXT NOT NULL,
  message TEXT NOT NULL,
  ref_json TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY(import_id) REFERENCES imports(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS raw_sheets (
  id TEXT PRIMARY KEY,
  import_id TEXT NOT NULL,
  sheet_index INTEGER NOT NULL,
  sheet_name TEXT NOT NULL,
  row_max INTEGER NOT NULL,
  col_max INTEGER NOT NULL,
  sheet_meta_json TEXT NOT NULL,
  FOREIGN KEY(import_id) REFERENCES imports(id) ON DELETE CASCADE,
  UNIQUE(import_id, sheet_index)
);

CREATE TABLE IF NOT EXISTS raw_merges (
  sheet_id TEXT NOT NULL,
  r1 INTEGER NOT NULL,
  c1 INTEGER NOT NULL,
  r2 INTEGER NOT NULL,
  c2 INTEGER NOT NULL,
  PRIMARY KEY(sheet_id, r1, c1, r2, c2),
  FOREIGN KEY(sheet_id) REFERENCES raw_sheets(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS raw_cells (
  sheet_id TEXT NOT NULL,
  row_idx INTEGER NOT NULL,
  col_idx INTEGER NOT NULL,
  value_type TEXT NOT NULL,
  value_text TEXT,
  value_num REAL,
  value_date_iso TEXT,
  value_bool INTEGER,
  formula_text TEXT,
  number_format TEXT,
  raw_json TEXT,
  PRIMARY KEY(sheet_id, row_idx, col_idx),
  FOREIGN KEY(sheet_id) REFERENCES raw_sheets(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS patients (
  patient_uid TEXT PRIMARY KEY,
  region_code TEXT NOT NULL,
  source_patient_id TEXT,
  extra_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS courses (
  course_uid TEXT PRIMARY KEY,
  patient_uid TEXT NOT NULL,
  start_date TEXT,
  end_date TEXT,
  is_prospective INTEGER NOT NULL,
  planned_end_date TEXT,
  duration_days INTEGER,
  extra_json TEXT NOT NULL,
  FOREIGN KEY(patient_uid) REFERENCES patients(patient_uid) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS events (
  event_uid TEXT PRIMARY KEY,
  course_uid TEXT NOT NULL,
  event_date TEXT,
  category TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  FOREIGN KEY(course_uid) REFERENCES courses(course_uid) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS overrides (
  id TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL,
  entity_uid TEXT NOT NULL,
  patch_json TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS conflicts (
  id TEXT PRIMARY KEY,
  import_id TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_uid TEXT NOT NULL,
  field_key TEXT NOT NULL,
  source_value_json TEXT,
  override_value_json TEXT,
  resolved_choice TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY(import_id) REFERENCES imports(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_raw_sheets_import ON raw_sheets(import_id);
CREATE INDEX IF NOT EXISTS idx_raw_cells_sheet_row_col ON raw_cells(sheet_id, row_idx, col_idx);
CREATE INDEX IF NOT EXISTS idx_conflicts_import ON conflicts(import_id);
CREATE INDEX IF NOT EXISTS idx_courses_patient ON courses(patient_uid);
CREATE INDEX IF NOT EXISTS idx_events_course ON events(course_uid);
