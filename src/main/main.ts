import { app, BrowserWindow, session } from "electron";
import path from "node:path";

function enforceOfflineMode(): void {
  session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
    const isLocal =
      details.url.startsWith("file://") ||
      details.url.startsWith("devtools://") ||
      details.url.startsWith("http://localhost:");

    callback({ cancel: !isLocal });
  });
}

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    win.loadFile(path.join(__dirname, "../dist/index.html"));
  }
}

app.whenReady().then(async () => {
  const { registerIpcHandlers } = await import("./ipc");
  enforceOfflineMode();
  registerIpcHandlers();
  createWindow();
});
