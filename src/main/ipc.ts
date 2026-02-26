import { app, dialog, ipcMain } from "electron";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { initDatabase } from "../db/init";
import { getBackupsDir, getConfiguredDbPath, resetConfiguredDbPath, setConfiguredDbPath, validateDbPathForCreate, validateDbPathForOpen } from "./db/dbPathConfig";
import { CANON_FIELD_CODE_SET, CANON_FIELD_OPTIONS } from "../contracts/canon-fields";
import type { AnalyticsBreakdownItem, AnalyticsMissingnessItem, AnalyticsOverview, AnalyticsReportExportResult } from "../contracts/analytics";
import { runCsvImport } from "./services/csv-import";
import type { CanonCourse, CanonEvent, CanonPatient, ConflictRecord, MappingConfig, OverridePatch, TemplateSignature } from "../contracts/domain";
import {
  IPC_CHANNELS,
  type BuildCanonForImportRequest,
  type BuildCanonForImportResponse,
  type CanonOverrideClearRequest,
  type CanonOverrideItem,
  type CanonOverrideRequest,
  type CanonOverridesListForRowRequest,
  type CanonRebuildRequest,
  type CanonRebuildResponse,
  type CanonRecordResponse,
  type CohortsListItem,
  type CohortsListRequest,
  type CohortsListResponse,
  type ConflictsScanRequest,
  type ConflictsScanResponse,
  type DbBackupNowResponse,
  type DbChooseCreateRequest,
  type DbChooseOpenResponse,
  type DbExportCopyRequest,
  type DbExportCopyResponse,
  type DbInfoResponse,
  type ExportCanonCsvRequest,
  type ExportCanonCsvResponse,
  type ExportChooseSavePathRequest,
  type ExportRequest,
  type ImportFileRequest,
  type ImportFileResult,
  type ImportMeta,
  type ImportMetaExtended,
  type ImportMetaPatch,
  type ImportsListItem,
  type LoadMappingRequest,
  type ManualCreateRequest,
  type ManualDeleteRequest,
  type ManualListRequest,
  type ManualRow,
  type ManualUpdateRequest,
  type MappingSnapshot,
  type OverrideClearCellRequest,
  type OverrideSetCellRequest,
  type PickFileResponse,
  type RawPreviewRequest,
  type RawPreviewResponse,
  type RebuildCanonRequest,
  type RebuildCanonResult,
  type ResolveConflictRequest,
  type RunCsvImportRequest,
  type RunCsvImportResponse,
  type SaveMappingRequest,
  type SaveOverrideRequest,
} from "../contracts/ipc";

const currentDbPath = getConfiguredDbPath();
const db = initDatabase(currentDbPath);
const META_LEVEL = "import_meta";

const PATIENT_ID_CODE = "patient.source_patient_id";

function nowIso(): string {
  return new Date().toISOString();
}
function nowEpochMs(): number {
  return Date.now();
}

function csvEscape(v: string): string {
  if (v.includes('"') || v.includes(",") || v.includes("\n") || v.includes("\r")) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

function parsePatientUid(patientUid: string): { import_id: string; sheet_index: number; row_idx: number } | null {
  const m = patientUid.match(/^(.*):(\d+):r(\d+)$/);
  if (!m) return null;
  return { import_id: m[1], sheet_index: Number(m[2]), row_idx: Number(m[3]) };
}

function buildOverrideIdentity(importId: string, sheetIndex: number, rowIdx: number, colIdx: number): string {
  return `${importId}:${sheetIndex}:${rowIdx}:${colIdx}`;
}
function buildCanonOverrideIdentity(importId: string, sheetIndex: number, rowIdx: number, canonCode: string): string {
  return `canon:${importId}:${sheetIndex}:${rowIdx}:${canonCode}`;
}

function ensureAllowedExtension(filePath: string): ".csv" | ".tsv" | ".txt" {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".csv" || ext === ".tsv" || ext === ".txt") return ext;
  throw new Error(`Unsupported file extension: ${ext}. Allowed: .csv, .tsv, .txt`);
}

function mappingFromRow(row: any): MappingSnapshot {
  const parsed = JSON.parse(String(row.mapping_json)) as Omit<MappingSnapshot, "mapping_id" | "mapping_version">;
  return { ...parsed, mapping_id: row.id, mapping_version: Number(row.version) };
}

function normalizeValuesObject(values?: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const field of CANON_FIELD_OPTIONS) out[field.code] = values?.[field.code] ?? "";
  return out;
}

function listCanonOverridesForRow(request: CanonOverridesListForRowRequest): CanonOverrideItem[] {
  const prefix = `canon:${request.import_id}:${request.sheet_index}:${request.row_idx}:`;
  const rows = db.prepare(`SELECT patch_json FROM overrides WHERE entity_type = 'canon_field' AND entity_uid LIKE ?`).all(`${prefix}%`) as Array<{ patch_json: string }>;
  return rows.map((row) => {
    const payload = JSON.parse(row.patch_json) as { canon_code: string; value: string };
    return { canon_code: payload.canon_code, value: payload.value };
  });
}

function getRowOverrides(importId: string, sheetIndex: number, rowIdx: number): Record<string, string> {
  const out: Record<string, string> = {};
  for (const x of listCanonOverridesForRow({ import_id: importId, sheet_index: sheetIndex, row_idx: rowIdx })) out[x.canon_code] = x.value;
  return out;
}

function getImportMetaExtended(importId: string): ImportMetaExtended {
  const base = db
    .prepare(
      `SELECT i.id, i.region_code, i.source_filename, i.file_hash, i.template_signature, i.imported_at, sf.stored_path
       FROM imports i LEFT JOIN stored_files sf ON sf.import_id = i.id WHERE i.id = ?`,
    )
    .get(importId) as ImportMeta | undefined;
  if (!base) throw new Error("Import not found");

  const metaRow = db
    .prepare(
      `SELECT ref_json FROM build_logs WHERE import_id = ? AND level = ? ORDER BY created_at DESC LIMIT 1`,
    )
    .get(importId, META_LEVEL) as { ref_json: string | null } | undefined;

  const patch = metaRow?.ref_json ? (JSON.parse(metaRow.ref_json) as ImportMetaPatch) : {};
  return {
    ...base,
    region_code: patch.region ?? base.region_code,
    cohort_kind: patch.cohort_kind ?? "retrospective",
    prospective_planned_months: patch.prospective_planned_months ?? 6,
  };
}

function updateImportMeta(importId: string, patch: ImportMetaPatch): ImportMetaExtended {
  const current = getImportMetaExtended(importId);
  const merged: ImportMetaPatch = {
    region: patch.region ?? current.region_code,
    cohort_kind: patch.cohort_kind ?? current.cohort_kind,
    prospective_planned_months: patch.prospective_planned_months ?? current.prospective_planned_months,
  };
  if (patch.region !== undefined) db.prepare(`UPDATE imports SET region_code = ? WHERE id = ?`).run(patch.region, importId);
  db.prepare(`INSERT INTO build_logs(id, import_id, level, message, ref_json, created_at) VALUES (?, ?, ?, ?, ?, ?)`).run(
    crypto.randomUUID(),
    importId,
    META_LEVEL,
    "imports:updateMeta",
    JSON.stringify(merged),
    nowIso(),
  );
  return getImportMetaExtended(importId);
}

function loadMappingForImport(request: LoadMappingRequest): MappingSnapshot | null {
  const sheetIndex = request.sheet_index ?? 0;
  const importRow = db.prepare(`SELECT region_code, template_signature FROM imports WHERE id = ?`).get(request.import_id) as
    | { region_code: string; template_signature: string }
    | undefined;
  if (!importRow) throw new Error("Import not found");

  const rows = db
    .prepare(`SELECT id, version, mapping_json FROM mappings WHERE template_signature = ? AND region_code = ? ORDER BY version DESC`)
    .all(importRow.template_signature, importRow.region_code) as Array<{ id: string; version: number; mapping_json: string }>;

  for (const row of rows) {
    const snapshot = mappingFromRow(row);
    if (snapshot.import_id === request.import_id && snapshot.sheet_index === sheetIndex) return snapshot;
  }
  return null;
}

function resolveRawValue(sheetId: string, rowIdx: number, colIdx: number): string {
  const row = db.prepare(`SELECT value_text FROM raw_cells WHERE sheet_id = ? AND row_idx = ? AND col_idx = ?`).get(sheetId, rowIdx, colIdx) as
    | { value_text: string | null }
    | undefined;
  return row?.value_text ?? "";
}



function listMappingTemplates(region?: string, sheet_kind?: string) {
  let sql = `SELECT * FROM mapping_templates`;
  const params: any[] = [];
  const cond: string[] = [];
  if (region) {
    cond.push(`region = ?`);
    params.push(region);
  }
  if (sheet_kind) {
    cond.push(`sheet_kind = ?`);
    params.push(sheet_kind);
  }
  if (cond.length) sql += ` WHERE ` + cond.join(" AND ");
  sql += ` ORDER BY updated_at DESC`;
  const rows = db.prepare(sql).all(...params) as any[];
  return rows.map((r) => ({ ...r, mapping_json: JSON.parse(r.mapping_json) }));
}

function getMappingTemplate(id: string) {
  const row = db.prepare(`SELECT * FROM mapping_templates WHERE id = ?`).get(id) as any;
  return row ? { ...row, mapping_json: JSON.parse(row.mapping_json) } : null;
}

function upsertMappingTemplate(request: any) {
  const now = nowIso();
  const id = request.id ?? crypto.randomUUID();
  const existing = db.prepare(`SELECT id, created_at FROM mapping_templates WHERE id = ?`).get(id) as any;
  if (existing) {
    db.prepare(`UPDATE mapping_templates SET name = ?, region = ?, sheet_kind = ?, mapping_json = ?, updated_at = ? WHERE id = ?`).run(
      request.name,
      request.region,
      request.sheet_kind,
      JSON.stringify(request.mapping_json),
      now,
      id,
    );
  } else {
    db.prepare(`INSERT INTO mapping_templates(id, name, region, sheet_kind, mapping_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`).run(
      id,
      request.name,
      request.region,
      request.sheet_kind,
      JSON.stringify(request.mapping_json),
      now,
      now,
    );
  }
  return getMappingTemplate(id);
}

function getLatestImportHeaders(region: string, sheetKind = "patients") {
  const imp = db.prepare(`SELECT id FROM imports WHERE region_code = ? ORDER BY imported_at DESC LIMIT 1`).get(region) as { id: string } | undefined;
  if (!imp) return null;
  const sheet = db.prepare(`SELECT id, col_max FROM raw_sheets WHERE import_id = ? AND sheet_index = 0`).get(imp.id) as { id: string; col_max: number } | undefined;
  if (!sheet) return null;
  const headers: string[] = [];
  for (let c=0;c<=sheet.col_max;c+=1){
    const cell = db.prepare(`SELECT value_text FROM raw_cells WHERE sheet_id = ? AND row_idx = 0 AND col_idx = ?`).get(sheet.id,c) as {value_text:string|null}|undefined;
    headers.push(cell?.value_text ?? "");
  }
  return { import_id: imp.id, sheet_kind: sheetKind, headers };
}

function normalizeHeader(v: string): string {
  return v.toLowerCase().trim().replace(/[\s_\-]+/g, "");
}

function createTemplateDraftFromLastImport(region: string, sheet_kind = "patients") {
  const last = getLatestImportHeaders(region, sheet_kind);
  if (!last) return null;
  const rules = CANON_FIELD_OPTIONS.map((field) => {
    const target = normalizeHeader(field.code.split('.').pop() ?? field.code);
    let matched: string | null = null;
    for (const h of last.headers) {
      const nh = normalizeHeader(h);
      if (!nh) continue;
      if (nh === target || nh.includes(target) || target.includes(nh)) { matched = h; break; }
    }
    return { canon: field.code, source: matched, fixed: null, transform: "string" };
  });
  return { version: 1, rules };
}
function parseDateLoose(value: string): Date | null {
  const iso = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return new Date(Date.UTC(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3])));
  const ru = value.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (ru) return new Date(Date.UTC(Number(ru[3]), Number(ru[2]) - 1, Number(ru[1])));
  return null;
}

function computeDisplayMonths(start: string, end: string): string {
  const s = parseDateLoose(start);
  const e = parseDateLoose(end);
  if (!s || !e || Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return "";
  return String(Number(((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24 * 30.4375)).toFixed(2)));
}

function getManualRow(importId: string, sheetIndex: number, rowIdx: number): ManualRow | null {
  if (importId !== "manual") return null;
  const row = db
    .prepare(`SELECT import_id, sheet_index, row_idx, region, cohort_kind, values_json, created_at, updated_at FROM manual_rows WHERE import_id = ? AND sheet_index = ? AND row_idx = ?`)
    .get(importId, sheetIndex, rowIdx) as
    | {
        import_id: "manual";
        sheet_index: number;
        row_idx: number;
        region: string;
        cohort_kind: "prospective" | "retrospective";
        values_json: string;
        created_at: number;
        updated_at: number;
      }
    | undefined;
  if (!row) return null;
  return { ...row, values: normalizeValuesObject(JSON.parse(row.values_json)) };
}

function getCanonRecord(importId: string, rowIdx: number, sheetIndex = 0): CanonRecordResponse {
  if (importId === "manual") {
    const manual = getManualRow(importId, sheetIndex, rowIdx);
    if (!manual) throw new Error("Manual row not found");
    const base = normalizeValuesObject(manual.values);
    const resolved = { ...base, ...getRowOverrides(importId, sheetIndex, rowIdx) };
    return { import_id: importId, sheet_index: sheetIndex, row_idx: rowIdx, values: base, valuesResolved: resolved };
  }

  const patientUid = `${importId}:${sheetIndex}:r${rowIdx}`;
  const courseUid = `${patientUid}:c`;
  const eventUid = `${patientUid}:e`;

  const patient = db.prepare(`SELECT source_patient_id, extra_json FROM patients WHERE patient_uid = ?`).get(patientUid) as
    | { source_patient_id: string | null; extra_json: string | null }
    | undefined;
  const course = db
    .prepare(`SELECT start_date, end_date, is_prospective, planned_end_date, duration_days, extra_json FROM courses WHERE course_uid = ?`)
    .get(courseUid) as Record<string, string | null> | undefined;
  const event = db.prepare(`SELECT event_date, category, payload_json FROM events WHERE event_uid = ?`).get(eventUid) as Record<string, string | null> | undefined;

  const values = normalizeValuesObject({
    "patient.source_patient_id": patient?.source_patient_id ?? "",
    "patient.extra_json": patient?.extra_json ?? "",
    "course.start_date": (course?.start_date as string | null) ?? "",
    "course.end_date": (course?.end_date as string | null) ?? "",
    "course.is_prospective": (course?.is_prospective as string | null) ?? "",
    "course.planned_end_date": (course?.planned_end_date as string | null) ?? "",
    "course.duration_days": (course?.duration_days as string | null) ?? "",
    "course.extra_json": (course?.extra_json as string | null) ?? "",
    "event.event_date": (event?.event_date as string | null) ?? "",
    "event.category": (event?.category as string | null) ?? "",
    "event.payload_json": (event?.payload_json as string | null) ?? "",
  });

  return { import_id: importId, sheet_index: sheetIndex, row_idx: rowIdx, values, valuesResolved: { ...values, ...getRowOverrides(importId, sheetIndex, rowIdx) } };
}

function listManualRows(filters: ManualListRequest): { total: number; items: ManualRow[] } {
  const cohort = filters.cohort_kind ?? "all";
  const region = filters.region ?? "all";
  const search = (filters.search ?? "").toLowerCase();
  const limit = filters.limit ?? 200;
  const offset = filters.offset ?? 0;

  const rows = db
    .prepare(`SELECT import_id, sheet_index, row_idx, region, cohort_kind, values_json, created_at, updated_at FROM manual_rows ORDER BY row_idx DESC`)
    .all() as Array<{
      import_id: "manual";
      sheet_index: number;
      row_idx: number;
      region: string;
      cohort_kind: "prospective" | "retrospective";
      values_json: string;
      created_at: number;
      updated_at: number;
    }>;

  const items = rows
    .map((r) => ({ ...r, values: normalizeValuesObject(JSON.parse(r.values_json)) }))
    .filter((r) => {
      if (cohort !== "all" && r.cohort_kind !== cohort) return false;
      if (region !== "all" && r.region !== region) return false;
      if (search) {
        const hay = `${r.values[PATIENT_ID_CODE] ?? ""}|${Object.values(r.values).join("|")}`.toLowerCase();
        if (!hay.includes(search)) return false;
      }
      return true;
    });

  return { total: items.length, items: items.slice(offset, offset + limit) };
}

function manualCreate(request: ManualCreateRequest): ManualRow {
  const now = nowEpochMs();
  const max = db.prepare(`SELECT COALESCE(MAX(row_idx), -1) AS m FROM manual_rows WHERE import_id = 'manual' AND sheet_index = 0`).get() as { m: number };
  const row_idx = Number(max.m) + 1;
  const values = normalizeValuesObject(request.values);
  db.prepare(`INSERT INTO manual_rows(import_id, sheet_index, row_idx, region, cohort_kind, values_json, created_at, updated_at) VALUES ('manual', 0, ?, ?, ?, ?, ?, ?)`).run(
    row_idx,
    request.region,
    request.cohort_kind,
    JSON.stringify(values),
    now,
    now,
  );
  return { import_id: "manual", sheet_index: 0, row_idx, region: request.region, cohort_kind: request.cohort_kind, values, created_at: now, updated_at: now };
}

function manualUpdate(request: ManualUpdateRequest): ManualRow {
  const cur = getManualRow(request.import_id, request.sheet_index, request.row_idx);
  if (!cur) throw new Error("Manual row not found");
  const mergedValues = { ...cur.values, ...(request.patchValues ?? {}) };
  const updated: ManualRow = {
    ...cur,
    region: request.region ?? cur.region,
    cohort_kind: request.cohort_kind ?? cur.cohort_kind,
    values: normalizeValuesObject(mergedValues),
    updated_at: nowEpochMs(),
  };
  db.prepare(`UPDATE manual_rows SET region = ?, cohort_kind = ?, values_json = ?, updated_at = ? WHERE import_id = ? AND sheet_index = ? AND row_idx = ?`).run(
    updated.region,
    updated.cohort_kind,
    JSON.stringify(updated.values),
    updated.updated_at,
    request.import_id,
    request.sheet_index,
    request.row_idx,
  );
  return updated;
}

function manualDelete(request: ManualDeleteRequest): { ok: true } {
  db.prepare(`DELETE FROM manual_rows WHERE import_id = 'manual' AND sheet_index = 0 AND row_idx = ?`).run(request.row_idx);
  return { ok: true };
}

function cohortsList(request: CohortsListRequest): CohortsListResponse {
  const cohortFilter = request.cohort_kind ?? "all";
  const regionFilter = request.region ?? "all";
  const importFilter = request.import_id ?? "all";
  const search = (request.search ?? "").toLowerCase();
  const limit = request.limit ?? 200;
  const offset = request.offset ?? 0;
  const items: CohortsListItem[] = [];

  const includeImports = importFilter === "all" || importFilter !== "manual";
  if (includeImports) {
    const importRows = db.prepare(`SELECT id FROM imports ORDER BY imported_at DESC`).all() as Array<{ id: string }>;
    for (const ir of importRows) {
      if (importFilter !== "all" && ir.id !== importFilter) continue;
      const meta = getImportMetaExtended(ir.id);
      if (regionFilter !== "all" && meta.region_code !== regionFilter) continue;
      if (cohortFilter !== "all" && meta.cohort_kind !== cohortFilter) continue;

      const patients = db.prepare(`SELECT patient_uid FROM patients WHERE patient_uid LIKE ?`).all(`${ir.id}:%`) as Array<{ patient_uid: string }>;
      for (const p of patients) {
        const parsed = parsePatientUid(p.patient_uid);
        if (!parsed) continue;
        const rec = getCanonRecord(parsed.import_id, parsed.row_idx, parsed.sheet_index);
        const patientId = rec.valuesResolved[PATIENT_ID_CODE] ?? "";
        const start = rec.valuesResolved["course.start_date"] ?? "";
        const end = rec.valuesResolved["course.end_date"] ?? "";
        const durRaw = rec.valuesResolved["course.duration_days"] ?? "";
        const duration = meta.cohort_kind === "prospective" ? String(meta.prospective_planned_months || 6) : durRaw || computeDisplayMonths(start, end);
        const hay = `${patientId}|${start}|${end}`.toLowerCase();
        if (search && !hay.includes(search)) continue;

        const hasOverrides = listCanonOverridesForRow({ import_id: parsed.import_id, sheet_index: parsed.sheet_index, row_idx: parsed.row_idx }).length > 0;
        items.push({ import_id: parsed.import_id, sheet_index: parsed.sheet_index, row_idx: parsed.row_idx, region: meta.region_code, cohort_kind: meta.cohort_kind, patient_id: patientId, tx_start: start, tx_end: end, duration_months: duration, hasOverrides });
      }
    }
  }

  const includeManual = importFilter === "all" || importFilter === "manual";
  if (includeManual) {
    const manual = listManualRows({ cohort_kind: cohortFilter, region: regionFilter, search, limit: 1_000_000, offset: 0 }).items;
    for (const m of manual) {
      const overrides = getRowOverrides("manual", m.sheet_index, m.row_idx);
      const resolved = { ...m.values, ...overrides };
      const start = resolved["course.start_date"] ?? "";
      const end = resolved["course.end_date"] ?? "";
      const durRaw = resolved["course.duration_days"] ?? "";
      const duration = m.cohort_kind === "prospective" ? "6" : durRaw || computeDisplayMonths(start, end);
      items.push({
        import_id: "manual",
        sheet_index: m.sheet_index,
        row_idx: m.row_idx,
        region: m.region,
        cohort_kind: m.cohort_kind,
        patient_id: resolved[PATIENT_ID_CODE] ?? "",
        tx_start: start,
        tx_end: end,
        duration_months: duration,
        hasOverrides: Object.keys(overrides).length > 0,
      });
    }
  }

  return { total: items.length, items: items.slice(offset, offset + limit) };
}

function buildCanonForImport(request: BuildCanonForImportRequest): BuildCanonForImportResponse {
  const sheetIndex = request.sheet_index ?? 0;
  const importRow = db.prepare(`SELECT mapping_template_id FROM imports WHERE id = ?`).get(request.import_id) as { mapping_template_id: string | null } | undefined;
  let templateRules: Array<{ canon: string; source: string | null; fixed: string | null; transform: "string" | "number" | "date" }> | null = null;
  if (importRow?.mapping_template_id) {
    const tpl = getMappingTemplate(importRow.mapping_template_id);
    templateRules = tpl?.mapping_json?.rules ?? null;
  }

  const mapping = loadMappingForImport({ import_id: request.import_id, sheet_index: sheetIndex });
  const sheet = db.prepare(`SELECT id, row_max FROM raw_sheets WHERE import_id = ? AND sheet_index = ?`).get(request.import_id, sheetIndex) as { id: string; row_max: number } | undefined;
  if (!sheet) throw new Error("RAW sheet not found for import/sheet.");

  const headerMap = new Map<string, number>();
  const cols = db.prepare(`SELECT col_max FROM raw_sheets WHERE id = ?`).get(sheet.id) as { col_max: number };
  for (let c = 0; c <= (cols?.col_max ?? 0); c += 1) {
    const cell = db.prepare(`SELECT value_text FROM raw_cells WHERE sheet_id = ? AND row_idx = 0 AND col_idx = ?`).get(sheet.id, c) as { value_text: string | null } | undefined;
    if (cell?.value_text) headerMap.set(cell.value_text, c);
  }

  const prefix = `${request.import_id}:${sheetIndex}:r`;
  db.exec("BEGIN");
  try {
    if (request.rebuild ?? true) {
      db.prepare(`DELETE FROM events WHERE course_uid LIKE ?`).run(`${prefix}%:c`);
      db.prepare(`DELETE FROM courses WHERE course_uid LIKE ?`).run(`${prefix}%:c`);
      db.prepare(`DELETE FROM patients WHERE patient_uid LIKE ?`).run(`${prefix}%`);
      db.prepare(`DELETE FROM conflicts WHERE import_id = ? AND entity_type = 'missing_required_field'`).run(request.import_id);
    }

    const insP = db.prepare(`INSERT OR REPLACE INTO patients(patient_uid, region_code, source_patient_id, extra_json) VALUES (?, ?, ?, ?)`);
    const insC = db.prepare(`INSERT OR REPLACE INTO courses(course_uid, patient_uid, start_date, end_date, is_prospective, planned_end_date, duration_days, extra_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
    const insE = db.prepare(`INSERT OR REPLACE INTO events(event_uid, course_uid, event_date, category, payload_json) VALUES (?, ?, ?, ?, ?)`);

    let rowsProcessed = 0;
    let canonCellsInserted = 0;
    const startRow = mapping?.data_start_row_idx ?? 1;

    for (let rowIdx = startRow; rowIdx <= sheet.row_max; rowIdx += 1) {
      const values: Record<string, string | null> = {};

      if (templateRules) {
        for (const rule of templateRules) {
          let raw: string | null = null;
          if (rule.source) {
            const cidx = headerMap.get(rule.source);
            raw = cidx === undefined ? "" : resolveRawValue(sheet.id, rowIdx, cidx);
          } else {
            raw = rule.fixed;
          }
          let out: string | null = raw;
          if (rule.transform === "number") {
            out = raw === null || raw === "" ? "" : (Number.isFinite(Number(raw)) ? String(raw) : null);
          } else if (rule.transform === "date") {
            if (raw === null || raw === "") out = "";
            else out = parseDateLoose(raw) ? String(raw) : null;
          }
          values[rule.canon] = out;
          canonCellsInserted += 1;
        }
      } else if (mapping) {
        for (const pair of mapping.map) {
          values[pair.canon_code] = resolveRawValue(sheet.id, rowIdx, pair.col_idx);
          canonCellsInserted += 1;
        }
      } else {
        throw new Error("Mapping not found and no mapping template selected.");
      }

      for (const f of CANON_FIELD_OPTIONS.filter((x) => x.required)) {
        const v = values[f.code] ?? "";
        if (!v) {
          db.prepare(`INSERT INTO conflicts(id, import_id, entity_type, entity_uid, field_key, source_value_json, override_value_json, resolved_choice, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
            crypto.randomUUID(),
            request.import_id,
            'missing_required_field',
            `${request.import_id}:${sheetIndex}:${rowIdx}`,
            f.code,
            JSON.stringify({ row_idx: rowIdx, value: v }),
            null,
            null,
            nowIso(),
          );
        }
      }

      const patientUid = `${request.import_id}:${sheetIndex}:r${rowIdx}`;
      const courseUid = `${patientUid}:c`;
      const eventUid = `${patientUid}:e`;
      insP.run(patientUid, "", values[PATIENT_ID_CODE] ?? "", values["patient.extra_json"] ?? "");
      insC.run(courseUid, patientUid, values["course.start_date"] ?? "", values["course.end_date"] ?? "", values["course.is_prospective"] ?? "", values["course.planned_end_date"] ?? "", values["course.duration_days"] ?? "", values["course.extra_json"] ?? "");
      insE.run(eventUid, courseUid, values["event.event_date"] ?? "", values["event.category"] ?? "", values["event.payload_json"] ?? "");
      rowsProcessed += 1;
    }

    db.exec("COMMIT");
    return { import_id: request.import_id, rowsProcessed, canonCellsInserted };
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

function exportCanonCsv(request: ExportCanonCsvRequest): ExportCanonCsvResponse {
  const list = cohortsList({ ...request.filters, limit: 1_000_000, offset: 0 });
  const headers = ["import_id", "sheet_index", "row_idx", "region", "cohort_kind", ...CANON_FIELD_OPTIONS.map((f) => f.code)];
  const lines: string[] = [headers.join(",")];

  for (const item of list.items) {
    const rec = getCanonRecord(item.import_id, item.row_idx, item.sheet_index);
    const values = request.mode === "resolved" ? rec.valuesResolved : rec.values;
    lines.push([
      item.import_id,
      String(item.sheet_index),
      String(item.row_idx),
      item.region,
      item.cohort_kind,
      ...CANON_FIELD_OPTIONS.map((f) => values[f.code] ?? ""),
    ].map(csvEscape).join(","));
  }

  fs.writeFileSync(request.savePath, `${lines.join("\n")}\n`, "utf8");
  return { writtenBytes: fs.statSync(request.savePath).size, rows: list.items.length };
}

function scanConflicts(request: ConflictsScanRequest): ConflictsScanResponse {
  const importFilter = request.import_id ?? "all";
  const mappingUnknownCanon: ConflictsScanResponse["mappingUnknownCanon"] = [];
  const mappingDuplicates: ConflictsScanResponse["mappingDuplicates"] = [];

  const mapRows = db.prepare(`SELECT mapping_json FROM mappings ORDER BY created_at DESC`).all() as Array<{ mapping_json: string }>;
  const grouped = new Map<string, Map<string, Array<{ sheet_index: number; col_idx: number }>>>();
  for (const row of mapRows) {
    const snap = JSON.parse(row.mapping_json) as { import_id: string; sheet_index: number; map: Array<{ col_idx: number; canon_code: string }> };
    if (!snap?.import_id) continue;
    if (importFilter !== "all" && snap.import_id !== importFilter) continue;
    const byCode = grouped.get(snap.import_id) ?? new Map<string, Array<{ sheet_index: number; col_idx: number }>>();
    for (const pair of snap.map ?? []) {
      if (!CANON_FIELD_CODE_SET.has(pair.canon_code)) mappingUnknownCanon.push({ import_id: snap.import_id, sheet_index: snap.sheet_index ?? 0, col_idx: pair.col_idx, canon_code: pair.canon_code });
      const src = byCode.get(pair.canon_code) ?? [];
      src.push({ sheet_index: snap.sheet_index ?? 0, col_idx: pair.col_idx });
      byCode.set(pair.canon_code, src);
    }
    grouped.set(snap.import_id, byCode);
  }
  for (const [import_id, byCode] of grouped.entries()) for (const [canon_code, sources] of byCode.entries()) if (sources.length > 1) mappingDuplicates.push({ import_id, canon_code, sources });

  const missingKeyFields: ConflictsScanResponse["missingKeyFields"] = [];
  const duplicatePatientId: ConflictsScanResponse["duplicatePatientId"] = [];
  const byImportPatient = new Map<string, Map<string, Array<{ sheet_index: number; row_idx: number }>>>();

  const cohort = cohortsList({ import_id: importFilter as any, cohort_kind: "all", region: "all", limit: 1_000_000, offset: 0 });
  for (const item of cohort.items) {
    const rec = getCanonRecord(item.import_id, item.row_idx, item.sheet_index);
    const pid = rec.values[PATIENT_ID_CODE] ?? "";
    if (!pid) missingKeyFields.push({ import_id: item.import_id, sheet_index: item.sheet_index, row_idx: item.row_idx, missing: [PATIENT_ID_CODE] });
    if (!pid) continue;
    const imp = byImportPatient.get(item.import_id) ?? new Map<string, Array<{ sheet_index: number; row_idx: number }>>();
    const arr = imp.get(pid) ?? [];
    arr.push({ sheet_index: item.sheet_index, row_idx: item.row_idx });
    imp.set(pid, arr);
    byImportPatient.set(item.import_id, imp);
  }
  for (const [import_id, pids] of byImportPatient.entries()) for (const [patient_id, rows] of pids.entries()) if (rows.length > 1) duplicatePatientId.push({ import_id, patient_id, rows });

  return { mappingUnknownCanon, mappingDuplicates, missingKeyFields, duplicatePatientId };
}


function getDbInfo(): DbInfoResponse {
  const exists = fs.existsSync(currentDbPath);
  const stat = exists ? fs.statSync(currentDbPath) : null;
  return {
    dbPath: currentDbPath,
    exists,
    sizeBytes: stat ? stat.size : null,
    lastModified: stat ? stat.mtimeMs : null,
  };
}

function backupNow(): DbBackupNowResponse {
  fs.mkdirSync(getBackupsDir(), { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const fileName = `backup-${stamp}.db`;
  const backupPath = path.join(getBackupsDir(), fileName);
  if (fs.existsSync(currentDbPath)) {
    db.pragma("wal_checkpoint(TRUNCATE)");
    fs.copyFileSync(currentDbPath, backupPath);
  } else {
    fs.writeFileSync(backupPath, "", "utf8");
  }
  return { path: backupPath, writtenBytes: fs.statSync(backupPath).size };
}

function relaunchAfterSwitch(): never {
  app.relaunch();
  app.exit(0);
  throw new Error("Relaunching");
}


function getResolvedRowsForAnalytics(): Array<{ import_id: string; sheet_index: number; row_idx: number; region: string; cohort_kind: string; valuesResolved: Record<string, string> }> {
  const rows = cohortsList({ cohort_kind: "all", region: "all", import_id: "all", limit: 1_000_000, offset: 0 }).items;
  return rows.map((item) => {
    const rec = getCanonRecord(item.import_id, item.row_idx, item.sheet_index);
    return {
      import_id: item.import_id,
      sheet_index: item.sheet_index,
      row_idx: item.row_idx,
      region: item.region || "(нет региона)",
      cohort_kind: item.cohort_kind || "(нет типа)",
      valuesResolved: rec.valuesResolved,
    };
  });
}

function analyticsGetOverview(): AnalyticsOverview {
  const importsRow = db.prepare(`SELECT COUNT(*) AS c FROM imports`).get() as { c: number };
  const rawRowsRow = db.prepare(`SELECT COUNT(DISTINCT sheet_id || ':' || row_idx) AS c FROM raw_cells`).get() as { c: number };
  const unresolvedRow = db.prepare(`SELECT COUNT(*) AS c FROM conflicts WHERE resolved_choice IS NULL`).get() as { c: number };
  const resolvedRows = getResolvedRowsForAnalytics();
  const canUsePatient = CANON_FIELD_CODE_SET.has(PATIENT_ID_CODE);
  const patientSet = new Set<string>();
  if (canUsePatient) {
    for (const row of resolvedRows) {
      const pid = (row.valuesResolved[PATIENT_ID_CODE] ?? "").trim();
      if (pid) patientSet.add(`${row.import_id}:${pid}`);
    }
  }
  return {
    imports_count: Number(importsRow.c ?? 0),
    raw_rows_count: Number(rawRowsRow.c ?? 0),
    canon_rows_count: resolvedRows.length,
    patients_count: canUsePatient ? patientSet.size : null,
    unresolved_conflicts_count: Number(unresolvedRow.c ?? 0),
  };
}

function analyticsGetBreakdown(): AnalyticsBreakdownItem[] {
  const rows = getResolvedRowsForAnalytics();
  const canUsePatient = CANON_FIELD_CODE_SET.has(PATIENT_ID_CODE);
  const grouped = new Map<string, { cohort_kind: string; region: string; rows_count: number; patients: Set<string> }>();
  for (const row of rows) {
    const key = `${row.cohort_kind}|||${row.region}`;
    const bucket = grouped.get(key) ?? { cohort_kind: row.cohort_kind, region: row.region, rows_count: 0, patients: new Set<string>() };
    bucket.rows_count += 1;
    if (canUsePatient) {
      const pid = (row.valuesResolved[PATIENT_ID_CODE] ?? "").trim();
      if (pid) bucket.patients.add(`${row.import_id}:${pid}`);
    }
    grouped.set(key, bucket);
  }
  return Array.from(grouped.values())
    .map((x) => ({ cohort_kind: x.cohort_kind, region: x.region, rows_count: x.rows_count, patients_count: canUsePatient ? x.patients.size : null }))
    .sort((a, b) => a.cohort_kind.localeCompare(b.cohort_kind) || a.region.localeCompare(b.region));
}

function analyticsGetMissingnessTop(): AnalyticsMissingnessItem[] {
  const rows = getResolvedRowsForAnalytics();
  const total = rows.length;
  if (total === 0) {
    return CANON_FIELD_OPTIONS.slice(0, 10).map((f) => ({ canon_code: f.code, missing_count: 0, total_rows: 0, missing_ratio: 0 }));
  }

  const items = CANON_FIELD_OPTIONS.map((f) => {
    let missing = 0;
    for (const row of rows) {
      const v = row.valuesResolved[f.code] ?? "";
      if (v === null || v === "") missing += 1;
    }
    return { canon_code: f.code, missing_count: missing, total_rows: total, missing_ratio: missing / total };
  });

  return items.sort((a, b) => b.missing_ratio - a.missing_ratio || b.missing_count - a.missing_count).slice(0, 10);
}

function analyticsExportReportCsv(): AnalyticsReportExportResult {
  const overview = analyticsGetOverview();
  const breakdown = analyticsGetBreakdown();
  const missingness = analyticsGetMissingnessTop();

  return dialog.showSaveDialog({
    title: "Export analytics report",
    defaultPath: "analytics-report.csv",
    filters: [{ name: "CSV", extensions: ["csv"] }],
  }).then((result) => {
    if (result.canceled || !result.filePath) throw new Error("Export cancelled");

    const lines: string[] = [];
    lines.push("section,key,value");
    lines.push(["overview", "imports_count", String(overview.imports_count)].map(csvEscape).join(","));
    lines.push(["overview", "raw_rows_count", String(overview.raw_rows_count)].map(csvEscape).join(","));
    lines.push(["overview", "canon_rows_count", String(overview.canon_rows_count)].map(csvEscape).join(","));
    lines.push(["overview", "patients_count", overview.patients_count === null ? "n/a" : String(overview.patients_count)].map(csvEscape).join(","));
    lines.push(["overview", "unresolved_conflicts_count", String(overview.unresolved_conflicts_count)].map(csvEscape).join(","));

    lines.push("");
    lines.push("breakdown,cohort_kind,region,rows_count,patients_count");
    for (const x of breakdown) {
      lines.push(["breakdown", x.cohort_kind, x.region, String(x.rows_count), x.patients_count === null ? "n/a" : String(x.patients_count)].map(csvEscape).join(","));
    }

    lines.push("");
    lines.push("missingness,canon_code,missing_count,total_rows,missing_ratio");
    for (const x of missingness) {
      lines.push(["missingness", x.canon_code, String(x.missing_count), String(x.total_rows), String(x.missing_ratio)].map(csvEscape).join(","));
    }

    fs.writeFileSync(result.filePath, `${lines.join("\n")}\n`, "utf8");
    return { path: result.filePath, writtenBytes: fs.statSync(result.filePath).size };
  });
}

export function registerIpcHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.IMPORT_FILE, (_evt, request: ImportFileRequest): ImportFileResult => {
    const template: TemplateSignature = {
      template_signature_id: crypto.randomUUID(),
      name: "stub-template",
      workbook_fingerprint: "offline-fingerprint",
      sheet_names: ["Sheet1"],
      version: 1,
      created_at: nowIso(),
    };
    return {
      batch: {
        import_id: crypto.randomUUID(),
        region_code: request.region_code,
        source_path: request.source_path,
        source_name: request.source_path.split(/[\\/]/).pop() ?? "unknown",
        format: request.source_path.toLowerCase().endsWith(".csv") ? "csv" : "xlsx",
        template_signature_id: template.template_signature_id,
        imported_at: nowIso(),
        source_sha256: "offline-placeholder",
      },
      template_signature: template,
    };
  });

  ipcMain.handle(IPC_CHANNELS.LIST_MAPPINGS, (): MappingConfig[] => []);
  ipcMain.handle(IPC_CHANNELS.REBUILD_CANON, (_evt, request: RebuildCanonRequest): RebuildCanonResult => ({ import_id: request.import_id, patients: 0, courses: 0, events: 0 }));
  ipcMain.handle(IPC_CHANNELS.LIST_PATIENTS, (): CanonPatient[] => []);
  ipcMain.handle(IPC_CHANNELS.LIST_COURSES, (): CanonCourse[] => []);
  ipcMain.handle(IPC_CHANNELS.LIST_EVENTS, (): CanonEvent[] => []);
  ipcMain.handle(IPC_CHANNELS.SAVE_OVERRIDE, (_evt, request: SaveOverrideRequest): OverridePatch => ({ override_id: crypto.randomUUID(), created_at: nowIso(), ...request.patch }));
  ipcMain.handle(IPC_CHANNELS.LIST_CONFLICTS, (): ConflictRecord[] => []);
  ipcMain.handle(IPC_CHANNELS.RESOLVE_CONFLICT, (_evt, _request: ResolveConflictRequest) => undefined);
  ipcMain.handle(IPC_CHANNELS.EXPORT_DATA, (_evt, request: ExportRequest) => ({ output_path: request.output_path }));

  ipcMain.handle(IPC_CHANNELS.IMPORTS_LIST, (): ImportsListItem[] => db.prepare(`SELECT id, region_code, source_filename, file_hash, template_signature, imported_at FROM imports ORDER BY imported_at DESC`).all() as ImportsListItem[]);
  ipcMain.handle(IPC_CHANNELS.IMPORTS_GET, (_evt, importId: string): ImportMeta | null => {
    const row = db.prepare(`SELECT i.id, i.region_code, i.source_filename, i.file_hash, i.template_signature, i.imported_at, sf.stored_path FROM imports i LEFT JOIN stored_files sf ON sf.import_id = i.id WHERE i.id = ?`).get(importId) as ImportMeta | undefined;
    return row ?? null;
  });
  ipcMain.handle(IPC_CHANNELS.IMPORTS_UPDATE_META, (_evt, importId: string, patch: ImportMetaPatch): ImportMetaExtended => updateImportMeta(importId, patch));

  ipcMain.handle(IPC_CHANNELS.RAW_PREVIEW, (_evt, request: RawPreviewRequest): RawPreviewResponse => {
    const sheetIndex = request.sheet_index ?? 0;
    const rowFrom = request.row_from ?? 0;
    const rowCount = request.row_count ?? 30;
    const colCount = request.col_count ?? 20;
    const grid = Array.from({ length: rowCount }, () => Array.from({ length: colCount }, () => ""));

    const sheet = db.prepare(`SELECT id FROM raw_sheets WHERE import_id = ? AND sheet_index = ?`).get(request.import_id, sheetIndex) as { id: string } | undefined;
    if (sheet) {
      const rows = db.prepare(`SELECT row_idx, col_idx, value_text FROM raw_cells WHERE sheet_id = ? AND row_idx BETWEEN ? AND ? AND col_idx BETWEEN 0 AND ? ORDER BY row_idx, col_idx`).all(sheet.id, rowFrom, rowFrom + rowCount - 1, colCount - 1) as Array<{ row_idx: number; col_idx: number; value_text: string | null }>;
      for (const row of rows) {
        const rr = row.row_idx - rowFrom;
        if (rr >= 0 && rr < rowCount && row.col_idx >= 0 && row.col_idx < colCount) grid[rr][row.col_idx] = row.value_text ?? "";
      }
    }
    return { import_id: request.import_id, sheet_index: sheetIndex, row_from: rowFrom, row_count: rowCount, col_count: colCount, grid };
  });

  ipcMain.handle(IPC_CHANNELS.OVERRIDES_SET_CELL, (_evt, request: OverrideSetCellRequest): { id: string } => {
    const identity = buildOverrideIdentity(request.import_id, request.sheet_index, request.row_idx, request.col_idx);
    db.prepare(`INSERT OR REPLACE INTO overrides(id, entity_type, entity_uid, patch_json, updated_at) VALUES (?, ?, ?, ?, ?)`).run(identity, "raw_cell", identity, JSON.stringify({ import_id: request.import_id, sheet_index: request.sheet_index, row_idx: request.row_idx, col_idx: request.col_idx, value: request.value }), nowIso());
    return { id: identity };
  });
  ipcMain.handle(IPC_CHANNELS.OVERRIDES_CLEAR_CELL, (_evt, request: OverrideClearCellRequest): { deleted: boolean } => {
    const result = db.prepare(`DELETE FROM overrides WHERE id = ?`).run(buildOverrideIdentity(request.import_id, request.sheet_index, request.row_idx, request.col_idx));
    return { deleted: result.changes > 0 };
  });

  ipcMain.handle(IPC_CHANNELS.CANON_REBUILD_V2, (_evt, request: CanonRebuildRequest): CanonRebuildResponse => ({ status: "not_implemented", import_id: request.import_id, message: "CANON rebuild from RAW+mapping is not implemented yet." }));

  ipcMain.handle(IPC_CHANNELS.IMPORTS_PICK_FILE, async (): Promise<PickFileResponse | null> => {
    const result = await dialog.showOpenDialog({ title: "Select CSV/TSV file", properties: ["openFile"], filters: [{ name: "Delimited files", extensions: ["csv", "tsv", "txt"] }] });
    if (result.canceled || result.filePaths.length === 0) return null;
    const selectedPath = result.filePaths[0];
    return { path: selectedPath, name: path.basename(selectedPath), ext: ensureAllowedExtension(selectedPath), sizeBytes: fs.statSync(selectedPath).size };
  });
  ipcMain.handle(IPC_CHANNELS.IMPORTS_RUN_CSV_IMPORT, async (_evt, request: RunCsvImportRequest): Promise<RunCsvImportResponse> => {
    const out = await runCsvImport(db, request);
    if (request.mapping_template_id) {
      db.prepare(`UPDATE imports SET mapping_template_id = ? WHERE id = ?`).run(request.mapping_template_id, out.import_id);
    }
    return out;
  });

  ipcMain.handle(IPC_CHANNELS.CANON_FIELDS, () => CANON_FIELD_OPTIONS);

  ipcMain.handle(IPC_CHANNELS.MAPPING_TEMPLATES_LIST, (_evt, region?: string, sheet_kind?: string) => listMappingTemplates(region, sheet_kind));
  ipcMain.handle(IPC_CHANNELS.MAPPING_TEMPLATES_GET, (_evt, id: string) => getMappingTemplate(id));
  ipcMain.handle(IPC_CHANNELS.MAPPING_TEMPLATES_UPSERT, (_evt, request: any) => upsertMappingTemplate(request));
  ipcMain.handle(IPC_CHANNELS.MAPPING_TEMPLATES_DELETE, (_evt, id: string): { ok: true } => {
    db.prepare(`DELETE FROM mapping_templates WHERE id = ?`).run(id);
    return { ok: true };
  });
  ipcMain.handle(IPC_CHANNELS.MAPPING_TEMPLATES_FROM_LAST_IMPORT, (_evt, region: string, sheet_kind?: string) => createTemplateDraftFromLastImport(region, sheet_kind ?? "patients"));
  ipcMain.handle(IPC_CHANNELS.MAPPINGS_SAVE, (_evt, request: SaveMappingRequest): MappingSnapshot => {
    const sheetIndex = request.sheet_index ?? 0;
    const seenCodes = new Set<string>();
    const seenCols = new Set<number>();
    for (const pair of request.map) {
      if (!CANON_FIELD_CODE_SET.has(pair.canon_code)) throw new Error(`Unknown canon_code: ${pair.canon_code}`);
      if (seenCodes.has(pair.canon_code)) throw new Error(`Duplicate canon_code mapping: ${pair.canon_code}`);
      if (seenCols.has(pair.col_idx)) throw new Error(`Duplicate col_idx mapping: ${pair.col_idx}`);
      seenCodes.add(pair.canon_code);
      seenCols.add(pair.col_idx);
    }
    const importRow = db.prepare(`SELECT region_code, template_signature FROM imports WHERE id = ?`).get(request.import_id) as { region_code: string; template_signature: string } | undefined;
    if (!importRow) throw new Error("Import not found");
    const maxVersion = db.prepare(`SELECT COALESCE(MAX(version), 0) AS v FROM mappings WHERE template_signature = ? AND region_code = ?`).get(importRow.template_signature, importRow.region_code) as { v: number };
    const mappingId = crypto.randomUUID();
    const version = Number(maxVersion.v) + 1;
    const payload = { import_id: request.import_id, sheet_index: sheetIndex, header_row_idx: request.header_row_idx, data_start_row_idx: request.data_start_row_idx, map: request.map };
    db.prepare(`INSERT INTO mappings(id, template_signature, region_code, version, mapping_json, created_at) VALUES (?, ?, ?, ?, ?, ?)`).run(mappingId, importRow.template_signature, importRow.region_code, version, JSON.stringify(payload), nowIso());
    return { ...payload, mapping_id: mappingId, mapping_version: version };
  });
  ipcMain.handle(IPC_CHANNELS.MAPPINGS_LOAD, (_evt, request: LoadMappingRequest): MappingSnapshot | null => loadMappingForImport(request));
  ipcMain.handle(IPC_CHANNELS.CANON_BUILD_FOR_IMPORT, (_evt, request: BuildCanonForImportRequest): BuildCanonForImportResponse => buildCanonForImport(request));

  ipcMain.handle(IPC_CHANNELS.COHORTS_LIST, (_evt, request: CohortsListRequest): CohortsListResponse => cohortsList(request));
  ipcMain.handle(IPC_CHANNELS.CANON_GET_RECORD, (_evt, import_id: string, row_idx: number, sheet_index?: number): CanonRecordResponse => getCanonRecord(import_id, row_idx, sheet_index ?? 0));

  ipcMain.handle(IPC_CHANNELS.OVERRIDES_SET, (_evt, request: CanonOverrideRequest): { ok: true } => {
    if (!CANON_FIELD_CODE_SET.has(request.canon_code)) throw new Error(`Unknown canon_code: ${request.canon_code}`);
    const id = buildCanonOverrideIdentity(request.import_id, request.sheet_index, request.row_idx, request.canon_code);
    db.prepare(`INSERT OR REPLACE INTO overrides(id, entity_type, entity_uid, patch_json, updated_at) VALUES (?, ?, ?, ?, ?)`).run(id, "canon_field", id, JSON.stringify({ canon_code: request.canon_code, value: request.value }), nowIso());
    return { ok: true };
  });
  ipcMain.handle(IPC_CHANNELS.OVERRIDES_CLEAR, (_evt, request: CanonOverrideClearRequest): { ok: true } => {
    db.prepare(`DELETE FROM overrides WHERE id = ?`).run(buildCanonOverrideIdentity(request.import_id, request.sheet_index, request.row_idx, request.canon_code));
    return { ok: true };
  });
  ipcMain.handle(IPC_CHANNELS.OVERRIDES_LIST_FOR_ROW, (_evt, request: CanonOverridesListForRowRequest): CanonOverrideItem[] => listCanonOverridesForRow(request));

  ipcMain.handle(IPC_CHANNELS.EXPORT_CHOOSE_SAVE_PATH, async (_evt, request: ExportChooseSavePathRequest): Promise<{ path: string | null }> => {
    const result = await dialog.showSaveDialog({ title: "Save CANON CSV", defaultPath: request.defaultName, filters: [{ name: "CSV", extensions: ["csv"] }] });
    return { path: result.canceled ? null : result.filePath ?? null };
  });
  ipcMain.handle(IPC_CHANNELS.EXPORT_CANON_CSV, (_evt, request: ExportCanonCsvRequest): ExportCanonCsvResponse => exportCanonCsv(request));
  ipcMain.handle(IPC_CHANNELS.CONFLICTS_SCAN, (_evt, request: ConflictsScanRequest): ConflictsScanResponse => scanConflicts(request));

  ipcMain.handle(IPC_CHANNELS.ANALYTICS_GET_OVERVIEW, (): AnalyticsOverview => analyticsGetOverview());
  ipcMain.handle(IPC_CHANNELS.ANALYTICS_GET_BREAKDOWN, (): AnalyticsBreakdownItem[] => analyticsGetBreakdown());
  ipcMain.handle(IPC_CHANNELS.ANALYTICS_GET_MISSINGNESS_TOP, (): AnalyticsMissingnessItem[] => analyticsGetMissingnessTop());
  ipcMain.handle(IPC_CHANNELS.ANALYTICS_EXPORT_REPORT_CSV, async (): Promise<AnalyticsReportExportResult> => analyticsExportReportCsv());

  ipcMain.handle(IPC_CHANNELS.MANUAL_LIST, (_evt, request: ManualListRequest) => listManualRows(request));
  ipcMain.handle(IPC_CHANNELS.MANUAL_CREATE, (_evt, request: ManualCreateRequest): ManualRow => manualCreate(request));
  ipcMain.handle(IPC_CHANNELS.MANUAL_UPDATE, (_evt, request: ManualUpdateRequest): ManualRow => manualUpdate(request));
  ipcMain.handle(IPC_CHANNELS.MANUAL_DELETE, (_evt, request: ManualDeleteRequest): { ok: true } => manualDelete(request));

  ipcMain.handle(IPC_CHANNELS.DB_GET_INFO, (): DbInfoResponse => getDbInfo());

  ipcMain.handle(IPC_CHANNELS.DB_BACKUP_NOW, (): DbBackupNowResponse => backupNow());

  ipcMain.handle(IPC_CHANNELS.DB_EXPORT_COPY, async (_evt, request?: DbExportCopyRequest): Promise<DbExportCopyResponse> => {
    const result = await dialog.showSaveDialog({
      title: "Export DB copy",
      defaultPath: request?.defaultName ?? "bazzza-export.db",
      filters: [{ name: "SQLite DB", extensions: ["db"] }],
    });
    if (result.canceled || !result.filePath) throw new Error("Export cancelled");
    db.pragma("wal_checkpoint(TRUNCATE)");
    fs.copyFileSync(currentDbPath, result.filePath);
    return { path: result.filePath, writtenBytes: fs.statSync(result.filePath).size };
  });

  ipcMain.handle(IPC_CHANNELS.DB_CHOOSE_OPEN, async (): Promise<DbChooseOpenResponse> => {
    const result = await dialog.showOpenDialog({
      title: "Open existing DB",
      properties: ["openFile"],
      filters: [{ name: "SQLite DB", extensions: ["db"] }],
    });
    if (result.canceled || result.filePaths.length === 0) return { switched: false, dbPath: null };
    const selected = result.filePaths[0];
    validateDbPathForOpen(selected);
    try {
      backupNow();
    } catch {
      // best effort backup
    }
    setConfiguredDbPath(selected);
    relaunchAfterSwitch();
  });

  ipcMain.handle(IPC_CHANNELS.DB_CHOOSE_CREATE, async (_evt, request?: DbChooseCreateRequest): Promise<DbChooseOpenResponse> => {
    const result = await dialog.showSaveDialog({
      title: "Create new DB",
      defaultPath: request?.defaultName ?? "bazzza.db",
      filters: [{ name: "SQLite DB", extensions: ["db"] }],
    });
    if (result.canceled || !result.filePath) return { switched: false, dbPath: null };
    validateDbPathForCreate(result.filePath);
    fs.mkdirSync(path.dirname(result.filePath), { recursive: true });
    if (!fs.existsSync(result.filePath)) fs.writeFileSync(result.filePath, "", "utf8");
    try {
      backupNow();
    } catch {
      // best effort backup
    }
    setConfiguredDbPath(result.filePath);
    relaunchAfterSwitch();
  });

  ipcMain.handle(IPC_CHANNELS.DB_RESET_TO_DEFAULT, (): { switched: true } => {
    try {
      backupNow();
    } catch {
      // best effort backup
    }
    resetConfiguredDbPath();
    relaunchAfterSwitch();
  });
}
