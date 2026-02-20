# Testing des DB Timetable MCP Servers

Dieses Dokument beschreibt verschiedene Methoden zum Testen und Debuggen des DB Timetable MCP Servers.

## Automatische Tests

Der Server enthält automatische Tests, die mit Vitest ausgeführt werden können:

```bash
npm test
```

Die Tests überprüfen:
- API-Client-Funktionalität
- Tool-Implementierung
- Server-Integration

## Manuelles Testen

### Mit FastMCP Inspector

Der FastMCP Inspector ist ein Befehlszeilenwerkzeug, mit dem MCP-Server interaktiv getestet werden können.

1. Installiere den FastMCP Inspector global:
   ```bash
   npm install -g fastmcp
   ```

2. Starte den Server im stdio-Modus:
   ```bash
   npm start
   ```

3. In einem anderen Terminal-Fenster führe den Inspector aus:
   ```bash
   fastmcp inspect
   ```

4. Verwende den Inspector, um mit den Tools und Ressourcen zu interagieren.

### Testen im stdio-Modus

Im stdio-Modus arbeitet der Server über die Standardein- und -ausgabe. Dies ist nützlich für die Entwicklung und das Debugging.

1. Starte den Server:
   ```bash
   npm start
   ```

2. Sende MCP-formatierte Nachrichten, z.B.:
   ```json
   {"type":"request","id":"test-1","method":"tool","params":{"tool":"getCurrentTimetable","input":{"evaNo":"8000105"}}}
   ```

### Testen im SSE-Modus

Im SSE-Modus (Server-Sent Events) erstellt der Server einen HTTP-Endpunkt, der für Webanwendungen zugänglich ist.

1. Starte den Server im SSE-Modus:
   ```bash
   TRANSPORT_TYPE=sse npm start
   ```

2. Verwende einen SSE-Client, um zu testen (z.B. mit einer Browserkonsole oder einem Tool wie curl).

## Test-Beispiele

### Aktuelle Fahrplandaten abrufen

```json
{
  "type": "request",
  "id": "test-1",
  "method": "tool",
  "params": {
    "tool": "getCurrentTimetable",
    "input": {
      "evaNo": "8000105"
    }
  }
}
```

### Stationssuche

```json
{
  "type": "request",
  "id": "test-2",
  "method": "tool",
  "params": {
    "tool": "findStations",
    "input": {
      "pattern": "Frankfurt"
    }
  }
}
```

### Geplante Fahrplandaten abrufen

```json
{
  "type": "request",
  "id": "test-3",
  "method": "tool",
  "params": {
    "tool": "getPlannedTimetable",
    "input": {
      "evaNo": "8000105",
      "date": "230401",
      "hour": "14"
    }
  }
}
```

### Ressource abrufen

```json
{
  "type": "request",
  "id": "test-4",
  "method": "resource",
  "params": {
    "uri": "db-api:timetable/current/8000105"
  }
}
```

## Debugging

### Logging

Der Server verwendet einen strukturierten Logger mit verschiedenen Log-Levels:

- DEBUG: Detaillierte Debugging-Informationen
- INFO: Allgemeine Informationen (Standard)
- WARN: Warnungen
- ERROR: Fehlermeldungen

Das Log-Level kann in der .env-Datei eingestellt werden:

```
LOG_LEVEL=debug
```

### Fehlerbehandlung testen

Um die Fehlerbehandlung zu testen, können Sie ungültige Parameter an die Tools übergeben:

```json
{
  "type": "request",
  "id": "test-error",
  "method": "tool",
  "params": {
    "tool": "getCurrentTimetable",
    "input": {
      "evaNo": ""
    }
  }
}
```

### Bekannte Fehlercodes

- `VALIDATION_ERROR`: Ungültige Eingabeparameter
- `API_ERROR`: Fehler bei der API-Anfrage
- `INTERNAL_ERROR`: Interner Serverfehler
- `AUTHENTICATION_ERROR`: Authentifizierungsfehler
- `RESOURCE_NOT_FOUND`: Ressource nicht gefunden

## Typische Teststationen

Hier sind einige gültige EVA-Nummern für Tests:

- 8000105: Frankfurt (Main) Hbf
- 8000096: Berlin Hbf
- 8000152: Hamburg Hbf
- 8000244: München Hbf
- 8000098: Köln Hbf

## Fehlerbehebung

### API-Zugangsdaten

Stellen Sie sicher, dass in der .env-Datei gültige API-Zugangsdaten für die DB Timetable API konfiguriert sind:

```
DB_TIMETABLE_CLIENT_ID=your-client-id
DB_TIMETABLE_CLIENT_SECRET=your-client-secret
```

### Netzwerkfehler

Bei Netzwerkfehlern überprüfen Sie:

1. Internetverbindung
2. API-Erreichbarkeit
3. Gültigkeit der API-Zugangsdaten

### Server startet nicht

1. Prüfen Sie, ob die erforderlichen Abhängigkeiten installiert sind: `npm install`
2. Prüfen Sie, ob der TypeScript-Code kompiliert wurde: `npm run build`
3. Überprüfen Sie die Log-Ausgabe auf Fehlermeldungen 