import { useEffect, useMemo, useState } from "react";
import type {
  ImportMetaPatch,
  ImportsListItem,
  PickFileResponse,
  RawPreviewResponse,
  RunCsvImportResponse,
} from "../../../contracts/ipc";

declare global {
  interface Window {
    api: import("../../../contracts/ipc").AppApi;
  }
}

export function ImportsScreen() {
  const [imports, setImports] = useState<ImportsListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<RawPreviewResponse | null>(null);

  const [pickedFile, setPickedFile] = useState<PickFileResponse | null>(null);
  const [region, setRegion] = useState("");
  const [note, setNote] = useState("");
  const [importResult, setImportResult] = useState<RunCsvImportResponse | null>(null);
  const [templates, setTemplates] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");

  const [metaRegionByImport, setMetaRegionByImport] = useState<Record<string, string>>({});
  const [metaKindByImport, setMetaKindByImport] = useState<Record<string, "prospective" | "retrospective">>({});

  const loadImports = async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await window.api.importsList();
      setImports(rows);
      const tpls = await window.api.listMappingTemplates(region || undefined, "patients");
      setTemplates(tpls.map((t: any) => ({ id: t.id, name: t.name })));

      const nextRegion: Record<string, string> = {};
      const nextKind: Record<string, "prospective" | "retrospective"> = {};
      for (const row of rows) {
        const meta = await window.api.importsGet(row.id);
        nextRegion[row.id] = meta?.region_code ?? row.region_code;
        nextKind[row.id] = "retrospective";
      }
      setMetaRegionByImport(nextRegion);
      setMetaKindByImport(nextKind);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load imports");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadImports();
  }, []);

  const firstImport = useMemo(() => imports[0] ?? null, [imports]);

  const handlePreviewRaw = async () => {
    if (!firstImport) return;
    const response = await window.api.rawPreview({ import_id: firstImport.id, sheet_index: 0, row_from: 0, row_count: 21, col_count: 11 });
    setPreview(response);
  };

  const handlePickFile = async () => {
    setError(null);
    const file = await window.api.importsPickFile();
    setPickedFile(file);
  };

  const handleRunImport = async () => {
    if (!pickedFile) return;
    if (!region.trim()) {
      setError("Region is required");
      return;
    }

    setError(null);
    const result = await window.api.importsRunCsvImport({ filePath: pickedFile.path, region: region.trim(), note: note || undefined, mapping_template_id: selectedTemplateId || null });
    setImportResult(result);
    await loadImports();
  };

  const saveMeta = async (importId: string) => {
    const patch: ImportMetaPatch = {
      region: metaRegionByImport[importId] ?? "",
      cohort_kind: metaKindByImport[importId] ?? "retrospective",
    };
    await window.api.importsUpdateMeta(importId, patch);
  };

  return (
    <section>
      <h2>Imports</h2>
      {loading ? <p>Loading imports...</p> : null}
      {error ? <p>{error}</p> : null}

      <button type="button" onClick={handlePickFile}>
        Импортировать файл
      </button>

      {pickedFile ? (
        <div>
          <p>
            Выбран файл: {pickedFile.name} ({pickedFile.ext}, {pickedFile.sizeBytes} bytes)
          </p>
          <label>
            Region*
            <input value={region} onChange={(e) => setRegion(e.target.value)} placeholder="eu-west" />
          </label>
          <label>
            Note
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="optional" />
          </label>
          <label>
            Mapping template
            <select value={selectedTemplateId} onChange={(e) => setSelectedTemplateId(e.target.value)}>
              <option value="">(none)</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </label>
          <button type="button" onClick={handleRunImport}>
            Запустить импорт
          </button>
        </div>
      ) : null}

      {importResult ? <pre>{JSON.stringify(importResult, null, 2)}</pre> : null}

      <h3>Import meta</h3>
      {imports.map((row) => (
        <div key={row.id}>
          <div>{row.id}</div>
          <label>
            region
            <input
              value={metaRegionByImport[row.id] ?? row.region_code}
              onChange={(e) => setMetaRegionByImport((prev) => ({ ...prev, [row.id]: e.target.value }))}
            />
          </label>
          <label>
            cohort_kind
            <select
              value={metaKindByImport[row.id] ?? "retrospective"}
              onChange={(e) => setMetaKindByImport((prev) => ({ ...prev, [row.id]: e.target.value as "prospective" | "retrospective" }))}
            >
              <option value="retrospective">retrospective</option>
              <option value="prospective">prospective</option>
            </select>
          </label>
          <button type="button" onClick={() => void saveMeta(row.id)}>
            Save meta
          </button>
        </div>
      ))}

      <pre>{JSON.stringify(imports, null, 2)}</pre>

      <button type="button" disabled={!firstImport} onClick={handlePreviewRaw}>
        Preview RAW
      </button>

      {preview ? <pre>{JSON.stringify(preview, null, 2)}</pre> : null}
    </section>
  );
}
