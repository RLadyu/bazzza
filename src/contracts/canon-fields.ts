export interface CanonFieldOption {
  code: string;
  title: string;
  required?: boolean;
}

export const CANON_FIELD_OPTIONS: CanonFieldOption[] = [
  { code: "patient.source_patient_id", title: "Patient: source_patient_id", required: true },
  { code: "patient.extra_json", title: "Patient: extra_json" },
  { code: "course.start_date", title: "Course: start_date" },
  { code: "course.end_date", title: "Course: end_date" },
  { code: "course.is_prospective", title: "Course: is_prospective", required: true },
  { code: "course.planned_end_date", title: "Course: planned_end_date" },
  { code: "course.duration_days", title: "Course: duration_days" },
  { code: "course.extra_json", title: "Course: extra_json" },
  { code: "event.event_date", title: "Event: event_date" },
  { code: "event.category", title: "Event: category" },
  { code: "event.payload_json", title: "Event: payload_json" },
  { code: "meta.region", title: "Meta: region", required: true },
];

export const CANON_FIELD_CODE_SET = new Set(CANON_FIELD_OPTIONS.map((item) => item.code));
