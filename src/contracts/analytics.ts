export interface AnalyticsOverview {
  imports_count: number;
  raw_rows_count: number;
  canon_rows_count: number;
  patients_count: number | null;
  unresolved_conflicts_count: number;
}

export interface AnalyticsBreakdownItem {
  cohort_kind: string;
  region: string;
  rows_count: number;
  patients_count: number | null;
}

export interface AnalyticsMissingnessItem {
  canon_code: string;
  missing_count: number;
  total_rows: number;
  missing_ratio: number;
}

export interface AnalyticsReportExportResult {
  path: string;
  writtenBytes: number;
}
