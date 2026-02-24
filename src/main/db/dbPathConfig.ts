import { app } from "electron";
import fs from "node:fs";
import path from "node:path";
import { getDatabasePath } from "../../db/path";

interface DbPathConfig {
  dbPath?: string;
}

function getConfigPath(): string {
  return path.join(app.getPath("userData"), "db-config.json");
}

function readConfig(): DbPathConfig {
  const configPath = getConfigPath();
  if (!fs.existsSync(configPath)) return {};
  try {
    const raw = fs.readFileSync(configPath, "utf8");
    return (JSON.parse(raw) as DbPathConfig) ?? {};
  } catch {
    return {};
  }
}

function writeConfig(config: DbPathConfig): void {
  const configPath = getConfigPath();
  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), "utf8");
}

export function getDefaultDbPath(): string {
  return getDatabasePath();
}

export function getConfiguredDbPath(): string {
  const config = readConfig();
  if (config.dbPath && config.dbPath.trim()) return config.dbPath;
  return getDefaultDbPath();
}

export function setConfiguredDbPath(dbPath: string): void {
  writeConfig({ dbPath });
}

export function resetConfiguredDbPath(): void {
  const configPath = getConfigPath();
  if (fs.existsSync(configPath)) fs.unlinkSync(configPath);
}

export function validateDbPathForOpen(dbPath: string): void {
  if (!dbPath) throw new Error("Database path is required.");
  if (!dbPath.toLowerCase().endsWith(".db")) throw new Error("Please select a .db file.");
  if (!fs.existsSync(dbPath)) throw new Error("Selected database file does not exist.");
}

export function validateDbPathForCreate(dbPath: string): void {
  if (!dbPath) throw new Error("Database path is required.");
  if (!dbPath.toLowerCase().endsWith(".db")) throw new Error("Please use .db extension for database files.");
}

export function getBackupsDir(): string {
  return path.join(app.getPath("userData"), "backups");
}
