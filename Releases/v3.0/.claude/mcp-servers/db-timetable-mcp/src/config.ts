import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

// Lade Umgebungsvariablen aus .env Datei (für lokale Entwicklung)
// In Docker werden die Variablen direkt aus process.env gelesen
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Nur .env laden, wenn die Datei existiert (lokale Entwicklung)
// In Docker/Production werden Variablen direkt aus process.env gelesen
try {
	const envPath = path.resolve(__dirname, "../../.env");
	dotenv.config({ path: envPath });
} catch {
	// Ignore if .env file doesn't exist - use process.env directly
}

// Konfigurationswerte
// Priorität: process.env (Docker/Production) > .env Datei (lokale Entwicklung)
export const config = {
	server: {
		name: "DB Timetables MCP Server",
		version: "1.0.0",
		transportType: process.env.TRANSPORT_TYPE || "stdio", // 'stdio' oder 'httpStream'
		port: Number.parseInt(process.env.PORT || "8080", 10),
		host: process.env.HOST || "0.0.0.0", // Listen on all interfaces for Docker
		endpoint: process.env.SSE_ENDPOINT || "/sse",
	},
	api: {
		baseUrl:
			"https://apis.deutschebahn.com/db-api-marketplace/apis/timetables/v1",
		// Direkt aus process.env lesen (wird von Docker Compose gesetzt)
		// Unterstütze sowohl DB_TIMETABLE_* als auch MCP_DB_TIMETABLE_* Variablen
		clientId:
			process.env.DB_TIMETABLE_CLIENT_ID ||
			process.env.MCP_DB_TIMETABLE_CLIENT_ID ||
			"",
		clientSecret:
			process.env.DB_TIMETABLE_CLIENT_SECRET ||
			process.env.MCP_DB_TIMETABLE_CLIENT_SECRET ||
			"",
	},
	logging: {
		level: process.env.LOG_LEVEL || "info",
	},
};

if (!config.api.clientId || !config.api.clientSecret) {
	console.warn(
		"⚠️  API-Zugangsdaten fehlen! Bitte setze DB_TIMETABLE_CLIENT_ID und DB_TIMETABLE_CLIENT_SECRET in .env",
	);
	console.warn(
		"⚠️  Der Server startet ohne Credentials - API-Funktionen werden nicht verfügbar sein.",
	);
	// Don't exit - allow server to start for health checks and graceful degradation
}

export default config;
