import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

// Mock von process und dotenv
vi.mock("node:path", () => ({
	default: {
		dirname: vi.fn(() => "/mock/dir"),
		resolve: vi.fn(() => "/mock/path/.env"),
	},
}));

vi.mock("dotenv", () => ({
	default: {
		config: vi.fn(),
	},
}));

describe("Konfiguration", () => {
	// Speichere originale Umgebungsvariablen
	const originalEnv = { ...process.env };
	const originalExit = process.exit;

	beforeEach(() => {
		// Mock der process.exit
		process.exit = vi.fn() as unknown as (code?: number) => never;

		// Zuvor geladene Module löschen
		vi.resetModules();

		// Umgebungsvariablen zurücksetzen
		process.env = { ...originalEnv };

		// Grundlegende API-Credentials setzen, die für das Laden der Konfiguration benötigt werden
		process.env.DB_TIMETABLE_CLIENT_ID = "test-client-id";
		process.env.DB_TIMETABLE_CLIENT_SECRET = "test-client-secret";
	});

	afterEach(() => {
		// Originale Umgebungsvariablen und Exit-Funktion wiederherstellen
		process.env = originalEnv;
		process.exit = originalExit;

		vi.clearAllMocks();
	});

	test("lädt die Standardkonfiguration, wenn keine Umgebungsvariablen gesetzt sind", async () => {
		const { config } = await import("../config.js");

		expect(config.server.transportType).toBe("stdio");
		expect(config.server.port).toBe(8080);
		expect(config.server.endpoint).toBe("/sse");
		expect(config.logging.level).toBe("info");
		expect(config.api.baseUrl).toBe(
			"https://apis.deutschebahn.com/db-api-marketplace/apis/timetables/v1",
		);
	});

	test("nutzt Umgebungsvariablen, wenn gesetzt", async () => {
		process.env.TRANSPORT_TYPE = "sse";
		process.env.PORT = "9000";
		process.env.SSE_ENDPOINT = "/custom-endpoint";
		process.env.LOG_LEVEL = "debug";

		const { config } = await import("../config.js");

		expect(config.server.transportType).toBe("sse");
		expect(config.server.port).toBe(9000);
		expect(config.server.endpoint).toBe("/custom-endpoint");
		expect(config.logging.level).toBe("debug");
	});

	test("beendet den Prozess, wenn API-Credentials fehlen", async () => {
		// Entferne API-Credentials
		process.env.DB_TIMETABLE_CLIENT_ID = "";
		process.env.DB_TIMETABLE_CLIENT_SECRET = "";

		// Ausgabe umlenken, um Fehlermeldungen zu unterdrücken
		const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

		try {
			await import("../config.js");
		} catch (_e) {
			// Ignorieren, da der Prozess beendet werden würde
		}

		expect(process.exit).toHaveBeenCalledWith(1);
		expect(consoleSpy).toHaveBeenCalled();

		consoleSpy.mockRestore();
	});
});
