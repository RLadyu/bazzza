import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const APP_NAME = "Bazzza";

export function getAppDataDir(): string {
  if (process.platform === "win32") {
    const base = process.env.APPDATA ?? path.join(os.homedir(), "AppData", "Roaming");
    return path.join(base, APP_NAME);
  }

  if (process.platform === "darwin") {
    return path.join(os.homedir(), "Library", "Application Support", APP_NAME);
  }

  const base = process.env.XDG_DATA_HOME ?? path.join(os.homedir(), ".local", "share");
  return path.join(base, APP_NAME);
}

export function getDatabasePath(fileName = "app.db"): string {
  const dir = getAppDataDir();
  fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, fileName);
}
