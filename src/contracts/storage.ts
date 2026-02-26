import type {
  CanonCourse,
  CanonEvent,
  CanonPatient,
  ConflictRecord,
  ImportBatch,
  MappingConfig,
  OverridePatch,
  RawCell,
  RawMerge,
  RawSheetMeta,
  TemplateSignature,
} from "./domain";

export interface RawCapture {
  batch: ImportBatch;
  template_signature: TemplateSignature;
  sheets: RawSheetMeta[];
  cells: RawCell[];
  merges: RawMerge[];
}

export interface Repository {
  init(): void;
  saveRaw(capture: RawCapture): void;
  listMappings(region_code?: string): MappingConfig[];
  replaceCanon(import_id: string, patients: CanonPatient[], courses: CanonCourse[], events: CanonEvent[]): void;
  listPatients(import_id: string): CanonPatient[];
  listCourses(import_id: string): CanonCourse[];
  listEvents(import_id: string): CanonEvent[];
  saveOverride(patch: OverridePatch): OverridePatch;
  listConflicts(import_id: string): ConflictRecord[];
  resolveConflict(conflict_id: string, resolution: "keep_override" | "accept_source"): void;
}
