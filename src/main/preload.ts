import { contextBridge, ipcRenderer } from "electron";
import { IPC_CHANNELS, type AppApi } from "../contracts/ipc";

const api: AppApi = {
  importFile: (request) => ipcRenderer.invoke(IPC_CHANNELS.IMPORT_FILE, request),
  listMappings: (region_code) => ipcRenderer.invoke(IPC_CHANNELS.LIST_MAPPINGS, region_code),
  rebuildCanon: (request) => ipcRenderer.invoke(IPC_CHANNELS.REBUILD_CANON, request),
  listPatients: (import_id, filters) => ipcRenderer.invoke(IPC_CHANNELS.LIST_PATIENTS, import_id, filters),
  listCourses: (import_id, filters) => ipcRenderer.invoke(IPC_CHANNELS.LIST_COURSES, import_id, filters),
  listEvents: (import_id) => ipcRenderer.invoke(IPC_CHANNELS.LIST_EVENTS, import_id),
  saveOverride: (request) => ipcRenderer.invoke(IPC_CHANNELS.SAVE_OVERRIDE, request),
  listConflicts: (import_id) => ipcRenderer.invoke(IPC_CHANNELS.LIST_CONFLICTS, import_id),
  resolveConflict: (request) => ipcRenderer.invoke(IPC_CHANNELS.RESOLVE_CONFLICT, request),
  exportData: (request) => ipcRenderer.invoke(IPC_CHANNELS.EXPORT_DATA, request),

  importsList: () => ipcRenderer.invoke(IPC_CHANNELS.IMPORTS_LIST),
  importsGet: (importId) => ipcRenderer.invoke(IPC_CHANNELS.IMPORTS_GET, importId),
  importsUpdateMeta: (importId, patch) => ipcRenderer.invoke(IPC_CHANNELS.IMPORTS_UPDATE_META, importId, patch),

  rawPreview: (request) => ipcRenderer.invoke(IPC_CHANNELS.RAW_PREVIEW, request),
  overridesSetCell: (request) => ipcRenderer.invoke(IPC_CHANNELS.OVERRIDES_SET_CELL, request),
  overridesClearCell: (request) => ipcRenderer.invoke(IPC_CHANNELS.OVERRIDES_CLEAR_CELL, request),
  canonRebuild: (request) => ipcRenderer.invoke(IPC_CHANNELS.CANON_REBUILD_V2, request),

  importsPickFile: () => ipcRenderer.invoke(IPC_CHANNELS.IMPORTS_PICK_FILE),
  importsRunCsvImport: (request) => ipcRenderer.invoke(IPC_CHANNELS.IMPORTS_RUN_CSV_IMPORT, request),

  canonFields: () => ipcRenderer.invoke(IPC_CHANNELS.CANON_FIELDS),
  mappingsSave: (request) => ipcRenderer.invoke(IPC_CHANNELS.MAPPINGS_SAVE, request),
  mappingsLoad: (request) => ipcRenderer.invoke(IPC_CHANNELS.MAPPINGS_LOAD, request),
  canonBuildForImport: (request) => ipcRenderer.invoke(IPC_CHANNELS.CANON_BUILD_FOR_IMPORT, request),

  listMappingTemplates: (region, sheet_kind) => ipcRenderer.invoke(IPC_CHANNELS.MAPPING_TEMPLATES_LIST, region, sheet_kind),
  getMappingTemplate: (id) => ipcRenderer.invoke(IPC_CHANNELS.MAPPING_TEMPLATES_GET, id),
  upsertMappingTemplate: (request) => ipcRenderer.invoke(IPC_CHANNELS.MAPPING_TEMPLATES_UPSERT, request),
  deleteMappingTemplate: (id) => ipcRenderer.invoke(IPC_CHANNELS.MAPPING_TEMPLATES_DELETE, id),
  createMappingTemplateFromLastImport: (region, sheet_kind) => ipcRenderer.invoke(IPC_CHANNELS.MAPPING_TEMPLATES_FROM_LAST_IMPORT, region, sheet_kind),

  cohortsList: (request) => ipcRenderer.invoke(IPC_CHANNELS.COHORTS_LIST, request),
  canonGetRecord: (import_id, row_idx, sheet_index) => ipcRenderer.invoke(IPC_CHANNELS.CANON_GET_RECORD, import_id, row_idx, sheet_index),
  overridesSet: (request) => ipcRenderer.invoke(IPC_CHANNELS.OVERRIDES_SET, request),
  overridesClear: (request) => ipcRenderer.invoke(IPC_CHANNELS.OVERRIDES_CLEAR, request),
  overridesListForRow: (request) => ipcRenderer.invoke(IPC_CHANNELS.OVERRIDES_LIST_FOR_ROW, request),

  exportChooseSavePath: (request) => ipcRenderer.invoke(IPC_CHANNELS.EXPORT_CHOOSE_SAVE_PATH, request),
  exportCanonCsv: (request) => ipcRenderer.invoke(IPC_CHANNELS.EXPORT_CANON_CSV, request),
  conflictsScan: (request) => ipcRenderer.invoke(IPC_CHANNELS.CONFLICTS_SCAN, request),

  manualList: (request) => ipcRenderer.invoke(IPC_CHANNELS.MANUAL_LIST, request),
  manualCreate: (request) => ipcRenderer.invoke(IPC_CHANNELS.MANUAL_CREATE, request),
  manualUpdate: (request) => ipcRenderer.invoke(IPC_CHANNELS.MANUAL_UPDATE, request),
  manualDelete: (request) => ipcRenderer.invoke(IPC_CHANNELS.MANUAL_DELETE, request),

  dbGetInfo: () => ipcRenderer.invoke(IPC_CHANNELS.DB_GET_INFO),
  dbChooseOpen: () => ipcRenderer.invoke(IPC_CHANNELS.DB_CHOOSE_OPEN),
  dbChooseCreate: (request) => ipcRenderer.invoke(IPC_CHANNELS.DB_CHOOSE_CREATE, request),
  dbExportCopy: (request) => ipcRenderer.invoke(IPC_CHANNELS.DB_EXPORT_COPY, request),
  dbBackupNow: () => ipcRenderer.invoke(IPC_CHANNELS.DB_BACKUP_NOW),
  dbResetToDefault: () => ipcRenderer.invoke(IPC_CHANNELS.DB_RESET_TO_DEFAULT),

  analyticsGetOverview: () => ipcRenderer.invoke(IPC_CHANNELS.ANALYTICS_GET_OVERVIEW),
  analyticsGetBreakdown: () => ipcRenderer.invoke(IPC_CHANNELS.ANALYTICS_GET_BREAKDOWN),
  analyticsGetMissingnessTop: () => ipcRenderer.invoke(IPC_CHANNELS.ANALYTICS_GET_MISSINGNESS_TOP),
  analyticsExportReportCsv: () => ipcRenderer.invoke(IPC_CHANNELS.ANALYTICS_EXPORT_REPORT_CSV),
};

contextBridge.exposeInMainWorld("api", api);
