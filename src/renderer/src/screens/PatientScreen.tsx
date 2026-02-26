import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { CANON_FIELD_OPTIONS } from "../../../contracts/canon-fields";
import type { CanonOverrideItem, CanonRecordResponse, ImportMetaExtended } from "../../../contracts/ipc";

declare global {
  interface Window {
    api: import("../../../contracts/ipc").AppApi;
  }
}

export function PatientScreen() {
  const location = useLocation();
  const params = useMemo(() => new URLSearchParams(location.search), [location.search]);

  const importId = params.get("import_id") ?? "";
  const sheetIndex = Number(params.get("sheet_index") ?? "0");
  const rowIdx = Number(params.get("row_idx") ?? "0");
  const isManual = importId === "manual";

  const [record, setRecord] = useState<CanonRecordResponse | null>(null);
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [meta, setMeta] = useState<ImportMetaExtended | null>(null);
  const [editMode, setEditMode] = useState(false);

  const load = async () => {
    if (!importId) return;
    const [rec, ovs, m] = await Promise.all([
      window.api.canonGetRecord(importId, rowIdx, sheetIndex),
      window.api.overridesListForRow({ import_id: importId, sheet_index: sheetIndex, row_idx: rowIdx }),
      importId === "manual" ? Promise.resolve(null) : window.api.importsGet(importId),
    ]);

    const ovMap: Record<string, string> = {};
    (ovs as CanonOverrideItem[]).forEach((x) => {
      ovMap[x.canon_code] = x.value;
    });

    setRecord(rec);
    setOverrides(ovMap);
    setDraft(isManual ? rec.values : ovMap);

    setMeta(
      m
        ? {
            ...m,
            cohort_kind: "retrospective",
            prospective_planned_months: 6,
          }
        : null,
    );
  };

  useEffect(() => {
    void load();
  }, [importId, sheetIndex, rowIdx]);

  const saveField = async (canonCode: string) => {
    if (isManual) {
      await window.api.manualUpdate({
        import_id: "manual",
        sheet_index: sheetIndex,
        row_idx: rowIdx,
        patchValues: { [canonCode]: draft[canonCode] ?? "" },
      });
    } else {
      await window.api.overridesSet({
        import_id: importId,
        sheet_index: sheetIndex,
        row_idx: rowIdx,
        canon_code: canonCode,
        value: draft[canonCode] ?? "",
      });
    }
    await load();
  };

  const clearField = async (canonCode: string) => {
    if (isManual) {
      await window.api.manualUpdate({
        import_id: "manual",
        sheet_index: sheetIndex,
        row_idx: rowIdx,
        patchValues: { [canonCode]: "" },
      });
    } else {
      await window.api.overridesClear({ import_id: importId, sheet_index: sheetIndex, row_idx: rowIdx, canon_code: canonCode });
    }
    await load();
  };

  const patientId = record?.valuesResolved["patient.source_patient_id"] ?? "";

  return (
    <section>
      <h2>Patient</h2>
      <p>
        patient_id: {patientId} | import_id: {importId} | row_idx: {rowIdx} | region: {meta?.region_code ?? (isManual ? "manual" : "")} | cohort_kind: {meta?.cohort_kind ?? ""}
      </p>

      <label>
        <input type="checkbox" checked={editMode} onChange={(e) => setEditMode(e.target.checked)} /> Редактировать
      </label>

      <table>
        <thead>
          <tr>
            <th>canon_code</th>
            <th>title</th>
            <th>base_value</th>
            <th>override_value</th>
            <th>resolved_value</th>
            <th>actions</th>
          </tr>
        </thead>
        <tbody>
          {CANON_FIELD_OPTIONS.map((field) => {
            const base = record?.values[field.code] ?? "";
            const overrideValue = overrides[field.code] ?? "";
            const resolved = record?.valuesResolved[field.code] ?? base;

            return (
              <tr key={field.code}>
                <td>{field.code}</td>
                <td>{field.title}</td>
                <td>{base}</td>
                <td>
                  {editMode ? (
                    <input value={draft[field.code] ?? (isManual ? base : overrideValue)} onChange={(e) => setDraft((prev) => ({ ...prev, [field.code]: e.target.value }))} />
                  ) : (
                    overrideValue
                  )}
                </td>
                <td>{resolved}</td>
                <td>
                  {editMode ? (
                    <>
                      <button type="button" onClick={() => void saveField(field.code)}>
                        Save
                      </button>
                      <button type="button" onClick={() => void clearField(field.code)}>
                        Clear
                      </button>
                    </>
                  ) : null}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}
