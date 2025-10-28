import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import path from "path";

// Import routes
import userRoutes from "./routes/userRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import productRoutes from "./routes/productRoutes.js";
import favoriteRoutes from "./routes/favoriteRoutes.js";
import orderRoutes from "./routes/orderRoutes.js";

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
app.set("trust proxy", 1); // trust first proxy if behind a proxy (e.g., Heroku)
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Serve uploaded files statically (e.g., http://localhost:4000/uploads/<filename>)
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

// Example route
app.get("/", (req, res) => {
  res.send("API is running...");
});
app.get("/api/test", (_req, res) => res.json({ message: "CORS works!" }));

// Use routes
app.use("/api/users", userRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);
app.use("/api/favorites", favoriteRoutes);
app.use("/api/orders", orderRoutes);

// Handle 404 errors for undefined routes
app.use((req, res, next) => {
  res.status(404).json({ success: false, message: "Route not found" });
});

// Global error handling middleware
app.use(errorHandler);

export default app;
