[![smithery badge](https://smithery.ai/badge/@jorekai/db-timetable-mcp)](https://smithery.ai/server/@jorekai/db-timetable-mcp)
# DB Timetable MCP Server

Ein Model Context Protocol (MCP) Server für die Deutsche Bahn Timetable API. Der Server bietet MCP-Tools und -Ressourcen, um auf Fahrplandaten, Stationsinformationen und Zugänderungen zuzugreifen.

**Pflicht zur Namensnennung:**  

Dieses Projekt stellt die Fahrplandaten der Deutschen Bahn bereit, die unter der [Creative Commons Attribution 4.0 International Lizenz (CC BY 4.0)](https://creativecommons.org/licenses/by/4.0/) öffentlich einsehbar sind.

Weitere Infos zur API und Lizenzbedingungen findest du unter [developers.deutschebahn.com](https://developers.deutschebahn.com/). API Requests unterliegen den Bedingungen der Lizenz.


## Funktionen

- **Aktuelle Fahrplände**: Abrufen aktueller Fahrplandaten für eine Station
- **Fahrplanänderungen**: Tracking der neuesten Änderungen
- **Geplante Fahrpläne**: Zugriff auf geplante Fahrplandaten für einen bestimmten Zeitpunkt
- **Stationssuche**: Suche nach Bahnhofsstationen anhand von Namen oder Codes

## Voraussetzungen

- Node.js 18 oder höher
- API-Zugangsdaten für die DB Timetable API (Client-ID und Client-Secret)

## Installation

1. Repository klonen:
   ```
   git clone <repository-url>
   cd db-mcp
   ```

2. Abhängigkeiten installieren:
   ```
   npm install
   ```

3. TypeScript-Code kompilieren:
   ```
   npm run build
   ```

## Konfiguration

Erstelle eine `.env`-Datei im Root-Verzeichnis des Projekts mit folgenden Umgebungsvariablen:

```
DB_TIMETABLE_CLIENT_ID=deine-client-id
DB_TIMETABLE_CLIENT_SECRET=dein-client-secret
TRANSPORT_TYPE=stdio
PORT=8080
SSE_ENDPOINT=/sse
LOG_LEVEL=info
```

### Konfigurationsoptionen

- `DB_TIMETABLE_CLIENT_ID`: Client-ID für die DB API (erforderlich)
- `DB_TIMETABLE_CLIENT_SECRET`: Client-Secret für die DB API (erforderlich)
- `TRANSPORT_TYPE`: Transporttyp für den MCP-Server (`stdio` oder `sse`, Standard: `stdio`)
- `PORT`: Port für den SSE-Server (Standard: `8080`)
- `SSE_ENDPOINT`: Endpunkt für SSE-Verbindungen (Standard: `/sse`)
- `LOG_LEVEL`: Logging-Level (`debug`, `info`, `warn`, `error`, Standard: `info`)

## Verwendung

### Server starten

Im stdio-Modus (für CLI-Tests und Debugging):

```bash
npm start
```

Im SSE-Modus (für Webclients):

```bash
TRANSPORT_TYPE=sse npm start
```

### Mit Inspect-Modus testen

Der Server kann mit dem FastMCP Inspector getestet werden:

```bash
npx fastmcp inspect path/to/index.js
```

### MCP-Tools

Der Server stellt folgende Tools bereit:

1. **getCurrentTimetable**: Ruft aktuelle Fahrplandaten für eine Station ab
   - Parameter: `evaNo` - EVA-Nummer der Station (z.B. 8000105 für Frankfurt Hbf)

2. **getRecentChanges**: Ruft aktuelle Änderungen für eine Station ab
   - Parameter: `evaNo` - EVA-Nummer der Station (z.B. 8000105 für Frankfurt Hbf)

3. **getPlannedTimetable**: Ruft geplante Fahrplandaten für eine Station ab
   - Parameter: 
     - `evaNo` - EVA-Nummer der Station (z.B. 8000105 für Frankfurt Hbf)
     - `date` - Datum im Format YYMMDD (z.B. 230401 für 01.04.2023)
     - `hour` - Stunde im Format HH (z.B. 14 für 14 Uhr)

4. **findStations**: Sucht nach Stationen anhand eines Suchmusters
   - Parameter: `pattern` - Suchmuster (z.B. "Frankfurt" oder "BLS")

### MCP-Ressourcen

Der Server stellt folgende Ressourcen bereit:

1. **Aktuelle Fahrplandaten**: `db-api:timetable/current/{evaNo}`
2. **Aktuelle Fahrplanänderungen**: `db-api:timetable/changes/{evaNo}`
3. **Geplante Fahrplandaten**: `db-api:timetable/planned/{evaNo}/{date}/{hour}`
4. **Stationssuche**: `db-api:station/{pattern}`

## Entwicklung

### Projekt-Struktur

```
db-mcp/
├── src/
│   ├── api/             # API-Client und Typen
│   ├── tools/           # MCP-Tools
│   ├── resources/       # MCP-Ressourcen
│   ├── utils/           # Hilfsfunktionen
│   ├── config.ts        # Konfiguration
│   └── index.ts         # Haupteinstiegspunkt
├── dist/                # Kompilierte Dateien
├── .env                 # Umgebungsvariablen
├── package.json
├── tsconfig.json
└── README.md
```

### NPM-Skripte

- `npm run build`: Kompiliert den TypeScript-Code
- `npm start`: Startet den Server
- `npm run dev`: Startet den Server im Entwicklungsmodus mit automatischem Neuladen
- `npm test`: Führt Tests aus

## Erweiterbarkeit

Potenzielle Erweiterungen
1. Datenverarbeitung und -anreicherung
   - Semantische Fahrplandatenverarbeitung: XML zu strukturiertem JSON mit semantischer Anreicherung
   - Historische Datenanalyse für Verspätungen und Betriebsstörungen
   - Integration multimodaler Verkehrsverbindungen
2. Erweiterte MCP-Tools
   - Routenplanung zwischen Stationen
   - KI-basierte Verspätungs- und Auslastungsprognosen
   - Reisestörungsanalyse
   - Barrierefreiheitscheck für Stationen und Verbindungen

## Lizenz

MCP Server: [MIT Lizenz](LICENSE)

DB Timetable API: [Creative Commons Namensnennung 4.0 International Lizenz](https://developers.deutschebahn.com/db-api-marketplace/apis/product/timetables)
