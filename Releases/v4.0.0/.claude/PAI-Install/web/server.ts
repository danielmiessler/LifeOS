/**
 * PAI Installer v4.0 — Web Server
 * Bun HTTP + WebSocket server for the thick-client web installer.
 * Serves static files and handles WebSocket communication.
 */

// Prevent unhandled errors from crashing the server
process.on("uncaughtException", (err) => {
  console.error("[PAI Installer] Uncaught exception:", err.message);
});
process.on("unhandledRejection", (err: any) => {
  console.error("[PAI Installer] Unhandled rejection:", err?.message || err);
});

import { existsSync, readFileSync } from "fs";
import { join, extname } from "path";
import { handleWsMessage, addClient, removeClient } from "./routes";

const PORT = parseInt(process.env.PAI_INSTALL_PORT || "1337");
const PUBLIC_DIR = join(import.meta.dir, "..", "public");

// ─── MIME Types ──────────────────────────────────────────────────

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "application/javascript",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".ico": "image/x-icon",
};

// ─── Inactivity Timeout ──────────────────────────────────────────

const INACTIVITY_MS = 30 * 60 * 1000; // 30 minutes
let inactivityTimer: Timer | null = null;

function resetInactivity(): void {
  if (inactivityTimer) clearTimeout(inactivityTimer);
  inactivityTimer = setTimeout(() => {
    console.log("\n[PAI Installer] Shutting down due to inactivity.");
    process.exit(0);
  }, INACTIVITY_MS);
}

// ─── Server ──────────────────────────────────────────────────────

const server = Bun.serve({
  port: PORT,
  hostname: "127.0.0.1", // Localhost only — never expose to network

  fetch(req, server) {
    resetInactivity();

    const url = new URL(req.url);

    // WebSocket upgrade
    if (url.pathname === "/ws") {
      const upgraded = server.upgrade(req);
      if (!upgraded) {
        return new Response("WebSocket upgrade failed", { status: 400 });
      }
      return undefined as any;
    }

    // Static file serving
    let filePath = url.pathname === "/" ? "/index.html" : url.pathname;
    const fullPath = join(PUBLIC_DIR, filePath);

    // Security: prevent directory traversal
    if (!fullPath.startsWith(PUBLIC_DIR)) {
      return new Response("Forbidden", { status: 403 });
    }

    if (existsSync(fullPath)) {
      const ext = extname(fullPath);
      const mime = MIME_TYPES[ext] || "application/octet-stream";
      const content = readFileSync(fullPath);
      return new Response(content, {
        headers: {
          "content-type": mime,
          "cache-control": "no-cache, no-store, must-revalidate",
        },
      });
    }

    // Fallback to index.html for SPA routing
    const indexPath = join(PUBLIC_DIR, "index.html");
    if (existsSync(indexPath)) {
      return new Response(readFileSync(indexPath), {
        headers: { "content-type": "text/html", "cache-control": "no-cache" },
      });
    }

    return new Response("Not Found", { status: 404 });
  },

  websocket: {
    open(ws) {
      addClient(ws);
      ws.send(JSON.stringify({ type: "connected", port: PORT }));
    },
    message(ws, message) {
      resetInactivity();
      handleWsMessage(ws, typeof message === "string" ? message : message.toString());
    },
    close(ws) {
      removeClient(ws);
    },
  },
});

resetInactivity();

console.log(`PAI Installer server running on http://127.0.0.1:${PORT}/`);

export { server };
