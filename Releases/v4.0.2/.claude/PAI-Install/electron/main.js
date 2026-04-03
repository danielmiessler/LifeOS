/**
 * PAI Installer — Electron Wrapper
 * Spawns the Bun web server, then opens a frameless window.
 * Audio autoplay is enabled (no browser restrictions).
 */

const { app, BrowserWindow } = require("electron");
const { spawn } = require("child_process");
const path = require("path");
const net = require("net");

// Force autoplay at the Chromium level (belt + suspenders with webPreferences)
app.commandLine.appendSwitch("autoplay-policy", "no-user-gesture-required");

const PORT = parseInt(process.env.PAI_INSTALL_PORT || "1337");
const INSTALLER_DIR = path.resolve(__dirname, "..");

let serverProcess = null;
let mainWindow = null;

// ─── Single Instance Lock ────────────────────────────────────────
// Prevents launching 20 copies of the installer

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

// ─── Wait for server to be ready ─────────────────────────────────

function waitForServer(port, timeout = 15000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    function tryConnect() {
      if (Date.now() - start > timeout) {
        return reject(new Error("Server start timeout"));
      }
      const socket = new net.Socket();
      socket.setTimeout(500);
      socket.once("connect", () => {
        socket.destroy();
        resolve();
      });
      socket.once("error", () => {
        socket.destroy();
        setTimeout(tryConnect, 200);
      });
      socket.once("timeout", () => {
        socket.destroy();
        setTimeout(tryConnect, 200);
      });
      socket.connect(port, "127.0.0.1");
    }
    tryConnect();
  });
}

// ─── Start Bun server ────────────────────────────────────────────

function startServer() {
  const mainTs = path.join(INSTALLER_DIR, "main.ts");
  serverProcess = spawn("bun", ["run", mainTs, "--mode", "web"], {
    cwd: INSTALLER_DIR,
    env: { ...process.env, PAI_INSTALL_PORT: String(PORT) },
    stdio: ["ignore", "pipe", "pipe"],
  });

  serverProcess.stdout.on("data", (data) => {
    process.stdout.write(data);
  });

  serverProcess.stderr.on("data", (data) => {
    process.stderr.write(data);
  });

  serverProcess.on("error", (err) => {
    console.error("Failed to start server:", err.message);
    app.quit();
  });

  serverProcess.on("exit", (code) => {
    if (code !== 0 && code !== null) {
      console.error(`Server exited with code ${code}`);
    }
  });
}

// ─── Create Window ───────────────────────────────────────────────

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: "#0f0f14",
    title: "PAI Installer",
    autoHideMenuBar: true,
    webPreferences: {
      autoplayPolicy: "no-user-gesture-required",
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  mainWindow.loadURL(`http://127.0.0.1:${PORT}/`);

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

// ─── App Lifecycle ───────────────────────────────────────────────

app.whenReady().then(async () => {
  startServer();

  try {
    await waitForServer(PORT);
  } catch (err) {
    console.error("Could not start installer server:", err.message);
    app.quit();
    return;
  }

  createWindow();
});

app.on("window-all-closed", () => {
  if (serverProcess) {
    serverProcess.kill();
    serverProcess = null;
  }
  app.quit();
});

app.on("before-quit", () => {
  if (serverProcess) {
    serverProcess.kill();
    serverProcess = null;
  }
});
