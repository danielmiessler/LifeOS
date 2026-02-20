import { beforeEach, describe, expect, test, vi } from "vitest";
import { timetableApi } from "../api/timetableApi.js";
import {
	findStationsTool,
	getCurrentTimetableTool,
	getPlannedTimetableTool,
	getRecentChangesTool,
} from "../tools/timetableTools.js";

vi.mock("../api/timetableApi.js", () => ({
	timetableApi: {
		getCurrentTimetable: vi
			.fn()
			.mockResolvedValue("<timetable>Current Data</timetable>"),
		getRecentChanges: vi
			.fn()
			.mockResolvedValue("<timetable>Recent Changes</timetable>"),
		getPlannedTimetable: vi
			.fn()
			.mockResolvedValue("<timetable>Planned Data</timetable>"),
		findStations: vi
			.fn()
			.mockResolvedValue("<stations>Station Data</stations>"),
	},
}));

describe("Timetable Tools", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe("getCurrentTimetableTool", () => {
		test("ruft timetableApi.getCurrentTimetable auf", async () => {
			const args = { evaNo: "8000105" };
			const result = await getCurrentTimetableTool.execute(args);

			expect(timetableApi.getCurrentTimetable).toHaveBeenCalledWith(args);
			expect(result).toBe("<timetable>Current Data</timetable>");
		});

		test("validiert Eingabeparameter", async () => {
			const invalidArgs = { evaNo: "" };
			await expect(
				getCurrentTimetableTool.execute(invalidArgs),
			).rejects.toThrow();
		});
	});

	describe("getRecentChangesTool", () => {
		test("ruft timetableApi.getRecentChanges auf", async () => {
			const args = { evaNo: "8000105" };
			const result = await getRecentChangesTool.execute(args);

			expect(timetableApi.getRecentChanges).toHaveBeenCalledWith(args);
			expect(result).toBe("<timetable>Recent Changes</timetable>");
		});
	});

	describe("getPlannedTimetableTool", () => {
		test("ruft timetableApi.getPlannedTimetable auf", async () => {
			const args = { evaNo: "8000105", date: "230401", hour: "14" };
			const result = await getPlannedTimetableTool.execute(args);

			expect(timetableApi.getPlannedTimetable).toHaveBeenCalledWith(args);
			expect(result).toBe("<timetable>Planned Data</timetable>");
		});

		test("validiert Datumsformat", async () => {
			const invalidArgs = { evaNo: "8000105", date: "2304", hour: "14" };
			await expect(
				getPlannedTimetableTool.execute(invalidArgs),
			).rejects.toThrow();
		});

		test("validiert Stundenformat", async () => {
			const invalidArgs = { evaNo: "8000105", date: "230401", hour: "24" };
			await expect(
				getPlannedTimetableTool.execute(invalidArgs),
			).rejects.toThrow();
		});
	});

	describe("findStationsTool", () => {
		test("ruft timetableApi.findStations auf", async () => {
			const args = { pattern: "Frankfurt" };
			const result = await findStationsTool.execute(args);

			expect(timetableApi.findStations).toHaveBeenCalledWith(args);
			expect(result).toBe("<stations>Station Data</stations>");
		});
	});
});
