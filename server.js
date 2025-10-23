import app from "./app.js";
import dotenv from "dotenv";
import { prisma } from "./lib/prismaClient.js";

dotenv.config();
const PORT = process.env.PORT || 4000;

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
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
