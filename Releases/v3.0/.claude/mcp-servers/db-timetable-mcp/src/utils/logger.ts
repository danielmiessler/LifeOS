import { config } from "../config.js";

export enum LogLevel {
	DEBUG = "debug",
	INFO = "info",
	WARN = "warn",
	ERROR = "error",
}

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
	[LogLevel.DEBUG]: 0,
	[LogLevel.INFO]: 1,
	[LogLevel.WARN]: 2,
	[LogLevel.ERROR]: 3,
};

export type LogMetadata = Record<string, unknown>;

class Logger {
	private level: LogLevel;

	constructor() {
		this.level = (config.logging.level as LogLevel) || LogLevel.INFO;
	}

	private shouldLog(level: LogLevel): boolean {
		return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[this.level];
	}

	private formatMessage(
		level: LogLevel,
		message: string,
		meta?: LogMetadata,
	): string {
		const timestamp = new Date().toISOString();
		const metaStr = meta ? ` ${JSON.stringify(meta)}` : "";
		return `[${timestamp}] [${level.toUpperCase()}] ${message}${metaStr}`;
	}

	private log(level: LogLevel, message: string, meta?: LogMetadata): void {
		if (!this.shouldLog(level)) return;

		const formattedMessage = this.formatMessage(level, message, meta);

		switch (level) {
			case LogLevel.ERROR:
				console.error(formattedMessage);
				break;
			case LogLevel.WARN:
				console.warn(formattedMessage);
				break;
			case LogLevel.INFO:
				console.info(formattedMessage);
				break;
			case LogLevel.DEBUG:
				console.debug(formattedMessage);
				break;
			default:
				console.log(formattedMessage);
		}
	}

	debug(message: string, meta?: LogMetadata): void {
		this.log(LogLevel.DEBUG, message, meta);
	}

	info(message: string, meta?: LogMetadata): void {
		this.log(LogLevel.INFO, message, meta);
	}

	warn(message: string, meta?: LogMetadata): void {
		this.log(LogLevel.WARN, message, meta);
	}

	error(message: string, meta?: LogMetadata): void {
		this.log(LogLevel.ERROR, message, meta);
	}

	setLevel(level: LogLevel): void {
		this.level = level;
	}
}

export const logger = new Logger();
