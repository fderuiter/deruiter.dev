import { z } from "zod";
import {
  UniversalCrfProtocolSchema,
  getUniversalCrfSchemaUrl,
} from "@/lib/crf/universal-schema";

// Every Universal CRF export points its `$schema` here (#1202). Generating
// the document from the Zod schema keeps the published contract identical to
// the one `validateUniversalCrf` enforces.
export const dynamic = "force-static";

export async function GET() {
  const schema = {
    ...z.toJSONSchema(UniversalCrfProtocolSchema, {
      io: "input",
      unrepresentable: "any",
    }),
    $id: getUniversalCrfSchemaUrl(),
    title: "Universal CRF Study Protocol",
  };

  return new Response(JSON.stringify(schema, null, 2), {
    headers: {
      "content-type": "application/schema+json; charset=utf-8",
      "cache-control": "public, max-age=3600",
    },
  });
}
