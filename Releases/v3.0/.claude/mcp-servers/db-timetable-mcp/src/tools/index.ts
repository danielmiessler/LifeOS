import {
	findStationsTool,
	getCurrentTimetableTool,
	getPlannedTimetableTool,
	getRecentChangesTool,
} from "../tools/timetableTools.js";

export const tools = [
	getCurrentTimetableTool,
	getRecentChangesTool,
	getPlannedTimetableTool,
	findStationsTool,
];

export {
	getCurrentTimetableTool,
	getRecentChangesTool,
	getPlannedTimetableTool,
	findStationsTool,
};
