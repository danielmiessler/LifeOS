import { logger } from "../utils/logger.js";

export class AppError extends Error {
	constructor(
		public message: string,
		public code = "INTERNAL_ERROR",
		public statusCode = 500,
		public details?: Record<string, unknown>,
	) {
		super(message);
		this.name = this.constructor.name;
		Error.captureStackTrace(this, this.constructor);
	}
}

export class ApiError extends AppError {
	constructor(
		message: string,
		code = "API_ERROR",
		statusCode = 500,
		details?: Record<string, unknown>,
	) {
		super(message, code, statusCode, details);
	}
}

export class ValidationError extends AppError {
	constructor(message: string, details?: Record<string, unknown>) {
		super(message, "VALIDATION_ERROR", 400, details);
	}
}

export class AuthenticationError extends AppError {
	constructor(message: string) {
		super(message, "AUTHENTICATION_ERROR", 401);
	}
}
export class ResourceNotFoundError extends AppError {
	constructor(message: string) {
		super(message, "RESOURCE_NOT_FOUND", 404);
	}
}

export function asyncErrorHandler<T>(
	fn: (...args: unknown[]) => Promise<T>,
): (...args: unknown[]) => Promise<T> {
	return async (...args: unknown[]): Promise<T> => {
		try {
			return await fn(...args);
		} catch (error) {
			if (error instanceof AppError) {
				logger.error(`${error.name}: ${error.message}`, {
					code: error.code,
					statusCode: error.statusCode,
					details: error.details,
				});
				throw error;
			}
			const appError = new AppError(
				error instanceof Error ? error.message : "Unbekannter Fehler",
				"INTERNAL_ERROR",
				500,
				{ originalError: error },
			);
			logger.error(`${appError.name}: ${appError.message}`, {
				code: appError.code,
				statusCode: appError.statusCode,
				details: appError.details,
			});
			throw appError;
		}
	};
}

export function withErrorHandling<T, R>(
	fn: (input: T) => Promise<R> | R,
	errorTransformer?: (error: unknown) => string,
): (input: T) => Promise<R> {
	return async (input: T): Promise<R> => {
		try {
			return await fn(input);
		} catch (error) {
			const errorMessage = errorTransformer
				? errorTransformer(error)
				: error instanceof Error
					? error.message
					: "Ein unbekannter Fehler ist aufgetreten";

			logger.error("Fehler bei der Ausführung:", { error, input });

			throw new Error(errorMessage);
		}
	};
}
