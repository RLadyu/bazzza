import { useEffect, useState } from "react";
import type { ImportsListItem } from "../../../contracts/ipc";

declare global {
  interface Window {
    api: import("../../../contracts/ipc").AppApi;
  }
}

export function ExportScreen() {
  const [imports, setImports] = useState<ImportsListItem[]>([]);
  const [cohortKind, setCohortKind] = useState<"all" | "prospective" | "retrospective">("all");
  const [region, setRegion] = useState<string>("all");
  const [importId, setImportId] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [mode, setMode] = useState<"base" | "resolved">("base");
  const [savePath, setSavePath] = useState<string>("");
  const [result, setResult] = useState<{ writtenBytes: number; rows: number } | null>(null);

  useEffect(() => {
    const run = async () => setImports(await window.api.importsList());
    void run();
  }, []);

  const regionOptions = Array.from(new Set(imports.map((x) => x.region_code))).filter(Boolean);

  const choosePath = async () => {
    const chosen = await window.api.exportChooseSavePath({ defaultName: "canon_export.csv" });
    setSavePath(chosen.path ?? "");
  };

  const runExport = async () => {
    if (!savePath) return;
    const out = await window.api.exportCanonCsv({
      mode,
      filters: {
        cohort_kind: cohortKind,
        region,
        import_id: importId,
        search,
      },
      savePath,
    });
    setResult(out);
  };

  return (
    <section>
      <h2>Export</h2>

      <label>
        mode
        <select value={mode} onChange={(e) => setMode(e.target.value as "base" | "resolved")}>
          <option value="base">BASE</option>
          <option value="resolved">RESOLVED</option>
        </select>
      </label>

      <label>
        cohort_kind
        <select value={cohortKind} onChange={(e) => setCohortKind(e.target.value as "all" | "prospective" | "retrospective")}>
          <option value="all">all</option>
          <option value="prospective">prospective</option>
          <option value="retrospective">retrospective</option>
        </select>
      </label>

      <label>
        region
        <select value={region} onChange={(e) => setRegion(e.target.value)}>
          <option value="all">all</option>
          {regionOptions.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      </label>

      <label>
        import
        <select value={importId} onChange={(e) => setImportId(e.target.value)}>
          <option value="all">all</option>
          <option value="manual">manual</option>
          {imports.map((imp) => (
            <option key={imp.id} value={imp.id}>
              {imp.id}
            </option>
          ))}
        </select>
      </label>

      <label>
        search
        <input value={search} onChange={(e) => setSearch(e.target.value)} />
      </label>

      <button type="button" onClick={() => void choosePath()}>
        Выбрать файл…
      </button>

      <div>{savePath}</div>

      <button type="button" onClick={() => void runExport()} disabled={!savePath}>
        Экспортировать
      </button>

      {result ? (
        <pre>
          {JSON.stringify(
            {
              path: savePath,
              rows: result.rows,
              writtenBytes: result.writtenBytes,
            },
            null,
            2,
          )}
        </pre>
      ) : null}
    </section>
  );
}
