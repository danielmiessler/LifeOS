import { beforeEach, describe, expect, test, vi } from "vitest";
import {
	ApiError,
	AppError,
	AuthenticationError,
	asyncErrorHandler,
	ResourceNotFoundError,
	ValidationError,
	withErrorHandling,
} from "../../utils/errorHandling.js";
import { logger } from "../../utils/logger.js";

vi.mock("../../utils/logger.js", () => ({
	logger: {
		error: vi.fn(),
		warn: vi.fn(),
		info: vi.fn(),
		debug: vi.fn(),
	},
}));

describe("Error Handling Utilities", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe("Error Klassen", () => {
		test("AppError hat korrekte Eigenschaften", () => {
			const error = new AppError("Test Fehler", "TEST_CODE", 400, {
				test: "details",
			});

			expect(error.message).toBe("Test Fehler");
			expect(error.code).toBe("TEST_CODE");
			expect(error.statusCode).toBe(400);
			expect(error.details).toEqual({ test: "details" });
			expect(error.name).toBe("AppError");
		});

		test("ApiError erbt von AppError mit korrekten Standardwerten", () => {
			const error = new ApiError("API Fehler");

			expect(error.message).toBe("API Fehler");
			expect(error.code).toBe("API_ERROR");
			expect(error.statusCode).toBe(500);
			expect(error instanceof AppError).toBe(true);
		});

		test("ValidationError hat korrekte Eigenschaften", () => {
			const error = new ValidationError("Validierungsfehler", {
				field: "test",
			});

			expect(error.message).toBe("Validierungsfehler");
			expect(error.code).toBe("VALIDATION_ERROR");
			expect(error.statusCode).toBe(400);
			expect(error.details).toEqual({ field: "test" });
			expect(error instanceof AppError).toBe(true);
		});

		test("AuthenticationError hat korrekte Eigenschaften", () => {
			const error = new AuthenticationError("Auth Fehler");

			expect(error.message).toBe("Auth Fehler");
			expect(error.code).toBe("AUTHENTICATION_ERROR");
			expect(error.statusCode).toBe(401);
			expect(error instanceof AppError).toBe(true);
		});

		test("ResourceNotFoundError hat korrekte Eigenschaften", () => {
			const error = new ResourceNotFoundError("Resource nicht gefunden");

			expect(error.message).toBe("Resource nicht gefunden");
			expect(error.code).toBe("RESOURCE_NOT_FOUND");
			expect(error.statusCode).toBe(404);
			expect(error instanceof AppError).toBe(true);
		});
	});

	describe("asyncErrorHandler", () => {
		test("gibt das Ergebnis zurück, wenn keine Fehler auftreten", async () => {
			const successFn = async () => "Erfolg";
			const handledFn = asyncErrorHandler(successFn);

			const result = await handledFn();
			expect(result).toBe("Erfolg");
			expect(logger.error).not.toHaveBeenCalled();
		});

		test("loggt und wirft AppError weiter", async () => {
			const errorFn = async () => {
				throw new ValidationError("Test Validierungsfehler");
			};
			const handledFn = asyncErrorHandler(errorFn);

			await expect(handledFn()).rejects.toThrow(ValidationError);
			expect(logger.error).toHaveBeenCalled();
		});

		test("wandelt Standard-Fehler in AppError um", async () => {
			const errorFn = async () => {
				throw new Error("Standard Fehler");
			};
			const handledFn = asyncErrorHandler(errorFn);

			await expect(handledFn()).rejects.toThrow(AppError);
			expect(logger.error).toHaveBeenCalled();
		});
	});

	describe("withErrorHandling", () => {
		test("gibt das Ergebnis zurück, wenn keine Fehler auftreten", async () => {
			const successFn = () => "Erfolg";
			const handledFn = withErrorHandling(successFn);

			const result = await handledFn({});
			expect(result).toBe("Erfolg");
			expect(logger.error).not.toHaveBeenCalled();
		});

		test("verarbeitet Fehler und wirft neue Error-Instanz", async () => {
			const errorFn = () => {
				throw new Error("Originalfehler");
			};
			const handledFn = withErrorHandling(errorFn);

			await expect(handledFn({})).rejects.toThrow("Originalfehler");
			expect(logger.error).toHaveBeenCalled();
		});

		test("verwendet errorTransformer, wenn angegeben", async () => {
			const errorFn = () => {
				throw new Error("Originalfehler");
			};
			const errorTransformer = () => "Transformierter Fehler";
			const handledFn = withErrorHandling(errorFn, errorTransformer);

			await expect(handledFn({})).rejects.toThrow("Transformierter Fehler");
			expect(logger.error).toHaveBeenCalled();
		});
	});
});
