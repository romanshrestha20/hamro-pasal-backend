// middleware/errorMiddleware.js

export const errorHandler = (err, req, res, next) => {
  console.error("🔥 Error:", err);

  // Default response structure
  let statusCode = 500;
  let message = "Internal Server Error";

  // --- Prisma known errors ---
  if (err.code) {
    switch (err.code) {
      case "P2002": // Unique constraint failed
        statusCode = 409;
        message = "Duplicate entry detected.";
        break;
      case "P2025": // Record not found
        statusCode = 404;
        message = "Record not found.";
        break;
      default:
        message = `Database error (${err.code})`;
        break;
    }
  }

  // --- Zod validation errors ---
  if (err.name === "ZodError") {
    statusCode = 400;
    message = "Validation failed.";
    return res.status(statusCode).json({
      message,
      errors: err.errors.map((e) => ({
        field: e.path.join("."),
        message: e.message,
      })),
    });
  }

  // --- JWT / Auth errors ---
  if (err.name === "JsonWebTokenError") {
    statusCode = 401;
    message = "Invalid or expired token.";
  }

  // --- Custom app errors ---
  if (err.statusCode) {
    statusCode = err.statusCode;
    message = err.message || message;
  }

  res.status(statusCode).json({
    success: false,
    message,
  });
};
