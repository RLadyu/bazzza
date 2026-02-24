import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { CohortsListItem, CohortsListResponse, ImportsListItem } from "../../../contracts/ipc";

declare global {
  interface Window {
    api: import("../../../contracts/ipc").AppApi;
  }
}

export function CohortsScreen() {
  const navigate = useNavigate();
  const [imports, setImports] = useState<ImportsListItem[]>([]);
  const [items, setItems] = useState<CohortsListItem[]>([]);
  const [cohortKind, setCohortKind] = useState<"all" | "prospective" | "retrospective">("all");
  const [region, setRegion] = useState<string>("all");
  const [importId, setImportId] = useState<string>("all");
  const [search, setSearch] = useState("");

  const load = async () => {
    const importsRows = await window.api.importsList();
    setImports(importsRows);

    const response: CohortsListResponse = await window.api.cohortsList({
      cohort_kind: cohortKind,
      region,
      import_id: importId,
      search,
      limit: 200,
      offset: 0,
    });

    setItems(response.items);
  };

  useEffect(() => {
    void load();
  }, [cohortKind, region, importId]);

  const regionOptions = Array.from(new Set(imports.map((x) => x.region_code))).filter(Boolean);

  return (
    <section>
      <h2>Cohorts</h2>

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

      <button type="button" onClick={() => void load()}>
        Apply
      </button>

      <table>
        <thead>
          <tr>
            <th>patient_id</th>
            <th>region</th>
            <th>cohort_kind</th>
            <th>duration_months</th>
            <th>import_id</th>
            <th>row_idx</th>
            <th>overrides</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr
              key={`${item.import_id}:${item.sheet_index}:${item.row_idx}`}
              onClick={() => navigate(`/patient?import_id=${encodeURIComponent(item.import_id)}&sheet_index=${item.sheet_index}&row_idx=${item.row_idx}`)}
            >
              <td>{item.patient_id ?? ""}</td>
              <td>{item.region}</td>
              <td>{item.cohort_kind}</td>
              <td>{item.duration_months ?? ""}</td>
              <td>{item.import_id}</td>
              <td>{item.row_idx}</td>
              <td>{item.hasOverrides ? "yes" : "no"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
