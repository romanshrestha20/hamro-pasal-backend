import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";

// Import routes
import userRoutes from "./routes/userRoutes.js";
import authRoutes from "./routes/authRoutes.js";

import { errorHandler } from "./middlewares/errorMiddleware.js";
const app = express();

app.use(
  cors({
    origin: "http://localhost:3000", // allow frontend
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true,
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());


// Example route
app.get("/", (req, res) => {
  res.send("API is running...");
});
app.get("/api/test", (_req, res) => res.json({ message: "CORS works!" }));

// Use routes
app.use("/api/users", userRoutes);
app.use("/api/auth", authRoutes);

// Handle 404 errors for undefined routes
app.use((req, res, next) => {
  res.status(404).json({ success: false, message: "Route not found" });
});

// Global error handling middleware
app.use(errorHandler);

export default app;
