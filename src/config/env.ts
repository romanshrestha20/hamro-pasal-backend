import dotenv from "dotenv";

/**
 * Only load .env file in local development.
 * In production, env vars MUST come from the host.
 */
if (process.env.NODE_ENV !== "production") {
  dotenv.config();
}
