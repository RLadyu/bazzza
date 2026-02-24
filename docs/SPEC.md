# SPEC: Offline Cohort Desktop Application

## 1) Product constraints
- Platform: Windows desktop app (`.exe`) without installer and without admin rights.
- Runtime mode: fully offline, no network requests from renderer/main processes.
- Architecture stack: Electron + Vite + React + TypeScript + SQLite.

## 2) Immutable data layers
1. **RAW** — immutable source capture, 1:1 representation of imported files.
2. **CANON** — normalized model built only from `RAW + mapping`.
3. **OVERRIDES** — user corrections/patches without changing RAW.

Rule: **RAW is never mutated**. CANON is always rebuilt from RAW + chosen mapping version.

## 3) Import model
- Each import creates a new `ImportBatch` with unique `import_id`.
- `template_signature` is calculated per source template shape.
- Mapping is versioned (`mapping version`) and bound to CANON rebuild operations.
- Core lineage identifiers:
  - `patient_uid`
  - `course_uid`
  - `import_id`

## 4) RAW 1:1 requirements
RAW must preserve exactly:
- all values;
- explicit blank cells;
- sheet order;
- row order;
- column order;
- merge ranges;
- formulas;
- sheet metadata.

This applies for Excel/CSV imports (CSV is represented as one logical sheet with metadata).

## 5) CANON build rules
- CANON is constructed strictly from explicit mapping configuration.
- No guessing/heuristics for column detection.
- Mapping validation errors block CANON build.

## 6) Cohort rules
- **Prospective**: planning window = 6 months from start (`planned_end = start + 6 months`).
- **Retrospective**: factual duration = `end - start`; if missing start/end, duration is `null`.

## 7) Reimport and conflicts
- Reimport always creates a **new RAW batch**.
- Existing overrides are compared against source-derived values from new CANON rebuild.
- Conflict resolution states:
  - `keep_override`
  - `accept_source`

## 8) Export
- Cohort lists.
- Analytical datasets.
- RAW-proof export (evidence of 1:1 RAW capture).

## 9) Public contracts
- All interfaces under `src/contracts/*.ts` are public contracts.
- Public contracts are fixed once accepted and must not be changed incompatibly.


## 10) Import CSV/TSV
- Supported formats in current implementation: `.csv`, `.tsv`, `.txt` (delimited text).
- Original source file is copied to local app data: `<userData>/imports/<import_id>/<original_filename>`.
- Parsed data is written into RAW (`raw_sheets` + `raw_cells`) as strict 1:1 text values.
- No type coercion is applied during import: no trim, no number/date parsing, no delimiter-based value normalization.
- Empty fields are stored explicitly as empty string (`""`) with row/column coordinates.


## 11) Mappings and CANON build
- Mapping snapshot contains:
  - `header_row_idx`
  - `data_start_row_idx`
  - `map`: pairs `col_idx -> canon_code`
- Mapping binds RAW columns to predefined CANON field codes and is persisted in existing mapping storage.
- CANON build runs only from RAW + saved mapping for selected import/sheet.
- RAW is never modified during CANON build.
- Values are copied as strings without transformations (no trim/parse/case conversion).


## 12) Cohorts import meta and overrides
- Each import has metadata used for cohort views: `region`, `cohort_kind` (`prospective`/`retrospective`), and `prospective_planned_months` (default `6`).
- Overrides are manual edits layered over CANON values by key `(import_id, sheet_index, row_idx, canon_code)`.
- Overrides never modify stored CANON base values and never modify RAW.
- Effective value in UI/read APIs is resolved as `override ?? canon_base`.


## 13) Export and conflicts diagnostics
- Export supports two modes:
  - `base`: strictly stored CANON values.
  - `resolved`: CANON values with overrides overlay (`override ?? base`).
- Export includes metadata columns (`import_id`, `sheet_index`, `row_idx`, `region`, `cohort_kind`) and all CANON field codes.
- Export does not transform stored values (no date/number normalization), only CSV escaping.
- Conflicts scanning is diagnostic-only and never mutates RAW/CANON/overrides.


## 14) Manual rows (import_id = "manual")
- Manual rows are stored in SQLite as a separate source with keys `(import_id, sheet_index, row_idx)` where `import_id` is fixed to `"manual"`.
- `values_json` keeps tabular values by `canon_code` and values are stored as raw strings.
- Manual rows participate in Cohorts, Patient, Export (base/resolved), and Conflicts diagnostics.
- For imported rows editing is done via overrides only; for manual rows base values are updated directly in manual storage.
- 1:1 tabular rule stays unchanged: values are strings, no normalization/parsing.


## 15) Persisted mapping templates
- Mapping templates are stored in `mapping_templates` and reused by region/sheet kind.
- Template payload includes versioned rules: `canon`, `source`, `fixed`, `transform`.
- At import time, selected `mapping_template_id` is stored in `imports` and used during CANON build.
- If template is not selected, previous mapping/build behavior is preserved.
- Required field validation is applied during template usage; missing required values create `missing_required_field` conflicts.
- Mapping/template logic never mutates RAW 1:1 storage.


## 16) DB file management and switching
- Current DB path is configurable by the user and persisted in a small config file under `<userData>/db-config.json`.
- If no config is present, app uses default DB path in app data directory (`getDatabasePath()` behavior).
- Opening an existing `.db` or creating a new `.db` is done via IPC + native file dialogs from Settings UI.
- On DB switch, app performs best-effort backup to `<userData>/backups`, saves selected path, relaunches, and runs migrations on startup.
- `export copy` creates a file copy of the active DB at user-selected location; `backup now` creates timestamped copy in backups folder.
- DB switching does not alter RAW/CANON immutability rules; existing layers (overrides/manual/templates/conflicts/export) continue to operate on the currently selected DB.


## 17) Analytics MVP
- Analytics screen consumes aggregates through IPC only (no DB access from renderer).
- KPI includes: `imports_count`, `raw_rows_count`, `canon_rows_count`, `patients_count` (or `n/a`), `unresolved_conflicts_count`.
- Breakdown table groups resolved rows by `cohort_kind` and `region` with row/patient counts.
- Data quality block returns top-10 CANON fields by missingness in resolved values (`null`/empty treated as missing).
- Analytics CSV export writes aggregate report sections (overview, breakdown, missingness) and does not mutate source data.
