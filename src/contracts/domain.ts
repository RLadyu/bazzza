export type UUID = string;

export type ImportFormat = "xlsx" | "csv";

export interface ImportBatch {
  import_id: UUID;
  region_code: string;
  source_path: string;
  source_name: string;
  format: ImportFormat;
  template_signature_id: UUID;
  imported_at: string;
  source_sha256: string;
}

export interface TemplateSignature {
  template_signature_id: UUID;
  name: string;
  workbook_fingerprint: string;
  sheet_names: string[];
  version: number;
  created_at: string;
}

export interface RawSheetMeta {
  sheet_uid: UUID;
  import_id: UUID;
  sheet_name: string;
  sheet_index: number;
  is_hidden: boolean;
  tab_color: string | null;
  default_col_width: number | null;
  default_row_height: number | null;
}

export type RawCellType = "blank" | "string" | "number" | "boolean" | "date" | "error" | "formula";

export interface RawCell {
  sheet_uid: UUID;
  row_index: number;
  col_index: number;
  address: string;
  cell_type: RawCellType;
  value_raw: string | null;
  formula: string | null;
}

export interface RawMerge {
  sheet_uid: UUID;
  start_address: string;
  end_address: string;
}

export interface JoinRule {
  left_entity: "patient" | "course" | "event";
  left_field: string;
  right_entity: "patient" | "course" | "event";
  right_field: string;
  relation: "one_to_one" | "one_to_many";
}

export interface MappingFieldRule {
  target_entity: "patient" | "course" | "event";
  target_field: string;
  source_sheet: string;
  source_column: string;
  required: boolean;
  value_type: "string" | "number" | "date";
  parse_format?: string;
}

export interface MappingConfig {
  mapping_id: UUID;
  region_code: string;
  mapping_version: number;
  template_signature_id: UUID;
  rules: MappingFieldRule[];
  joins: JoinRule[];
  created_at: string;
}

export interface CanonPatient {
  patient_uid: UUID;
  import_id: UUID;
  payload: Record<string, string | number | null>;
}

export interface CanonCourse {
  course_uid: UUID;
  patient_uid: UUID;
  import_id: UUID;
  cohort_type: "prospective" | "retrospective";
  start_date: string | null;
  end_date: string | null;
  planned_end_date: string | null;
  duration_days: number | null;
  payload: Record<string, string | number | null>;
}

export interface CanonEvent {
  event_uid: UUID;
  patient_uid: UUID;
  course_uid: UUID;
  import_id: UUID;
  event_date: string | null;
  event_type: string;
  payload: Record<string, string | number | null>;
}

export interface OverridePatch {
  override_id: UUID;
  import_id: UUID;
  entity_type: "patient" | "course" | "event";
  entity_uid: UUID;
  field_name: string;
  value_override: string | number | null;
  reason: string;
  author: string;
  created_at: string;
}

export interface ConflictRecord {
  conflict_id: UUID;
  override_id: UUID;
  import_id: UUID;
  entity_type: "patient" | "course" | "event";
  entity_uid: UUID;
  field_name: string;
  source_prev: string | number | null;
  source_new: string | number | null;
  resolution: "keep_override" | "accept_source" | "open";
  detected_at: string;
}

export interface CohortFilters {
  cohort_type?: "prospective" | "retrospective";
  region_code?: string;
  start_from?: string;
  start_to?: string;
  include_with_conflicts?: boolean;
}

export type ExportFormats = "csv" | "xlsx" | "json";
