import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";

import pinoHttp from "pino-http";
import logger from "./lib/logger.js";
import { v4 as uuidv4 } from "uuid";
import helmet from "helmet";
import rateLimit from "express-rate-limit";

// Import routes
import userRoutes from "./routes/userRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import productRoutes from "./routes/productRoutes.js";
import favoriteRoutes from "./routes/favoriteRoutes.js";
import orderRoutes from "./routes/orderRoutes.js";
import cartRoutes from "./routes/cartRoutes.js";
import reviewRoutes from "./routes/reviewRoutes.js";

import errorHandler from "./middlewares/errorMiddleware.js";
const app = express();

// CORS: Allow multiple dev and deployment origins
const allowedOrigins = [
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "https://hamro-pasal-frontend-1dqm.vercel.app/",
  process.env.FRONTEND_ORIGIN,
  process.env.FRONTEND_ORIGIN_1,
  process.env.FRONTEND_ORIGIN_2,
].filter(Boolean);

// trust first proxy
app.set("trust proxy", 1);

// Logging middleware with request ID
app.use(
  pinoHttp({
    logger,
    genReqId: (req) => req.headers["x-request-id"] || uuidv4(),
  })
);

// Security middlewares
app.use(helmet());

app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => req.path === "/health" || req.path === "/",
  })
);

// CORS middleware configuration for dynamic origins
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow server-to-server, Postman, mobile apps
      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      // Return false instead of error for better error handling
      callback(null, false);
    },
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    credentials: true,
  })
);

// Body parsers for JSON and URL-encoded data with size limits
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(cookieParser());

// Example route
app.get("/", (req, res) => {
  res.send("API is running...");
});

app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok" });
});



// Use routes
app.use("/api/users", userRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);
app.use("/api/favorites", favoriteRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/cart", cartRoutes);
app.use("/api/reviews", reviewRoutes);



// Handle 404 errors for undefined routes
app.use((req, res, next) => {
  res.status(404).json({ success: false, message: "Route not found" });
});

// Global error handling middleware
app.use(errorHandler);

export default app;
