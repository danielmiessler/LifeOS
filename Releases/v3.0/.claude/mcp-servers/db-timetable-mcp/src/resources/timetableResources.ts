import { timetableApi } from "../api/timetableApi.js";
import { ValidationError } from "../utils/errorHandling.js";
import { logger } from "../utils/logger.js";

export interface TimetableResourceArgs {
	evaNo: string;
}

export interface PlannedTimetableResourceArgs {
	evaNo: string;
	date: string;
	hour: string;
}

export interface StationResourceArgs {
	pattern: string;
}

export const currentTimetableResource = {
	uriTemplate: "db-api:timetable/current/{evaNo}",
	name: "Aktuelle Fahrplandaten",
	description:
		"Aktuelle Fahrplandaten für eine Bahnhofsstation mit Informationen zu Ankunfts- und Abfahrtszeiten, Gleisen, Verspätungen und anderen relevanten Betriebsinformationen. Die Daten werden in Echtzeit von der DB Timetable API abgerufen und im XML-Format bereitgestellt.",
	mimeType: "application/xml",
	arguments: [
		{
			name: "evaNo",
			description: "EVA-Nummer der Station (z.B. 8000105 für Frankfurt Hbf)",
			required: true,
		},
	],
	async load({ evaNo }: TimetableResourceArgs) {
		logger.info("Lade aktuelle Fahrplandaten", { evaNo });

		if (!evaNo) {
			throw new ValidationError("EVA-Nummer ist erforderlich");
		}

		try {
			const data = await timetableApi.getCurrentTimetable({ evaNo });
			return {
				text: data,
			};
		} catch (error) {
			logger.error("Fehler beim Laden der aktuellen Fahrplandaten", {
				error,
				evaNo,
			});
			throw error;
		}
	},
};

export const recentChangesResource = {
	uriTemplate: "db-api:timetable/changes/{evaNo}",
	name: "Aktuelle Fahrplanänderungen",
	description:
		"Enthält aktuelle Fahrplanänderungen in Echtzeit für eine bestimmte Bahnhofsstation. Dies umfasst Informationen zu Verspätungen, Gleisänderungen, Ausfällen und andere relevante betriebliche Anpassungen. Die Daten werden von der DB Timetable API im XML-Format abgerufen.",
	mimeType: "application/xml",
	arguments: [
		{
			name: "evaNo",
			description: "EVA-Nummer der Station (z.B. 8000105 für Frankfurt Hbf)",
			required: true,
		},
	],
	async load({ evaNo }: TimetableResourceArgs) {
		logger.info("Lade aktuelle Fahrplanänderungen", { evaNo });

		if (!evaNo) {
			throw new ValidationError("EVA-Nummer ist erforderlich");
		}

		try {
			const data = await timetableApi.getRecentChanges({ evaNo });
			return {
				text: data,
			};
		} catch (error) {
			logger.error("Fehler beim Laden der aktuellen Fahrplanänderungen", {
				error,
				evaNo,
			});
			throw error;
		}
	},
};

export const plannedTimetableResource = {
	uriTemplate: "db-api:timetable/planned/{evaNo}/{date}/{hour}",
	name: "Geplante Fahrplandaten",
	description:
		"Geplante Fahrplandaten für eine Bahnhofsstation zu einer bestimmten Zeit",
	mimeType: "application/xml",
	arguments: [
		{
			name: "evaNo",
			description: "EVA-Nummer der Station (z.B. 8000105 für Frankfurt Hbf)",
			required: true,
		},
		{
			name: "date",
			description: "Datum im Format YYMMDD (z.B. 230401 für 01.04.2023)",
			required: true,
		},
		{
			name: "hour",
			description: "Stunde im Format HH (z.B. 14 für 14 Uhr)",
			required: true,
		},
	],
	async load({ evaNo, date, hour }: PlannedTimetableResourceArgs) {
		logger.info("Lade geplante Fahrplandaten", { evaNo, date, hour });

		if (!evaNo || !date || !hour) {
			throw new ValidationError(
				"Alle Parameter (evaNo, date, hour) sind erforderlich",
			);
		}

		if (!/^\d{6}$/.test(date)) {
			throw new ValidationError("Datum muss im Format YYMMDD sein");
		}

		if (!/^([0-1][0-9]|2[0-3])$/.test(hour)) {
			throw new ValidationError(
				"Stunde muss im Format HH sein und zwischen 00 und 23 liegen",
			);
		}

		try {
			const data = await timetableApi.getPlannedTimetable({
				evaNo,
				date,
				hour,
			});
			return {
				text: data,
			};
		} catch (error) {
			logger.error("Fehler beim Laden der geplanten Fahrplandaten", {
				error,
				evaNo,
				date,
				hour,
			});
			throw error;
		}
	},
};

export const stationResource = {
	uriTemplate: "db-api:station/{pattern}",
	name: "Stationssuche",
	description: "Suche nach Bahnhofsstationen anhand eines Musters",
	mimeType: "application/xml",
	arguments: [
		{
			name: "pattern",
			description: "Suchmuster für Stationen (z.B. Frankfurt oder 8000105)",
			required: true,
		},
	],
	async load({ pattern }: StationResourceArgs) {
		logger.info("Suche nach Stationen", { pattern });

		if (!pattern) {
			throw new ValidationError("Suchmuster ist erforderlich");
		}

		try {
			const data = await timetableApi.findStations({ pattern });
			return {
				text: data,
			};
		} catch (error) {
			logger.error("Fehler bei der Stationssuche", { error, pattern });
			throw error;
		}
	},
};
