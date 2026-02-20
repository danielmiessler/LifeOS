import fetch from "node-fetch";
import config from "../config.js";
import type { PlanParams, StationParams, TimetableParams } from "./types.js";

/**
 * API-Client für die DB Timetable API
 */
export class TimetableApiClient {
	private baseUrl: string;
	private clientId: string;
	private clientSecret: string;

	constructor() {
		this.baseUrl = config.api.baseUrl;
		this.clientId = config.api.clientId;
		this.clientSecret = config.api.clientSecret;
	}

	/**
	 * Sendet eine Anfrage an die API mit entsprechenden Authentifizierungsheadern
	 */
	private async request<T>(endpoint: string): Promise<T> {
		try {
			const response = await fetch(`${this.baseUrl}${endpoint}`, {
				method: "GET",
				headers: {
					"DB-Client-Id": this.clientId,
					"DB-Api-Key": this.clientSecret,
					Accept: "application/xml",
				},
			});

			if (!response.ok) {
				throw new Error(
					`API-Fehler: ${response.status} ${response.statusText}`,
				);
			}

			// Die API gibt XML zurück, aber wir behandeln es für MCP als Text
			// In einer erweiterten Implementierung könnte man hier einen XML-Parser verwenden
			const data = await response.text();

			// Für eine einfache Implementierung geben wir den XML-Text direkt zurück
			// In einer produktiven Implementierung würde man hier XML nach JSON konvertieren
			return data as unknown as T;
		} catch (error) {
			console.error("Fehler bei der API-Anfrage:", error);
			throw error;
		}
	}

	/**
	 * Ruft den aktuellen Fahrplan für eine Station ab
	 */
	async getCurrentTimetable({ evaNo }: TimetableParams): Promise<string> {
		return this.request<string>(`/fchg/${evaNo}`);
	}

	/**
	 * Ruft die letzten Änderungen für eine Station ab
	 */
	async getRecentChanges({ evaNo }: TimetableParams): Promise<string> {
		return this.request<string>(`/rchg/${evaNo}`);
	}

	/**
	 * Ruft geplante Fahrplandaten für eine bestimmte Station und Zeitspanne ab
	 */
	async getPlannedTimetable({
		evaNo,
		date,
		hour,
	}: PlanParams): Promise<string> {
		return this.request<string>(`/plan/${evaNo}/${date}/${hour}`);
	}

	/**
	 * Sucht nach Stationen, die dem angegebenen Muster entsprechen
	 */
	async findStations({ pattern }: StationParams): Promise<string> {
		return this.request<string>(`/station/${pattern}`);
	}
}

// Export Singleton
export const timetableApi = new TimetableApiClient();
