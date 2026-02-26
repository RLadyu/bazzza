import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CANON_FIELD_OPTIONS } from "../../../contracts/canon-fields";
import type { ManualRow } from "../../../contracts/ipc";

declare global {
  interface Window {
    api: import("../../../contracts/ipc").AppApi;
  }
}

export function ManualScreen() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<ManualRow[]>([]);
  const [region, setRegion] = useState("");
  const [cohortKind, setCohortKind] = useState<"prospective" | "retrospective">("retrospective");
  const [values, setValues] = useState<Record<string, string>>({});

  const load = async () => {
    const data = await window.api.manualList({ cohort_kind: "all", region: "all", limit: 500, offset: 0 });
    setRows(data.items);
  };

  useEffect(() => {
    void load();
  }, []);

  const create = async () => {
    await window.api.manualCreate({ region, cohort_kind: cohortKind, values });
    setRegion("");
    setCohortKind("retrospective");
    setValues({});
    await load();
  };

  return (
    <section>
      <h2>Manual</h2>

      <h3>+ Добавить пациента (manual)</h3>
      <label>
        region
        <input value={region} onChange={(e) => setRegion(e.target.value)} />
      </label>
      <label>
        cohort_kind
        <select value={cohortKind} onChange={(e) => setCohortKind(e.target.value as "prospective" | "retrospective")}>
          <option value="retrospective">retrospective</option>
          <option value="prospective">prospective</option>
        </select>
      </label>

      <div>
        {CANON_FIELD_OPTIONS.map((f) => (
          <label key={f.code}>
            {f.title}
            <input value={values[f.code] ?? ""} onChange={(e) => setValues((prev) => ({ ...prev, [f.code]: e.target.value }))} />
          </label>
        ))}
      </div>

      <button type="button" onClick={() => void create()}>
        Создать manual row
      </button>

      <h3>Manual rows</h3>
      <table>
        <thead>
          <tr>
            <th>patient_id</th>
            <th>region</th>
            <th>cohort_kind</th>
            <th>row_idx</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={`manual-${r.row_idx}`} onClick={() => navigate(`/patient?import_id=manual&sheet_index=${r.sheet_index}&row_idx=${r.row_idx}`)}>
              <td>{r.values["patient.source_patient_id"] ?? ""}</td>
              <td>{r.region}</td>
              <td>{r.cohort_kind}</td>
              <td>{r.row_idx}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
