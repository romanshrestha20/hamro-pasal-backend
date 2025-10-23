import { errorHandler } from "../errorMiddleware.js";
import { AppError } from "../../utils/AppError.js";

describe("Error Middleware", () => {
  let req, res, next;
  let consoleErrorSpy;

  beforeEach(() => {
    req = {};
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    next = jest.fn();
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    jest.clearAllMocks();
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  describe("errorHandler", () => {
    it("should handle AppError with custom status code and message", () => {
      const error = new AppError("Custom error message", 404);

      errorHandler(error, req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: "Custom error message",
      });
    });

    it("should handle generic errors with 500 status code", () => {
      const error = new Error("Something went wrong");

      errorHandler(error, req, res, next);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: "Something went wrong",
      });
    });

    it("should handle ZodError with formatted messages", () => {
      const error = {
        name: "ZodError",
        message: "Validation failed",
        errors: [
          { path: ["email"], message: "Invalid email" },
          { path: ["password"], message: "Password too short" },
        ],
      };

      errorHandler(error, req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: "email: Invalid email, password: Password too short",
      });
    });

    it("should handle ZodError with missing path", () => {
      const error = {
        name: "ZodError",
        message: "Validation failed",
        errors: [{ message: "Invalid input" }],
      };

      errorHandler(error, req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: "field: Invalid input",
      });
    });

    it("should handle ZodError with no errors array", () => {
      const error = {
        name: "ZodError",
        message: "Validation failed",
      };

      errorHandler(error, req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: "Validation error",
      });
    });

    it("should handle Prisma P2002 error (duplicate entry)", () => {
      const error = {
        code: "P2002",
        message: "Unique constraint failed",
      };

      errorHandler(error, req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: "Duplicate entry",
      });
    });

    it("should handle Prisma P2025 error (record not found)", () => {
      const error = {
        code: "P2025",
        message: "Record to delete does not exist",
      };

      errorHandler(error, req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: "Record not found",
      });
    });

    it("should handle JsonWebTokenError", () => {
      const error = {
        name: "JsonWebTokenError",
        message: "jwt malformed",
      };

      errorHandler(error, req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: "Invalid token",
      });
    });

    it("should handle TokenExpiredError", () => {
      const error = {
        name: "TokenExpiredError",
        message: "jwt expired",
      };

      errorHandler(error, req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: "Token expired",
      });
    });

    it("should include stack trace in development mode", () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "development";

      const error = new Error("Test error");
      error.stack = "Error stack trace";

      errorHandler(error, req, res, next);

      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: "Test error",
        stack: "Error stack trace",
      });

      process.env.NODE_ENV = originalEnv;
    });

    it("should not include stack trace in production mode", () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "production";

      const error = new Error("Test error");
      error.stack = "Error stack trace";

      errorHandler(error, req, res, next);

      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: "Test error",
      });

      process.env.NODE_ENV = originalEnv;
    });

    it("should log error name and message to console", () => {
      const error = new Error("Test error");
      error.name = "TestError";

      errorHandler(error, req, res, next);

      expect(consoleErrorSpy).toHaveBeenCalledWith("Error name:", "TestError");
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Error message:",
        "Test error"
      );
    });
  });
});
