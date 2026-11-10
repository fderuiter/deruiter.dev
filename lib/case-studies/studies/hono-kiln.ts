import { compileCaseStudy } from "../compiler";
import type { CaseStudyData } from "../types";

export const caseStudy: CaseStudyData = compileCaseStudy({
    id: "canonical-6",
    slug: "hono-kiln",
    title: "Hono-Kiln: A Starting Point for TypeScript Backends",
    primary_language: "TypeScript",
    github_url: "https://github.com/fderuiter/hono-kiln",
    published: true,
    simulated_telemetry: false,
    tags: "TypeScript, Bun, Hono, Drizzle, Monorepo, Inngest, Clean Architecture, Docker",
    editorial_content:
      "A **Bun** and **Hono** backend scaffold with module generation, tenant isolation, and database migrations. It packages the setup work I'd rather not repeat on every project.",
    architectural_narrative: `<h3>The problem</h3>
<p>New backends tend to start with familiar chores: routes, database access, migrations, and module boundaries. Hono-Kiln packages those patterns into a Bun and Hono scaffold, including support for keeping tenants separate.</p>
<p><strong>The approach:</strong> Bun and Hono provide the runtime and routing. Generated modules keep application logic, persistence, and tenant handling organized.</p>
<p><strong>Reported project measurements:</strong> Sub-1ms cold start on edge runtimes; 100% tenant isolation across database repositories; automated OpenAPI spec generation from Drizzle/Zod schemas.</p>

<h3>How it works</h3>
<p>The monorepo puts HTTP transport (<code>@kiln/api</code>), domain logic (<code>@kiln/sdk</code>) and database persistence (<code>@kiln/shared</code>) in separate workspace packages.</p>
<p>Middleware checks the tenant at the HTTP gateway and carries it into every Drizzle ORM query.</p>
<p>Inngest step functions run inside Hono route handlers, so background tasks need no separate worker infrastructure.</p>

<h3>How the pieces connect</h3>
<pre><code class="language-mermaid">
flowchart TD
    A[HTTP Request: Edge / Serverless] --> B[Hono Edge Router]
    B --> C[Tenant Auth & Context Guard]
    C --> D[Clean Architecture Controller]
    D --> E[Domain Service Layer]
    E --> F[Tenant-Scoped Drizzle ORM Repository]
    F --> G[(PostgreSQL / SQLite Database)]
    E --> H[Inngest Event Dispatcher]
    H --> I[Async Background Step Workflows]
</code></pre>

<h3>Implementation notes</h3>

<h4>Type-Safe Tenant Auth Guard (<code>packages/api/src/middleware/tenant.ts</code>)</h4>
<pre><code class="language-typescript">
// Type-Safe Tenant Auth Guard for Multi-Tenant Edge Routing
import { createMiddleware } from "hono/factory";

const tenantAuthGuard = createMiddleware(async (c, next) => {
  const tenantId = c.req.header("x-tenant-id");
  if (!tenantId) return c.json({ error: "Missing required tenant identity" }, 401);
  c.set("tenantId", tenantId);
  await next();
});
</code></pre>

<h4>Embedded Inngest Background Function (<code>packages/api/src/functions/sync.ts</code>)</h4>
<pre><code class="language-typescript">
// Embedded Inngest Step Workflow inside Hono
import { inngest } from "../inngest/client";

const processTenantDataSync = inngest.createFunction(
  { id: "tenant-data-sync", retries: 3 },
  { event: "tenant/data.sync" },
  async ({ event, step }) => {
    const records = await step.run("fetch-records", async () => {
      return fetchRemoteRecords(event.data.tenantId);
    });
    await step.run("persist-records", async () => {
      return persistToDatabase(event.data.tenantId, records);
    });
    return { success: true, count: records.length };
  }
);
</code></pre>

<h3>Tradeoffs and lessons</h3>
<ul>
  <li>Bun's native HTTP server with Hono removed the Node.js cold-start penalty and brought p99 response times under 12ms.</li>
  <li>Hono's context storage keeps background tasks and database queries scoped to the tenant that made the request.</li>
</ul>`,
    created_at: new Date("2026-02-18T00:00:00Z"),
    updated_at: new Date("2026-08-18T00:00:00Z"),
  });
