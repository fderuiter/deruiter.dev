# How-To: Add an API Route with a Zod Contract

Goal: add a new `app/api/**/route.ts` endpoint that is validated at
runtime with Zod and shows up in `openapi.json` automatically, with zero
drift reported by `npm run check-docs-drift`.

## 1. Define the request contract in `lib/schemas.ts`

Every route that accepts a body or query parameters declares a Zod schema
in [`lib/schemas.ts`](../../lib/schemas.ts). Reuse existing primitive
schemas where they fit rather than redefining validation rules ad hoc:

```ts
export const ExampleSubmissionSchema = z.object({
  message: z.string().min(1).max(2000),
  email: z.string().email().optional(),
});
```

## 2. Write the route handler behind `createApiHandler`

Wrap the handler with [`createApiHandler`](../../lib/route-wrapper.ts)
rather than exporting a bare `POST`/`GET` function. It gives you automatic
Zod validation, uniform error shaping, Sentry exception capture, error
sanitization, and security header enforcement for free:

```ts
// app/api/example/route.ts
import { NextRequest, NextResponse } from "next/server";
import { ExampleSubmissionSchema } from "@/lib/schemas";
import { createApiHandler } from "@/lib/route-wrapper";

export const dynamic = "force-dynamic";

export const POST = createApiHandler(
  async (req: NextRequest, { data }) => {
    // `data` is already validated and typed as z.infer<typeof ExampleSubmissionSchema>
    return NextResponse.json({ success: true }, { status: 201 });
  },
  { schema: ExampleSubmissionSchema, type: "body" }
);
```

Set `type: "query"` instead of `"body"` for a `GET` route that validates
search params rather than a JSON body. See
[`app/api/contact/route.ts`](../../app/api/contact/route.ts) for a fuller
example, including a custom validation-error formatter and rate limiting.

## 3. Regenerate the OpenAPI contract

`scripts/generate-openapi.ts` walks every `app/api/**/route.ts` handler and
asserts 100% coverage against `openapi.json`, a new, undocumented route
handler fails the drift gate. Regenerate it:

```bash
npm run compile-docs
```

(or `npm run doctor:fix`, which also resolves other fixable architectural
invariants in the same pass).

## 4. Verify zero drift and stage the result

```bash
npm run check-docs-drift
```

If this reports drift, stage the regenerated `openapi.json` (and any
TypeDoc markdown under `docs/reference/api/` if you also touched a public
`lib/`, `hooks/`, or `types/` export) alongside your code change:

```bash
git add openapi.json docs/reference/api
```

## 5. Add a test

Route handlers in this repository are covered by Vitest tests that call
the exported handler directly (no HTTP server needed) with a constructed
`NextRequest`. Follow an existing `__tests__/api-*.test.ts` file for the
request-construction pattern, and assert on both the success path and at
least one Zod validation failure.

## Common mistakes this prevents

- **Forgetting the schema entirely**: without `options.schema`,
  `createApiHandler` skips validation, any route accepting user input
  should have one.
- **Hand-rolling error responses**: `createApiHandler` already sanitizes
  errors and reports them to Sentry; a bare `try/catch` that swallows or
  reformats errors duplicates that work and can leak internals in the
  process.
- **Shipping a route the OpenAPI gate doesn't know about**: `npm run
  check-docs-drift` (and CI's `rigor-pipeline`) fails fast specifically to
  catch this before review.
