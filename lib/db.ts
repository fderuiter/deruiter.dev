import { neonConfig } from "@neondatabase/serverless";
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "@/app/generated/prisma/client";
import ws from "ws";
import { getEnv } from "./env";
import { logger } from "./logger";

export {
  SuppressionReason,
  OutboundEmailStatus,
} from "@/app/generated/prisma/enums";

// Configure Neon to use native 'ws' package inside Node.js environments (like Next.js build server)
neonConfig.webSocketConstructor = ws;

// Parse connection string via validated schema
const env = getEnv();
const connectionString = env.DATABASE_URL;

let isHealthy = false;
let healthCheckPromise: Promise<void> | null = null;

const verifyDatabaseHealthAsync = (baseClient: PrismaClient) => {
  const currentEnv = getEnv();
  if (
    isHealthy ||
    healthCheckPromise ||
    currentEnv.NEXT_PHASE === "phase-production-build" ||
    currentEnv.SKIP_DB_HEALTH_CHECK === "true"
  ) {
    return;
  }

  healthCheckPromise = baseClient
    .$queryRawUnsafe(`SELECT 1 FROM "TelemetryEvent" LIMIT 1`)
    .then(() => {
      isHealthy = true;
    })
    .catch((error) => {
      if (currentEnv.VERCEL_ENV === "production") {
        // A non-blocking notice: kept out of Sentry so a lagging schema
        // cannot spend the error quota on every cold start.
        logger.warn("Database health check non-blocking notice:", error, {
          skipTelemetry: true,
        });
      } else {
        logger.error(
          "Database health check failed: Schema version is behind. Missing TelemetryEvent.",
          error
        );
      }
    })
    .finally(() => {
      healthCheckPromise = null;
    });
};

const createPrismaClient = () => {
  const adapter = new PrismaNeon({ connectionString });
  const currentEnv = getEnv();
  const baseClient = new PrismaClient({
    adapter,
    log:
      currentEnv.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  });

  return baseClient.$extends({
    query: {
      async $allOperations({ args, query, ...rest }) {
        const activeEnv = getEnv();
        if (activeEnv.PLAYWRIGHT_TEST === "true") {
          const operation = (rest as Record<string, unknown>).operation;
          if (operation === "findUnique" || operation === "findFirst") {
            return null;
          }
          if (operation === "findMany" || operation === "groupBy") {
            return [];
          }
          if (operation === "count") {
            return 0;
          }
          return null;
        }
        const conn = activeEnv.DATABASE_URL;
        if (!conn || conn.includes("dummy")) {
          throw new Error("Database offline: Dummy connection URL configured.");
        }
        if (!isHealthy && activeEnv.SKIP_DB_HEALTH_CHECK !== "true") {
          verifyDatabaseHealthAsync(baseClient as unknown as PrismaClient);
        }
        return query(args);
      },
    },
  });
};

type ExtendedPrismaClient = ReturnType<typeof createPrismaClient>;

const globalForPrisma = globalThis as unknown as {
  prisma: ExtendedPrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (getEnv().NODE_ENV !== "production") globalForPrisma.prisma = prisma;
