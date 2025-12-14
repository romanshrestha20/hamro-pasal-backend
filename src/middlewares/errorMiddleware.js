// middlewares/errorMiddleware.js
import logger from "../lib/logger.js";

const errorHandler = (err, req, res, next) => {
  logger.error(
    {
      err,
      requestId: req.id,
      userId: req.user?.id,
      path: req.originalUrl,
    },
    err.message
  );
  
  let statusCode = err.statusCode || 500;
  let message = err.message || "Internal Server Error";

  // Handle Zod errors safely
  if (err.name === "ZodError") {
    statusCode = 400;

    // Safe handling - check if errors array exists
    if (err.errors && Array.isArray(err.errors)) {
      message = err.errors
        .map((e) => {
          const path = e.path?.join(".") || "field";
          return `${path}: ${e.message}`;
        })
        .join(", ");
    } else {
      message = "Validation error";
    }
  }

  // Handle other error types
  if (err.code === "P2002") {
    statusCode = 400;
    message = "Duplicate entry";
  }

  if (err.code === "P2025") {
    statusCode = 404;
    message = "Record not found";
  }

  if (err.name === "JsonWebTokenError") {
    statusCode = 401;
    message = "Invalid token";
  }

  if (err.name === "TokenExpiredError") {
    statusCode = 401;
    message = "Token expired";
  }

  res.status(statusCode).json({
    success: false,
    error: message,
    ...(process.env.NODE_ENV === "development" && {
      stack: err.stack,
    }),
  });
};

export default errorHandler;