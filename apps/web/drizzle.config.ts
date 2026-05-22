import type { Config } from "drizzle-kit";

export default {
  schema: "../../packages/db/schema.ts",
  out: "../../packages/db/migrations",
  driver: "pg",
  dbCredentials: {
    connectionString: process.env.DATABASE_URL!,
  },
} satisfies Config;
