// @vitest-environment node
import { describe, it, expect } from "vitest";
import path from "path";
import fs from "fs";
import {
  generateOpenApi,
  getExpectedApiRoutes,
} from "@/scripts/generate-openapi";

describe("OpenAPI Specification & Route Parity Test Suite", () => {
  const workspaceRoot = path.resolve(__dirname, "..");

  it("discovers all app/api routes dynamically", () => {
    const routes = getExpectedApiRoutes(workspaceRoot);
    expect(routes).toContain("/api/telemetry");
    expect(routes).toContain("/api/telemetry/sync");
    expect(routes).toContain("/api/cron/maintenance");
    expect(routes).toContain("/api/case-studies");
  });

  it("guarantees 100% route coverage and zero security drift in OpenAPI specification", () => {
    const { missingRoutes, securityMismatches, hasDrift } =
      generateOpenApi(workspaceRoot);
    expect(missingRoutes).toEqual([]);
    expect(securityMismatches).toEqual([]);
    expect(hasDrift).toBe(false);
  });

  it("conforms to valid OpenAPI 3.0.0 structural requirements and security schemes", () => {
    const openApiFilePath = path.join(workspaceRoot, "openapi.json");
    expect(fs.existsSync(openApiFilePath)).toBe(true);

    const specContent = fs.readFileSync(openApiFilePath, "utf-8");
    const spec = JSON.parse(specContent);

    expect(spec.openapi).toBe("3.0.0");
    expect(spec.info).toBeDefined();
    expect(spec.info.title).toBe("Portfolio Service API");
    expect(spec.paths).toBeDefined();

    for (const [routePath, methods] of Object.entries(spec.paths)) {
      expect(routePath.startsWith("/api/")).toBe(true);
      const methodKeys = Object.keys(methods as Record<string, unknown>);
      expect(methodKeys.length).toBeGreaterThan(0);

      for (const method of methodKeys) {
        const operation = (
          methods as Record<string, { summary?: string; responses?: unknown }>
        )[method];
        expect(operation.summary).toBeDefined();
        expect(operation.responses).toBeDefined();
      }
    }

    expect(spec.components?.schemas).toBeDefined();
    expect(spec.components.schemas.CaseStudySummary).toBeDefined();
    expect(spec.components.schemas.TelemetryEvent).toBeDefined();

    // Verify securitySchemes
    expect(spec.components?.securitySchemes).toBeDefined();
    expect(spec.components.securitySchemes.ClerkAuth).toEqual({
      type: "http",
      scheme: "bearer",
      bearerFormat: "JWT",
      description: "Clerk session token or administrative JWT",
    });
    expect(spec.components.securitySchemes.CronSecretAuth).toEqual({
      type: "http",
      scheme: "bearer",
      bearerFormat: "Secret",
      description: "Cron secret bearer authorization header",
    });

    // Verify protected endpoints security requirements
    expect(spec.paths["/api/admin/blog"].get.security).toEqual([
      { ClerkAuth: [] },
    ]);
    expect(spec.paths["/api/admin/blog"].post.security).toEqual([
      { ClerkAuth: [] },
    ]);
    expect(spec.paths["/api/admin/blog/{id}"].get.security).toEqual([
      { ClerkAuth: [] },
    ]);
    expect(spec.paths["/api/admin/blog/{id}"].patch.security).toEqual([
      { ClerkAuth: [] },
    ]);
    expect(spec.paths["/api/admin/blog/{id}"].delete.security).toEqual([
      { ClerkAuth: [] },
    ]);
    expect(
      spec.paths["/api/admin/projects/{slug}/image"].post.security
    ).toEqual([{ ClerkAuth: [] }]);
    expect(
      spec.paths["/api/admin/projects/{slug}/image"].delete.security
    ).toEqual([{ ClerkAuth: [] }]);
    expect(spec.paths["/api/cron/maintenance"].get.security).toEqual([
      { CronSecretAuth: [] },
    ]);
    expect(spec.paths["/api/telemetry/sync"].get.security).toEqual([
      { CronSecretAuth: [] },
    ]);
    expect(spec.paths["/api/case-studies"].post.security).toEqual([
      { ClerkAuth: [] },
    ]);

    // Verify public endpoints do not require security
    expect(spec.paths["/api/case-studies"].get.security).toBeUndefined();
    expect(spec.paths["/api/telemetry"].get.security).toBeUndefined();
  });
});
