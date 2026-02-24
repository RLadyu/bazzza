import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { ConflictsScanResponse, ImportsListItem } from "../../../contracts/ipc";

declare global {
  interface Window {
    api: import("../../../contracts/ipc").AppApi;
  }
}

export function ConflictsScreen() {
  const navigate = useNavigate();
  const [imports, setImports] = useState<ImportsListItem[]>([]);
  const [importId, setImportId] = useState<string>("all");
  const [result, setResult] = useState<ConflictsScanResponse | null>(null);

  useEffect(() => {
    const run = async () => setImports(await window.api.importsList());
    void run();
  }, []);

  const scan = async () => {
    const out = await window.api.conflictsScan({ import_id: importId });
    setResult(out);
  };

  return (
    <section>
      <h2>Conflicts</h2>

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

      <button type="button" onClick={() => void scan()}>
        Scan
      </button>

      <h3>1) Unknown canon codes in mapping</h3>
      <pre>{JSON.stringify(result?.mappingUnknownCanon ?? [], null, 2)}</pre>

      <h3>2) Duplicate mappings</h3>
      <pre>{JSON.stringify(result?.mappingDuplicates ?? [], null, 2)}</pre>

      <h3>3) Missing key fields</h3>
      <ul>
        {(result?.missingKeyFields ?? []).map((item, idx) => (
          <li key={`mk-${idx}`} onClick={() => navigate(`/patient?import_id=${encodeURIComponent(item.import_id)}&sheet_index=${item.sheet_index}&row_idx=${item.row_idx}`)}>
            {item.import_id} / {item.sheet_index}:{item.row_idx} missing {item.missing.join(",")}
          </li>
        ))}
      </ul>

      <h3>4) Duplicate patient_id</h3>
      <ul>
        {(result?.duplicatePatientId ?? []).map((item, idx) => (
          <li key={`dp-${idx}`}>
            {item.import_id} / {item.patient_id}
            <ul>
              {item.rows.map((r, ridx) => (
                <li key={`r-${ridx}`} onClick={() => navigate(`/patient?import_id=${encodeURIComponent(item.import_id)}&sheet_index=${r.sheet_index}&row_idx=${r.row_idx}`)}>
                  {r.sheet_index}:{r.row_idx}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </section>
  );
}
