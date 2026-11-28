import fs from "fs";
import { defineConfig } from "prisma/config";

const isReplayMode =
  Boolean(process.env["MIGRATION_REPLAY_URL"]) ||
  Boolean(process.env["DISPOSABLE_DATABASE_URL"]) ||
  process.env["PRISMA_REPLAY_MODE"] === "true";

if (!isReplayMode) {
  if (fs.existsSync(".env.local")) {
    process.loadEnvFile(".env.local");
  } else if (fs.existsSync(".env")) {
    process.loadEnvFile(".env");
  }
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "npx tsx prisma/seed.ts",
  },
  datasource: {
    // Migrations need a direct connection. Prisma takes an advisory lock for the
    // duration of `migrate deploy`, and PgBouncer in transaction mode -- which is
    // what Neon's pooled endpoint runs -- does not hold session state across
    // statements, so the lock can be lost or the DDL can deadlock.
    //
    // DATABASE_URL is the pooled endpoint. It sits last as a deliberate fallback
    // for environments that genuinely have nothing else, not as a normal path.
    // DATABASE_URL_UNPOOLED is provisioned automatically by the Neon integration
    // in both Vercel and .env.local, so preferring it makes the correct endpoint
    // the default rather than something an operator has to remember to pass.
    url:
      process.env["MIGRATION_REPLAY_URL"] ||
      process.env["DISPOSABLE_DATABASE_URL"] ||
      process.env["DIRECT_URL"] ||
      process.env["DATABASE_URL_UNPOOLED"] ||
      process.env["DATABASE_URL"],
  },
});
