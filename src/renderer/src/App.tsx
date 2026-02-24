import { NavLink, Navigate, Route, Routes } from "react-router-dom";
import { AnalyticsScreen } from "./screens/AnalyticsScreen";
import { CohortsScreen } from "./screens/CohortsScreen";
import { ConflictsScreen } from "./screens/ConflictsScreen";
import { ExportScreen } from "./screens/ExportScreen";
import { ImportsScreen } from "./screens/ImportsScreen";
import { MappingsScreen } from "./screens/MappingsScreen";
import { ManualScreen } from "./screens/ManualScreen";
import { PatientScreen } from "./screens/PatientScreen";
import { SettingsScreen } from "./screens/SettingsScreen";

const links = [
  ["/imports", "Imports"],
  ["/mappings", "Mappings"],
  ["/manual", "Manual"],
  ["/cohorts", "Cohorts"],
  ["/patient", "Patient"],
  ["/conflicts", "Conflicts"],
  ["/export", "Export"],
  ["/settings", "Settings"],
  ["/analytics", "Аналитика"],
] as const;

export function App() {
  return (
    <main>
      <h1>Bazzza (offline)</h1>
      <p>Network access disabled by product policy.</p>
      <nav>
        {links.map(([to, label]) => (
          <NavLink key={to} to={to} className={({ isActive }) => (isActive ? "active" : "")}>
            {label}
          </NavLink>
        ))}
      </nav>

      <Routes>
        <Route path="/" element={<Navigate to="/imports" replace />} />
        <Route path="/imports" element={<ImportsScreen />} />
        <Route path="/mappings" element={<MappingsScreen />} />
        <Route path="/manual" element={<ManualScreen />} />
        <Route path="/cohorts" element={<CohortsScreen />} />
        <Route path="/patient" element={<PatientScreen />} />
        <Route path="/conflicts" element={<ConflictsScreen />} />
        <Route path="/export" element={<ExportScreen />} />
        <Route path="/settings" element={<SettingsScreen />} />
        <Route path="/analytics" element={<AnalyticsScreen />} />
      </Routes>
    </main>
  );
}
