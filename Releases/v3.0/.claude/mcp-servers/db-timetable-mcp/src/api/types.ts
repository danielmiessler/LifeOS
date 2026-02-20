/**
 * Type-Definitionen für die DB Timetable API
 * Basierend auf der OpenAPI-Spezifikation
 */

export enum EventStatus {
	PLANNED = "p", // Geplantes Ereignis
	ADDED = "a", // Hinzugefügtes Ereignis
	CANCELLED = "c", // Storniertes Ereignis
}

export enum MessageType {
	HIM = "h", // Störungsmeldung (HIM - Hafas Information Manager)
	QUALITY_CHANGE = "q", // Qualitätsänderung
	FREE = "f", // Freie Meldung
	CAUSE_OF_DELAY = "d", // Verspätungsursache
	IBIS = "i", // IBIS-Meldung (Integriertes Bord-Informations-System)
	UNASSIGNED_IBIS_MESSAGE = "u", // Nicht zugeordnete IBIS-Meldung
	DISRUPTION = "r", // Betriebsstörung
	CONNECTION = "c", // Anschlussinformation
}

export enum Priority {
	HIGH = "1", // Hohe Priorität
	MEDIUM = "2", // Mittlere Priorität
	LOW = "3", // Niedrige Priorität
	DONE = "4", // Erledigt
}

export enum ConnectionStatus {
	WAITING = "w", // Wartend
	TRANSITION = "n", // Übergang
	ALTERNATIVE = "a", // Alternative
}

export enum DelaySource {
	LEIBIT = "L", // LEIBIT (Leit- und Informationssystem für den Betriebsdienst)
	RISNE_AUT = "NA", // RIS::NE automatisch (Reisendeninformationssystem Nahverkehr)
	RISNE_MAN = "NM", // RIS::NE manuell
	VDV = "V", // VDV (Verband Deutscher Verkehrsunternehmen)
	ISTP_AUT = "IA", // ISTP automatisch (Integrierte Steuerung Transportprozesse)
	ISTP_MAN = "IM", // ISTP manuell
	AUTOMATIC_PROGNOSIS = "A", // Automatische Prognose
}

export enum DistributorType {
	CITY = "s", // Stadt
	REGION = "r", // Region
	LONG_DISTANCE = "f", // Fernverkehr
	OTHER = "x", // Sonstige
}

export enum TripType {
	P = "p", // Personenzug (Personentransport)
	E = "e", // Eilzug (Schnellerer Personenzug)
	Z = "z", // Zusatzzug (Sonderzug)
	S = "s", // S-Bahn (Stadtschnellbahn)
	H = "h", // Hilfszug (Notfall- oder Wartungszug)
	N = "n", // Nachtzug (Nachtverkehr)
}

export enum ReferenceTripRelationToStop {
	BEFORE = "b", // Vor dem Halt
	END = "e", // Ende des Halts
	BETWEEN = "c", // Zwischen Halten
	START = "s", // Beginn des Halts
	AFTER = "a", // Nach dem Halt
}

export interface Event {
	/** Geplante Ankunftszeit (changed) */
	cde?: string;
	/** Letzte Änderungszeit */
	clt?: string;
	/** Geänderter Bahnsteig */
	cp?: string;
	/** Geänderter Bahnsteigpfad */
	cpth?: string;
	/** Status des geänderten Ereignisses */
	cs?: EventStatus;
	/** Geänderte Zeit */
	ct?: string;
	/** Verzögerungscode */
	dc?: number;
	/** Haltinformations-ID */
	hi?: number;
	/** Linie */
	l?: string;
	/** Zugehörige Meldungen */
	m?: Message[];
	/** Geplante Abfahrtszeit */
	pde?: string;
	/** Geplanter Bahnsteig */
	pp?: string;
	/** Geplanter Bahnsteigpfad */
	ppth?: string;
	/** Status des geplanten Ereignisses */
	ps?: EventStatus;
	/** Geplante Zeit */
	pt?: string;
	/** Zugattribut */
	tra?: string;
	/** Flügelzüge (durch Komma getrennte IDs) */
	wings?: string;
}

export interface Message {
	/** Code */
	c?: number;
	/** Kategorie */
	cat?: string;
	/** Verzögerung in Minuten */
	del?: number;
	/** Verteiler-Meldungen */
	dm?: DistributorMessage[];
	/** Ereigniscode */
	ec?: string;
	/** Externer Link */
	elnk?: string;
	/** Externer Text */
	ext?: string;
	/** Gültig von (Zeitstempel) */
	from?: string;
	/** Eindeutige Meldungs-ID */
	id: string;
	/** Interner Text */
	int?: string;
	/** Besitzer/Ersteller der Meldung */
	o?: string;
	/** Priorität der Meldung */
	pr?: Priority;
	/** Typ der Meldung */
	t: MessageType;
	/** Zugehörige Zugbezeichnungen */
	tl?: TripLabel[];
	/** Gültig bis (Zeitstempel) */
	to?: string;
	/** Zeitstempel der Meldungserstellung */
	ts: string;
}

export interface DistributorMessage {
	/** Interner Text */
	int?: string;
	/** Name des Verteilers */
	n?: string;
	/** Typ des Verteilers */
	t?: DistributorType;
	/** Zeitstempel */
	ts?: string;
}

export interface TripLabel {
	/** Kategorie des Zuges (z.B. ICE, RE, S) */
	c: string;
	/** Zusätzliche Flags */
	f?: string;
	/** Zugnummer */
	n: string;
	/** Betreiber-ID */
	o: string;
	/** Zugtyp */
	t?: TripType;
}

export interface TripReference {
	/** Referenzierte Zugbezeichnungen */
	rt?: TripLabel[];
	/** Zugbezeichnung */
	tl: TripLabel;
}

export interface Connection {
	/** Status der Verbindung */
	cs: ConnectionStatus;
	/** EVA-Nummer (eindeutige Stationskennung) */
	eva?: number;
	/** Verbindungs-ID */
	id: string;
	/** Referenzierter Halt */
	ref?: TimetableStop;
	/** Quell-Halt */
	s: TimetableStop;
	/** Zeitstempel */
	ts: string;
}

export interface HistoricDelay {
	/** Ankunftsverspätung */
	ar?: string;
	/** Verspätungsursache */
	cod?: string;
	/** Abfahrtsverspätung */
	dp?: string;
	/** Quelle der Verspätungsinformation */
	src?: DelaySource;
	/** Zeitstempel */
	ts?: string;
}

export interface HistoricPlatformChange {
	/** Ankunftsgleiswechsel */
	ar?: string;
	/** Ursache des Gleiswechsels */
	cot?: string;
	/** Abfahrtsgleiswechsel */
	dp?: string;
	/** Zeitstempel */
	ts?: string;
}

export interface ReferenceTrip {
	/** Ist abgeschlossen */
	c: boolean;
	/** Endpunkt */
	ea: ReferenceTripStopLabel;
	/** Referenz-ID */
	id: string;
	/** Referenz-Zugbezeichnung */
	rtl: ReferenceTripLabel;
	/** Startpunkt */
	sd: ReferenceTripStopLabel;
}

export interface ReferenceTripLabel {
	/** Kategorie des Zuges */
	c: string;
	/** Zugnummer */
	n: string;
}

export interface ReferenceTripStopLabel {
	/** EVA-Nummer der Station */
	eva: number;
	/** Index im Fahrplan */
	i: number;
	/** Name der Station */
	n: string;
	/** Geplante Zeit */
	pt: string;
}

export interface ReferenceTripRelation {
	/** Referenzfahrt */
	rt: ReferenceTrip;
	/** Beziehung zum Halt */
	rts: ReferenceTripRelationToStop;
}

export interface TimetableStop {
	/** Ankunftsereignis */
	ar?: Event;
	/** Verbindungen */
	conn?: Connection[];
	/** Abfahrtsereignis */
	dp?: Event;
	/** EVA-Nummer der Station */
	eva: number;
	/** Historische Verspätungen */
	hd?: HistoricDelay[];
	/** Historische Gleiswechsel */
	hpc?: HistoricPlatformChange[];
	/** Eindeutige ID des Halts */
	id: string;
	/** Meldungen */
	m?: Message[];
	/** Referenz zu einem anderen Zug */
	ref?: TripReference;
	/** Referenzfahrtbeziehungen */
	rtr?: ReferenceTripRelation[];
	/** Zugbezeichnung */
	tl?: TripLabel;
}

export interface Timetable {
	/** EVA-Nummer der Station */
	eva?: number;
	/** Meldungen */
	m?: Message[];
	/** Liste der Halte */
	s?: TimetableStop[];
	/** Name der Station */
	station?: string;
}

export interface StationData {
	/** DS100-Code (betriebliche Abkürzung) */
	ds100: string;
	/** EVA-Nummer (eindeutige Stationskennung) */
	eva: number;
	/** Metadaten */
	meta?: string;
	/** Name der Station */
	name: string;
	/** Plattform-Information */
	p?: string;
}

export interface MultipleStationData {
	/** Liste von Stationsdaten */
	station: StationData[];
}

export interface TimetableParams {
	/** EVA-Nummer der Station */
	evaNo: string;
}

export interface PlanParams extends TimetableParams {
	date: string; // Format YYMMDD
	hour: string; // Format HH
}

export interface StationParams {
	pattern: string;
}

export interface TimetableResponse {
	timetable: Timetable;
}

export interface StationResponse {
	stations: MultipleStationData;
}
