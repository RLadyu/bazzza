import type { Repository, RawCapture } from "../../contracts/storage";
import type {
  CanonCourse,
  CanonEvent,
  CanonPatient,
  ConflictRecord,
  MappingConfig,
  OverridePatch,
} from "../../contracts/domain";

export class SqliteRepository implements Repository {
  init(): void {}
  saveRaw(_capture: RawCapture): void {}
  listMappings(_region_code?: string): MappingConfig[] {
    return [];
  }
  replaceCanon(_import_id: string, _patients: CanonPatient[], _courses: CanonCourse[], _events: CanonEvent[]): void {}
  listPatients(_import_id: string): CanonPatient[] {
    return [];
  }
  listCourses(_import_id: string): CanonCourse[] {
    return [];
  }
  listEvents(_import_id: string): CanonEvent[] {
    return [];
  }
  saveOverride(patch: OverridePatch): OverridePatch {
    return patch;
  }
  listConflicts(_import_id: string): ConflictRecord[] {
    return [];
  }
  resolveConflict(_conflict_id: string, _resolution: "keep_override" | "accept_source"): void {}
}
