import type {
  CanonCourse,
  CanonEvent,
  CanonPatient,
  CohortFilters,
  ConflictRecord,
  ExportFormats,
  ImportBatch,
  MappingConfig,
  OverridePatch,
  TemplateSignature,
} from "./domain";
import type { CanonFieldOption } from "./canon-fields";
import type { AnalyticsBreakdownItem, AnalyticsMissingnessItem, AnalyticsOverview, AnalyticsReportExportResult } from "./analytics";

export interface ImportFileRequest {
  source_path: string;
  region_code: string;
}
export interface ImportFileResult {
  batch: ImportBatch;
  template_signature: TemplateSignature;
}
export interface RebuildCanonRequest {
  import_id: string;
  mapping_id: string;
  mapping_version: number;
}
export interface RebuildCanonResult {
  import_id: string;
  patients: number;
  courses: number;
  events: number;
}
export interface SaveOverrideRequest {
  patch: Omit<OverridePatch, "override_id" | "created_at">;
}
export interface ResolveConflictRequest {
  conflict_id: string;
  resolution: "keep_override" | "accept_source";
}
export interface ExportRequest {
  import_id: string;
  format: ExportFormats;
  output_path: string;
}

export interface ImportsListItem {
  id: string;
  region_code: string;
  source_filename: string;
  file_hash: string;
  template_signature: string;
  imported_at: string;
}
export interface ImportMeta {
  id: string;
  region_code: string;
  source_filename: string;
  file_hash: string;
  template_signature: string;
  imported_at: string;
  stored_path: string | null;
}

export interface RawPreviewRequest {
  import_id: string;
  sheet_index?: number;
  row_from?: number;
  row_count?: number;
  col_count?: number;
}
export interface RawPreviewResponse {
  import_id: string;
  sheet_index: number;
  row_from: number;
  row_count: number;
  col_count: number;
  grid: string[][];
}

export interface OverrideSetCellRequest {
  import_id: string;
  sheet_index: number;
  row_idx: number;
  col_idx: number;
  value: string | null;
}
export interface OverrideClearCellRequest {
  import_id: string;
  sheet_index: number;
  row_idx: number;
  col_idx: number;
}

export interface CanonRebuildRequest {
  import_id: string;
}
export interface CanonRebuildResponse {
  status: "ok" | "not_implemented";
  import_id: string;
  message: string;
}

export interface PickFileResponse {
  path: string;
  name: string;
  ext: ".csv" | ".tsv" | ".txt";
  sizeBytes: number;
}
export interface RunCsvImportRequest {
  filePath: string;
  region: string;
  note?: string;
  mapping_template_id?: string | null;
}
export interface RunCsvImportResponse {
  import_id: string;
  region: string;
  rows: number;
  cols: number;
  cellsInserted: number;
}

export interface MappingPair {
  col_idx: number;
  canon_code: string;
}
export interface SaveMappingRequest {
  import_id: string;
  sheet_index?: number;
  header_row_idx: number;
  data_start_row_idx: number;
  map: MappingPair[];
}
export interface LoadMappingRequest {
  import_id: string;
  sheet_index?: number;
}
export interface MappingSnapshot {
  import_id: string;
  sheet_index: number;
  header_row_idx: number;
  data_start_row_idx: number;
  map: MappingPair[];
  mapping_id: string;
  mapping_version: number;
}
export interface BuildCanonForImportRequest {
  import_id: string;
  sheet_index?: number;
  rebuild?: boolean;
}
export interface BuildCanonForImportResponse {
  import_id: string;
  rowsProcessed: number;
  canonCellsInserted: number;
}

export interface ImportMetaPatch {
  region?: string;
  cohort_kind?: "prospective" | "retrospective";
  prospective_planned_months?: number;
}
export interface ImportMetaExtended extends ImportMeta {
  cohort_kind: "prospective" | "retrospective";
  prospective_planned_months: number;
}

export interface CohortsListRequest {
  cohort_kind?: "prospective" | "retrospective" | "all";
  region?: string | "all";
  import_id?: string | "all" | "manual";
  search?: string;
  limit?: number;
  offset?: number;
}
export interface CohortsListItem {
  import_id: string;
  sheet_index: number;
  row_idx: number;
  region: string;
  cohort_kind: "prospective" | "retrospective";
  patient_id?: string;
  tx_start?: string;
  tx_end?: string;
  duration_months?: string;
  hasOverrides: boolean;
}
export interface CohortsListResponse {
  total: number;
  items: CohortsListItem[];
}

export interface CanonRecordResponse {
  import_id: string;
  sheet_index: number;
  row_idx: number;
  values: Record<string, string>;
  valuesResolved: Record<string, string>;
}

export interface CanonOverrideRequest {
  import_id: string;
  sheet_index: number;
  row_idx: number;
  canon_code: string;
  value: string;
}
export interface CanonOverrideClearRequest {
  import_id: string;
  sheet_index: number;
  row_idx: number;
  canon_code: string;
}
export interface CanonOverridesListForRowRequest {
  import_id: string;
  sheet_index: number;
  row_idx: number;
}
export interface CanonOverrideItem {
  canon_code: string;
  value: string;
}

export interface ExportChooseSavePathRequest {
  defaultName: string;
}
export interface ExportCanonCsvRequest {
  mode: "base" | "resolved";
  filters: CohortsListRequest;
  savePath: string;
}
export interface ExportCanonCsvResponse {
  writtenBytes: number;
  rows: number;
}

export interface ConflictsScanRequest {
  import_id?: "all" | string | "manual";
}
export interface ConflictsScanResponse {
  mappingUnknownCanon: Array<{ import_id: string; sheet_index: number; col_idx: number; canon_code: string }>;
  mappingDuplicates: Array<{ import_id: string; canon_code: string; sources: Array<{ sheet_index: number; col_idx: number }> }>;
  missingKeyFields: Array<{ import_id: string; sheet_index: number; row_idx: number; missing: string[] }>;
  duplicatePatientId: Array<{ import_id: string; patient_id: string; rows: Array<{ sheet_index: number; row_idx: number }> }>;
}

export interface ManualRow {
  import_id: "manual";
  sheet_index: number;
  row_idx: number;
  region: string;
  cohort_kind: "prospective" | "retrospective";
  values: Record<string, string>;
  created_at: number;
  updated_at: number;
}
export interface ManualListRequest {
  cohort_kind?: "prospective" | "retrospective" | "all";
  region?: string | "all";
  search?: string;
  limit?: number;
  offset?: number;
}
export interface ManualCreateRequest {
  region: string;
  cohort_kind: "prospective" | "retrospective";
  values: Record<string, string>;
}
export interface ManualUpdateRequest {
  import_id: "manual";
  sheet_index: number;
  row_idx: number;
  patchValues?: Record<string, string>;
  region?: string;
  cohort_kind?: "prospective" | "retrospective";
}
export interface ManualDeleteRequest {
  row_idx: number;
}



export interface DbInfoResponse {
  dbPath: string;
  exists: boolean;
  sizeBytes: number | null;
  lastModified: number | null;
}

export interface DbChooseOpenResponse {
  switched: boolean;
  dbPath: string | null;
}

export interface DbChooseCreateRequest {
  defaultName?: string;
}

export interface DbExportCopyRequest {
  defaultName?: string;
}

export interface DbExportCopyResponse {
  path: string;
  writtenBytes: number;
}

export interface DbBackupNowResponse {
  path: string;
  writtenBytes: number;
}

export interface MappingTemplateRule {
  canon: string;
  source: string | null;
  fixed: string | null;
  transform: "string" | "number" | "date";
}

export interface MappingTemplatePayload {
  version: number;
  rules: MappingTemplateRule[];
}

export interface MappingTemplate {
  id: string;
  name: string;
  region: string;
  sheet_kind: string;
  mapping_json: MappingTemplatePayload;
  created_at: string;
  updated_at: string;
}

export interface MappingTemplateUpsertRequest {
  id?: string;
  name: string;
  region: string;
  sheet_kind: string;
  mapping_json: MappingTemplatePayload;
}

export interface AppApi {
  importFile(request: ImportFileRequest): Promise<ImportFileResult>;
  listMappings(region_code?: string): Promise<MappingConfig[]>;
  rebuildCanon(request: RebuildCanonRequest): Promise<RebuildCanonResult>;
  listPatients(import_id: string, filters?: CohortFilters): Promise<CanonPatient[]>;
  listCourses(import_id: string, filters?: CohortFilters): Promise<CanonCourse[]>;
  listEvents(import_id: string): Promise<CanonEvent[]>;
  saveOverride(request: SaveOverrideRequest): Promise<OverridePatch>;
  listConflicts(import_id: string): Promise<ConflictRecord[]>;
  resolveConflict(request: ResolveConflictRequest): Promise<void>;
  exportData(request: ExportRequest): Promise<{ output_path: string }>;

  importsList(): Promise<ImportsListItem[]>;
  importsGet(importId: string): Promise<ImportMeta | null>;
  importsUpdateMeta(importId: string, patch: ImportMetaPatch): Promise<ImportMetaExtended>;

  rawPreview(request: RawPreviewRequest): Promise<RawPreviewResponse>;
  overridesSetCell(request: OverrideSetCellRequest): Promise<{ id: string }>;
  overridesClearCell(request: OverrideClearCellRequest): Promise<{ deleted: boolean }>;
  canonRebuild(request: CanonRebuildRequest): Promise<CanonRebuildResponse>;

  importsPickFile(): Promise<PickFileResponse | null>;
  importsRunCsvImport(request: RunCsvImportRequest): Promise<RunCsvImportResponse>;

  canonFields(): Promise<CanonFieldOption[]>;
  mappingsSave(request: SaveMappingRequest): Promise<MappingSnapshot>;
  mappingsLoad(request: LoadMappingRequest): Promise<MappingSnapshot | null>;
  canonBuildForImport(request: BuildCanonForImportRequest): Promise<BuildCanonForImportResponse>;
  listMappingTemplates(region?: string, sheet_kind?: string): Promise<MappingTemplate[]>;
  getMappingTemplate(id: string): Promise<MappingTemplate | null>;
  upsertMappingTemplate(request: MappingTemplateUpsertRequest): Promise<MappingTemplate>;
  deleteMappingTemplate(id: string): Promise<{ ok: true }>;
  createMappingTemplateFromLastImport(region: string, sheet_kind?: string): Promise<MappingTemplatePayload | null>;

  cohortsList(request: CohortsListRequest): Promise<CohortsListResponse>;
  canonGetRecord(import_id: string, row_idx: number, sheet_index?: number): Promise<CanonRecordResponse>;
  overridesSet(request: CanonOverrideRequest): Promise<{ ok: true }>;
  overridesClear(request: CanonOverrideClearRequest): Promise<{ ok: true }>;
  overridesListForRow(request: CanonOverridesListForRowRequest): Promise<CanonOverrideItem[]>;

  exportChooseSavePath(request: ExportChooseSavePathRequest): Promise<{ path: string | null }>;
  exportCanonCsv(request: ExportCanonCsvRequest): Promise<ExportCanonCsvResponse>;
  conflictsScan(request: ConflictsScanRequest): Promise<ConflictsScanResponse>;

  manualList(request: ManualListRequest): Promise<{ total: number; items: ManualRow[] }>;
  manualCreate(request: ManualCreateRequest): Promise<ManualRow>;
  manualUpdate(request: ManualUpdateRequest): Promise<ManualRow>;
  manualDelete(request: ManualDeleteRequest): Promise<{ ok: true }>;

  dbGetInfo(): Promise<DbInfoResponse>;
  dbChooseOpen(): Promise<DbChooseOpenResponse>;
  dbChooseCreate(request?: DbChooseCreateRequest): Promise<DbChooseOpenResponse>;
  dbExportCopy(request?: DbExportCopyRequest): Promise<DbExportCopyResponse>;
  dbBackupNow(): Promise<DbBackupNowResponse>;
  dbResetToDefault(): Promise<{ switched: true }>;

  analyticsGetOverview(): Promise<AnalyticsOverview>;
  analyticsGetBreakdown(): Promise<AnalyticsBreakdownItem[]>;
  analyticsGetMissingnessTop(): Promise<AnalyticsMissingnessItem[]>;
  analyticsExportReportCsv(): Promise<AnalyticsReportExportResult>;
}

export const IPC_CHANNELS = {
  IMPORT_FILE: "app:import-file",
  LIST_MAPPINGS: "app:list-mappings",
  REBUILD_CANON: "app:rebuild-canon",
  LIST_PATIENTS: "app:list-patients",
  LIST_COURSES: "app:list-courses",
  LIST_EVENTS: "app:list-events",
  SAVE_OVERRIDE: "app:save-override",
  LIST_CONFLICTS: "app:list-conflicts",
  RESOLVE_CONFLICT: "app:resolve-conflict",
  EXPORT_DATA: "app:export-data",

  IMPORTS_LIST: "imports:list",
  IMPORTS_GET: "imports:get",
  IMPORTS_UPDATE_META: "imports:updateMeta",

  RAW_PREVIEW: "raw:preview",
  OVERRIDES_SET_CELL: "overrides:setCell",
  OVERRIDES_CLEAR_CELL: "overrides:clearCell",
  CANON_REBUILD_V2: "canon:rebuild",

  IMPORTS_PICK_FILE: "imports:pickFile",
  IMPORTS_RUN_CSV_IMPORT: "imports:runCsvImport",

  CANON_FIELDS: "canon:fields",
  MAPPINGS_SAVE: "mappings:save",
  MAPPINGS_LOAD: "mappings:load",
  CANON_BUILD_FOR_IMPORT: "canon:buildForImport",
  MAPPING_TEMPLATES_LIST: "mappingTemplates:list",
  MAPPING_TEMPLATES_GET: "mappingTemplates:get",
  MAPPING_TEMPLATES_UPSERT: "mappingTemplates:upsert",
  MAPPING_TEMPLATES_DELETE: "mappingTemplates:delete",
  MAPPING_TEMPLATES_FROM_LAST_IMPORT: "mappingTemplates:createFromLastImport",

  COHORTS_LIST: "cohorts:list",
  CANON_GET_RECORD: "canon:getRecord",
  OVERRIDES_SET: "overrides:set",
  OVERRIDES_CLEAR: "overrides:clear",
  OVERRIDES_LIST_FOR_ROW: "overrides:listForRow",

  EXPORT_CHOOSE_SAVE_PATH: "export:chooseSavePath",
  EXPORT_CANON_CSV: "export:canonCsv",
  CONFLICTS_SCAN: "conflicts:scan",

  MANUAL_LIST: "manual:list",
  MANUAL_CREATE: "manual:create",
  MANUAL_UPDATE: "manual:update",
  MANUAL_DELETE: "manual:delete",

  DB_GET_INFO: "db:getInfo",
  DB_CHOOSE_OPEN: "db:chooseOpen",
  DB_CHOOSE_CREATE: "db:chooseCreate",
  DB_EXPORT_COPY: "db:exportCopy",
  DB_BACKUP_NOW: "db:backupNow",
  DB_RESET_TO_DEFAULT: "db:resetToDefault",

  ANALYTICS_GET_OVERVIEW: "analytics:getOverview",
  ANALYTICS_GET_BREAKDOWN: "analytics:getBreakdown",
  ANALYTICS_GET_MISSINGNESS_TOP: "analytics:getMissingnessTop",
  ANALYTICS_EXPORT_REPORT_CSV: "analytics:exportReportCsv",
} as const;
