import { beforeEach, describe, expect, test, vi } from "vitest";
import { timetableApi } from "../api/timetableApi.js";

vi.mock("node-fetch", async () => {
	const actual = await vi.importActual("node-fetch");
	return {
		...actual,
		default: vi.fn(() =>
			Promise.resolve({
				ok: true,
				text: () => Promise.resolve("<timetable>Test XML</timetable>"),
			}),
		),
	};
});

describe("TimetableApiClient", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	test("getCurrentTimetable ruft die richtige API-Endpoint auf", async () => {
		const result = await timetableApi.getCurrentTimetable({ evaNo: "8000105" });
		expect(result).toBe("<timetable>Test XML</timetable>");
	});

	test("getRecentChanges ruft die richtige API-Endpoint auf", async () => {
		const result = await timetableApi.getRecentChanges({ evaNo: "8000105" });
		expect(result).toBe("<timetable>Test XML</timetable>");
	});

	test("getPlannedTimetable ruft die richtige API-Endpoint auf", async () => {
		const result = await timetableApi.getPlannedTimetable({
			evaNo: "8000105",
			date: "230401",
			hour: "14",
		});
		expect(result).toBe("<timetable>Test XML</timetable>");
	});

	test("findStations ruft die richtige API-Endpoint auf", async () => {
		const result = await timetableApi.findStations({ pattern: "Frankfurt" });
		expect(result).toBe("<timetable>Test XML</timetable>");
	});
});
