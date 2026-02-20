import {
	currentTimetableResource,
	PlannedTimetableResourceArgs,
	plannedTimetableResource,
	recentChangesResource,
	StationResourceArgs,
	stationResource,
	TimetableResourceArgs,
} from "./timetableResources.js";

export const resources = [
	currentTimetableResource,
	recentChangesResource,
	plannedTimetableResource,
	stationResource,
];

export {
	currentTimetableResource,
	recentChangesResource,
	plannedTimetableResource,
	stationResource,
	TimetableResourceArgs,
	PlannedTimetableResourceArgs,
	StationResourceArgs,
};
