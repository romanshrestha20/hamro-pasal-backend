import app from "./app.js";
import "./config/env.ts";
import { prisma } from "./lib/prismaClient.js";

import { env } from "./config/validateEnv.js";

const PORT = env.PORT || 5000;

// check database connection

(async () => {
  try {
    await prisma.$connect();
    console.log("Database connected");
  } catch (err) {
    console.error("Database connection error:", err);
    process.exit(1);
  }
})();
// start server
const server = app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});

process.on("unhandledRejection", (err) => {
  console.error("UNHANDLED REJECTION:", err);
  server.close(() => process.exit(1));
});

process.on("SIGTERM", () => {
  console.log("SIGTERM RECEIVED. Shutting down...");
  server.close(() => process.exit(0));
});
