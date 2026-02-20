import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { LogLevel, logger } from "../../utils/logger.js";

describe("Logger", () => {
	const originalConsole = {
		error: console.error,
		warn: console.warn,
		info: console.info,
		debug: console.debug,
		log: console.log,
	};

	beforeEach(() => {
		console.error = vi.fn();
		console.warn = vi.fn();
		console.info = vi.fn();
		console.debug = vi.fn();
		console.log = vi.fn();
	});

	afterEach(() => {
		console.error = originalConsole.error;
		console.warn = originalConsole.warn;
		console.info = originalConsole.info;
		console.debug = originalConsole.debug;
		console.log = originalConsole.log;
	});

	describe("Log Methoden", () => {
		test("debug() ruft console.debug auf", () => {
			logger.setLevel(LogLevel.DEBUG);
			logger.debug("Debug Nachricht");

			expect(console.debug).toHaveBeenCalled();
			const callArg = (console.debug as unknown as ReturnType<typeof vi.fn>)
				.mock.calls[0][0];
			expect(callArg).toContain("DEBUG");
			expect(callArg).toContain("Debug Nachricht");
		});

		test("info() ruft console.info auf", () => {
			logger.info("Info Nachricht");

			expect(console.info).toHaveBeenCalled();
			const callArg = (console.info as unknown as ReturnType<typeof vi.fn>).mock
				.calls[0][0];
			expect(callArg).toContain("INFO");
			expect(callArg).toContain("Info Nachricht");
		});

		test("warn() ruft console.warn auf", () => {
			logger.warn("Warn Nachricht");

			expect(console.warn).toHaveBeenCalled();
			const callArg = (console.warn as unknown as ReturnType<typeof vi.fn>).mock
				.calls[0][0];
			expect(callArg).toContain("WARN");
			expect(callArg).toContain("Warn Nachricht");
		});

		test("error() ruft console.error auf", () => {
			logger.error("Error Nachricht");

			expect(console.error).toHaveBeenCalled();
			const callArg = (console.error as unknown as ReturnType<typeof vi.fn>)
				.mock.calls[0][0];
			expect(callArg).toContain("ERROR");
			expect(callArg).toContain("Error Nachricht");
		});
	});

	describe("Log Level", () => {
		test("zeigt keine DEBUG-Nachrichten bei INFO Level", () => {
			logger.setLevel(LogLevel.INFO);
			logger.debug("Debug sollte nicht angezeigt werden");

			expect(console.debug).not.toHaveBeenCalled();
		});

		test("zeigt keine INFO-Nachrichten bei WARN Level", () => {
			logger.setLevel(LogLevel.WARN);
			logger.info("Info sollte nicht angezeigt werden");

			expect(console.info).not.toHaveBeenCalled();
		});

		test("zeigt keine WARN-Nachrichten bei ERROR Level", () => {
			logger.setLevel(LogLevel.ERROR);
			logger.warn("Warn sollte nicht angezeigt werden");

			expect(console.warn).not.toHaveBeenCalled();
		});

		test("zeigt ERROR-Nachrichten bei jedem Level", () => {
			logger.setLevel(LogLevel.DEBUG);
			logger.error("Error sollte angezeigt werden");

			expect(console.error).toHaveBeenCalled();
		});
	});

	describe("Metadaten", () => {
		test("formatiert Metadaten korrekt", () => {
			const metadata = { user: "test", action: "login" };
			logger.info("Info mit Metadaten", metadata);

			const callArg = (console.info as unknown as ReturnType<typeof vi.fn>).mock
				.calls[0][0];
			expect(callArg).toContain("INFO");
			expect(callArg).toContain("Info mit Metadaten");
			expect(callArg).toContain('"user":"test"');
			expect(callArg).toContain('"action":"login"');
		});
	});
});
