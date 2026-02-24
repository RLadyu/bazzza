import { useEffect, useMemo, useState } from "react";
import { CANON_FIELD_OPTIONS } from "../../../contracts/canon-fields";
import type { MappingTemplate, MappingTemplatePayload, MappingTemplateRule } from "../../../contracts/ipc";

declare global {
  interface Window {
    api: import("../../../contracts/ipc").AppApi;
  }
}

export function MappingsScreen() {
  const [region, setRegion] = useState("");
  const [sheetKind, setSheetKind] = useState("patients");
  const [templates, setTemplates] = useState<MappingTemplate[]>([]);
  const [editing, setEditing] = useState<MappingTemplate | null>(null);
  const [name, setName] = useState("");
  const [rules, setRules] = useState<MappingTemplateRule[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [error, setError] = useState("");

  const loadTemplates = async () => {
    const rows = await window.api.listMappingTemplates(region || undefined, sheetKind);
    setTemplates(rows);
  };

  useEffect(() => {
    void loadTemplates();
  }, [region, sheetKind]);

  const requiredInvalid = useMemo(() => {
    return CANON_FIELD_OPTIONS.filter((f) => f.required).some((f) => {
      const rule = rules.find((r) => r.canon === f.code);
      return !rule || ((!rule.source || rule.source === "") && (!rule.fixed || rule.fixed === ""));
    });
  }, [rules]);

  const startCreate = () => {
    setEditing(null);
    setName("New template");
    setRules(CANON_FIELD_OPTIONS.map((f) => ({ canon: f.code, source: null, fixed: null, transform: "string" })));
  };

  const createFromLastImport = async () => {
    if (!region) return;
    const draft = await window.api.createMappingTemplateFromLastImport(region, sheetKind);
    if (!draft) return;
    setEditing(null);
    setName(`Template ${new Date().toISOString()}`);
    setRules(draft.rules);
    setHeaders(Array.from(new Set(draft.rules.map((x) => x.source).filter(Boolean))) as string[]);
  };

  const editTemplate = async (id: string) => {
    const tpl = await window.api.getMappingTemplate(id);
    if (!tpl) return;
    setEditing(tpl);
    setName(tpl.name);
    setRules(tpl.mapping_json.rules);
    setHeaders(Array.from(new Set(tpl.mapping_json.rules.map((x) => x.source).filter(Boolean))) as string[]);
  };

  const save = async () => {
    setError("");
    if (!region) {
      setError("Region is required");
      return;
    }
    if (requiredInvalid) {
      setError("Required fields must have source or fixed value");
      return;
    }
    await window.api.upsertMappingTemplate({
      id: editing?.id,
      name,
      region,
      sheet_kind: sheetKind,
      mapping_json: { version: 1, rules } as MappingTemplatePayload,
    });
    await loadTemplates();
  };

  const remove = async (id: string) => {
    await window.api.deleteMappingTemplate(id);
    await loadTemplates();
  };

  return (
    <section>
      <h2>Mappings</h2>
      {error ? <p>{error}</p> : null}

      <label>
        Region
        <input value={region} onChange={(e) => setRegion(e.target.value)} />
      </label>

      <label>
        Sheet kind
        <select value={sheetKind} onChange={(e) => setSheetKind(e.target.value)}>
          <option value="patients">patients</option>
        </select>
      </label>

      <button type="button" onClick={startCreate}>
        New template
      </button>
      <button type="button" onClick={() => void createFromLastImport()}>
        Create from last import
      </button>

      <h3>Templates</h3>
      <ul>
        {templates.map((t) => (
          <li key={t.id}>
            {t.name} ({t.updated_at})
            <button type="button" onClick={() => void editTemplate(t.id)}>
              Edit
            </button>
            <button type="button" onClick={() => void remove(t.id)}>
              Delete
            </button>
          </li>
        ))}
      </ul>

      <h3>Template editor</h3>
      <label>
        Name
        <input value={name} onChange={(e) => setName(e.target.value)} />
      </label>

      <table>
        <thead>
          <tr>
            <th>CANON field</th>
            <th>required</th>
            <th>Source column</th>
            <th>Fixed value</th>
            <th>Transform</th>
          </tr>
        </thead>
        <tbody>
          {rules.map((r, idx) => {
            const field = CANON_FIELD_OPTIONS.find((f) => f.code === r.canon);
            return (
              <tr key={r.canon}>
                <td>{r.canon}</td>
                <td>{field?.required ? "yes" : "no"}</td>
                <td>
                  <input
                    list="headers-list"
                    value={r.source ?? ""}
                    onChange={(e) => setRules((prev) => prev.map((x, i) => (i === idx ? { ...x, source: e.target.value || null } : x)))}
                  />
                </td>
                <td>
                  <input
                    value={r.fixed ?? ""}
                    onChange={(e) => setRules((prev) => prev.map((x, i) => (i === idx ? { ...x, fixed: e.target.value || null } : x)))}
                  />
                </td>
                <td>
                  <select
                    value={r.transform}
                    onChange={(e) => setRules((prev) => prev.map((x, i) => (i === idx ? { ...x, transform: e.target.value as "string" | "number" | "date" } : x)))}
                  >
                    <option value="string">string</option>
                    <option value="number">number</option>
                    <option value="date">date</option>
                  </select>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <datalist id="headers-list">
        {headers.map((h) => (
          <option key={h} value={h} />
        ))}
      </datalist>

      <button type="button" onClick={() => void save()}>
        Save
      </button>
    </section>
  );
}
