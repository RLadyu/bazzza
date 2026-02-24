import { useEffect, useMemo, useState } from "react";
import type { AnalyticsBreakdownItem, AnalyticsMissingnessItem, AnalyticsOverview } from "../../../contracts/analytics";

declare global {
  interface Window {
    api: import("../../../contracts/ipc").AppApi;
  }
}

export function AnalyticsScreen() {
  const [overview, setOverview] = useState<AnalyticsOverview | null>(null);
  const [breakdown, setBreakdown] = useState<AnalyticsBreakdownItem[]>([]);
  const [missingness, setMissingness] = useState<AnalyticsMissingnessItem[]>([]);
  const [status, setStatus] = useState("");

  const load = async () => {
    setStatus("");
    try {
      const [o, b, m] = await Promise.all([
        window.api.analyticsGetOverview(),
        window.api.analyticsGetBreakdown(),
        window.api.analyticsGetMissingnessTop(),
      ]);
      setOverview(o);
      setBreakdown(b);
      setMissingness(m);
    } catch (error) {
      setStatus(`Ошибка загрузки аналитики: ${String(error)}`);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const patientKpiText = useMemo(() => {
    if (!overview) return "…";
    if (overview.patients_count === null) return "n/a (поле patient_id недоступно)";
    return String(overview.patients_count);
  }, [overview]);

  const onExport = async () => {
    setStatus("");
    try {
      const out = await window.api.analyticsExportReportCsv();
      setStatus(`Отчёт сохранён: ${out.path} (${out.writtenBytes} bytes)`);
    } catch (error) {
      setStatus(`Ошибка экспорта отчёта: ${String(error)}`);
    }
  };

  return (
    <section>
      <h2>Аналитика</h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(120px, 1fr))", gap: 8 }}>
        <div><strong>Импортов</strong><div>{overview?.imports_count ?? "…"}</div></div>
        <div><strong>Строк RAW</strong><div>{overview?.raw_rows_count ?? "…"}</div></div>
        <div><strong>Строк CANON resolved</strong><div>{overview?.canon_rows_count ?? "…"}</div></div>
        <div><strong>Пациентов</strong><div>{patientKpiText}</div></div>
        <div><strong>Неразрешённых конфликтов</strong><div>{overview?.unresolved_conflicts_count ?? "…"}</div></div>
      </div>

      <h3>Разбивка по группам/регионам</h3>
      <table>
        <thead>
          <tr>
            <th>cohort_kind</th>
            <th>region</th>
            <th>rows</th>
            <th>patients</th>
          </tr>
        </thead>
        <tbody>
          {breakdown.map((x, idx) => (
            <tr key={`${x.cohort_kind}:${x.region}:${idx}`}>
              <td>{x.cohort_kind || "(нет типа)"}</td>
              <td>{x.region || "(нет региона)"}</td>
              <td>{x.rows_count}</td>
              <td>{x.patients_count === null ? "n/a" : x.patients_count}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h3>Качество данных (top-10 пропусков)</h3>
      <table>
        <thead>
          <tr>
            <th>canon_code</th>
            <th>missing_count</th>
            <th>total_rows</th>
            <th>missing_ratio</th>
          </tr>
        </thead>
        <tbody>
          {missingness.map((x) => (
            <tr key={x.canon_code}>
              <td>{x.canon_code}</td>
              <td>{x.missing_count}</td>
              <td>{x.total_rows}</td>
              <td>{(x.missing_ratio * 100).toFixed(2)}%</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ display: "flex", gap: 8 }}>
        <button type="button" onClick={() => void load()}>Обновить</button>
        <button type="button" onClick={() => void onExport()}>Экспорт отчёта (CSV)</button>
      </div>

      {status ? <p>{status}</p> : null}
    </section>
  );
}
