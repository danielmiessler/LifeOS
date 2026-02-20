import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("fastmcp", () => ({
	FastMCP: vi.fn().mockImplementation(() => ({
		addTool: vi.fn(),
		addResourceTemplate: vi.fn(),
		start: vi.fn(),
		on: vi.fn(),
	})),
}));

vi.mock("../config.js", () => ({
	config: {
		server: {
			name: "Test MCP Server",
			version: "1.0.0",
			transportType: "stdio",
			port: 8080,
			endpoint: "/test",
		},
		api: {
			baseUrl: "https://test-api.example.com",
			clientId: "test-id",
			clientSecret: "test-secret",
		},
		logging: {
			level: "info",
		},
	},
}));

vi.mock("../resources/index.js", () => ({
	resources: [
		{ name: "TestResource1", pattern: "test:resource1" },
		{ name: "TestResource2", pattern: "test:resource2" },
	],
}));

vi.mock("../tools/index.js", () => ({
	tools: [
		{ name: "TestTool1", description: "Test Tool 1" },
		{ name: "TestTool2", description: "Test Tool 2" },
	],
}));

vi.mock("../utils/logger.js", () => ({
	logger: {
		info: vi.fn(),
		error: vi.fn(),
		warn: vi.fn(),
		debug: vi.fn(),
	},
}));

describe("MCP Server", () => {
	const originalListeners = {
		SIGINT: process.listeners("SIGINT"),
		SIGTERM: process.listeners("SIGTERM"),
		uncaughtException: process.listeners("uncaughtException"),
		unhandledRejection: process.listeners("unhandledRejection"),
	};

	beforeEach(() => {
		process.removeAllListeners("SIGINT");
		process.removeAllListeners("SIGTERM");
		process.removeAllListeners("uncaughtException");
		process.removeAllListeners("unhandledRejection");

		process.exit = vi.fn() as unknown as (code?: number) => never;

		vi.resetModules();
	});

	afterEach(() => {
		process.removeAllListeners("SIGINT");
		process.removeAllListeners("SIGTERM");
		process.removeAllListeners("uncaughtException");
		process.removeAllListeners("unhandledRejection");

		for (const listener of originalListeners.SIGINT) {
			process.on("SIGINT", listener);
		}

		for (const listener of originalListeners.SIGTERM) {
			process.on("SIGTERM", listener);
		}

		for (const listener of originalListeners.uncaughtException) {
			process.on("uncaughtException", listener);
		}

		for (const listener of originalListeners.unhandledRejection) {
			process.on("unhandledRejection", listener);
		}

		vi.clearAllMocks();
	});

	test("Initialisiert FastMCP Server mit den korrekten Parametern", async () => {
		const { FastMCP } = await import("fastmcp");
		await import("../index.js");

		expect(FastMCP).toHaveBeenCalledWith({
			name: "Test MCP Server",
			version: "1.0.0",
		});
	});

	test("Fügt alle Tools und Ressourcen hinzu", async () => {
		const { logger } = await import("../utils/logger.js");
		const serverModule = await import("../index.js");
		const server = serverModule.default;

		expect(server.addTool).toHaveBeenCalledTimes(2);
		expect(server.addResourceTemplate).toHaveBeenCalledTimes(2);
		expect(logger.info).toHaveBeenCalledWith("Tool hinzugefügt: TestTool1");
		expect(logger.info).toHaveBeenCalledWith("Tool hinzugefügt: TestTool2");
		expect(logger.info).toHaveBeenCalledWith(
			"Ressource hinzugefügt: TestResource1",
		);
		expect(logger.info).toHaveBeenCalledWith(
			"Ressource hinzugefügt: TestResource2",
		);
	});

	test("Startet den Server im stdio-Modus", async () => {
		const serverModule = await import("../index.js");
		const server = serverModule.default;

		expect(server.start).toHaveBeenCalledWith({
			transportType: "stdio",
		});
	});

	test("Startet den Server im SSE-Modus, wenn konfiguriert", async () => {
		vi.doMock("../config.js", () => ({
			config: {
				server: {
					name: "Test MCP Server",
					version: "1.0.0",
					transportType: "sse",
					port: 9000,
					endpoint: "test-endpoint",
				},
				api: {
					baseUrl: "https://test-api.example.com",
					clientId: "test-id",
					clientSecret: "test-secret",
				},
				logging: {
					level: "info",
				},
			},
		}));

		vi.resetModules();

		const serverModule = await import("../index.js");
		const server = serverModule.default;

		expect(server.start).toHaveBeenCalledWith({
			transportType: "sse",
			sse: {
				endpoint: "/test-endpoint",
				port: 9000,
			},
		});
	});

	test("Registriert Event-Handler für connect und disconnect", async () => {
		const serverModule = await import("../index.js");
		const server = serverModule.default;

		expect(server.on).toHaveBeenCalledTimes(2);
		expect(server.on).toHaveBeenCalledWith("connect", expect.any(Function));
		expect(server.on).toHaveBeenCalledWith("disconnect", expect.any(Function));
	});

	test("Registriert Prozess-Event-Handler", async () => {
		await import("../index.js");

		expect(process.listeners("SIGINT").length).toBeGreaterThan(0);
		expect(process.listeners("SIGTERM").length).toBeGreaterThan(0);
		expect(process.listeners("uncaughtException").length).toBeGreaterThan(0);
		expect(process.listeners("unhandledRejection").length).toBeGreaterThan(0);

		process.emit("SIGINT");
		const { logger } = await import("../utils/logger.js");
		expect(logger.info).toHaveBeenCalledWith("Server wird beendet (SIGINT)");
		expect(process.exit).toHaveBeenCalledWith(0);
	});
});
