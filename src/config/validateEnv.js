import { z } from "zod";

export const env = z
  .object({
    NODE_ENV: z.enum(["development", "production", "test"]),
    PORT: z.coerce.number().default(5000),
    DATABASE_URL: z.string().url(),
    JWT_SECRET: z.string().min(10),
  })
  .parse(process.env);
