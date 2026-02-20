import { FastMCP } from "fastmcp";
import { config } from "./config.js";
import { resources } from "./resources/index.js";
import { tools } from "./tools/index.js";
import { logger } from "./utils/logger.js";

const server = new FastMCP({
	name: config.server.name,
	version: config.server.version as `${number}.${number}.${number}`,
});

for (const tool of tools) {
	logger.info(`Tool hinzugefügt: ${tool.name}`);
	// @ts-expect-error
	server.addTool(tool);
}

for (const resource of resources) {
	logger.info(`Ressource hinzugefügt: ${resource.name}`);
	// @ts-expect-error
	server.addResourceTemplate(resource);
}

logger.info(`Starte ${config.server.name} v${config.server.version}`);

// Keep process alive - ensure event loop stays active
// This prevents the process from exiting if FastMCP doesn't properly keep the event loop alive
let keepAliveInterval: NodeJS.Timeout | null = null;

if (
	config.server.transportType === "httpStream" ||
	config.server.transportType === "sse"
) {
	// Support both 'sse' (legacy) and 'httpStream' (new FastMCP API)
	const transportType =
		config.server.transportType === "sse"
			? "httpStream"
			: config.server.transportType;
	logger.info(
		`Server startet im HTTP-Stream-Modus auf Port ${config.server.port}`,
	);

	const endpoint = config.server.endpoint.startsWith("/")
		? config.server.endpoint
		: `/${config.server.endpoint}`;

	// Set up keep-alive BEFORE starting server to ensure it's active immediately
	keepAliveInterval = setInterval(() => {
		// Just keep the process alive - no action needed
		logger.debug("Keep-alive tick");
	}, 30000); // Every 30 seconds

	server
		.start({
			transportType: transportType as "httpStream",
			httpStream: {
				endpoint: endpoint as `/${string}`,
				port: config.server.port,
				host: config.server.host,
			},
		})
		.catch((error) => {
			logger.error("Fehler beim Starten des HTTP-Stream-Servers", { error });
			if (keepAliveInterval) clearInterval(keepAliveInterval);
			process.exit(1);
		});
} else {
	logger.info("Server startet im stdio-Modus");
	server
		.start({
			transportType: "stdio",
		})
		.catch((error) => {
			logger.error("Fehler beim Starten des stdio-Servers", { error });
			process.exit(1);
		});
}

// Cleanup keep-alive on shutdown
if (keepAliveInterval) {
	process.on("SIGTERM", () => {
		if (keepAliveInterval) clearInterval(keepAliveInterval);
	});
	process.on("SIGINT", () => {
		if (keepAliveInterval) clearInterval(keepAliveInterval);
	});
}

server.on("connect", (event) => {
	// @ts-expect-error - FastMCP Session-Typ hat möglicherweise keine id-Eigenschaft
	const sessionId = event.session?.id || "unbekannt";
	logger.info("Client verbunden", { sessionId });
});

server.on("disconnect", (event) => {
	// @ts-expect-error - FastMCP Session-Typ hat möglicherweise keine id-Eigenschaft
	const sessionId = event.session?.id || "unbekannt";
	logger.info("Client getrennt", { sessionId });
});

process.on("SIGINT", () => {
	logger.info("Server wird beendet (SIGINT)");
	process.exit(0);
});

process.on("SIGTERM", () => {
	logger.info("Server wird beendet (SIGTERM)");
	process.exit(0);
});

process.on("uncaughtException", (error) => {
	logger.error("Unbehandelte Ausnahme", { error });
	process.exit(1);
});

process.on("unhandledRejection", (reason) => {
	logger.error("Unbehandelte Promise-Ablehnung", { reason });
});

export default server;
