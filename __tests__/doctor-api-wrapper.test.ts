import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  checkApiRouteWrapper,
  findApiRouteWrapperViolations,
} from "@/lib/dx/doctor";

const WRAPPED = `import { createApiHandler } from "@/lib/route-wrapper";
export const dynamic = "force-dynamic";
export const GET = createApiHandler(
  async () => Response.json({ ok: "a, b) }" }),
  { auth: "public" }
);
export const POST = createApiHandler(
  async (req) => {
    // a comment with auth: "nope", and a ) paren
    return Response.json({ auth: "inside" });
  },
  { schema: Body, type: "body", auth: "clerk_admin" }
);
`;

describe("findApiRouteWrapperViolations", () => {
  it("accepts wrapped handlers with an auth strategy in their options", () => {
    expect(findApiRouteWrapperViolations(WRAPPED)).toEqual([]);
  });

  it.each([
    ["export async function GET() { return new Response(); }", "GET is a plain function"],
    ["export function DELETE() {}", "DELETE is a plain function"],
    ["const GET = createApiHandler(h, { auth: \"public\" });\nexport { GET };", "GET is re-exported"],
    ["export const PUT = withSomethingElse(handler);", "PUT is not created with createApiHandler"],
    ["export const PATCH = createApiHandler(async () => Response.json({ auth: \"public\" }));", "PATCH does not declare an auth strategy"],
    ["export const POST = createApiHandler(h, { schema: S });", "POST does not declare an auth strategy"],
    ["export const GET = createApiHandler(h, { auth: \"admin\" });", 'unknown auth strategy "admin"'],
  ])("reports %j", (source, problem) => {
    const problems = findApiRouteWrapperViolations(source);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain(problem);
  });
});

describe("checkApiRouteWrapper", () => {
  let root: string;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "doctor-api-wrapper-"));
  });

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  function writeRoute(relative: string, source: string) {
    const file = path.join(root, "app", "api", relative, "route.ts");
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, source);
  }

  it("passes on the repository's own routes", () => {
    expect(checkApiRouteWrapper(process.cwd()).status).toBe("pass");
  });

  it("fails on a seeded unwrapped handler and names the file", () => {
    writeRoute("ok", WRAPPED);
    writeRoute("bad", "export async function POST() { return new Response(); }");
    const result = checkApiRouteWrapper(root);
    expect(result.status).toBe("fail");
    expect(result.details).toEqual([
      expect.stringContaining(path.join("app", "api", "bad", "route.ts")),
    ]);
  });
});
