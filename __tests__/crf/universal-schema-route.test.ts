// @vitest-environment node
import { describe, it, expect } from "vitest";
import { GET } from "@/app/schemas/crf/v1/universal-crf.schema.json/route";
import {
  exportUniversalCrfJson,
  getUniversalCrfSchemaUrl,
} from "@/lib/crf/universal-schema";
import { ONCOLOGY_RECIST_PRESET } from "@/lib/crf/presets";

/**
 * Reproduction for #1202 item 5: the `$schema` URL every Universal CRF export
 * carries must resolve to a JSON Schema, not a 404.
 */
describe("[#1202] Universal CRF $schema is published", () => {
  it("serves a JSON Schema at the path the export points to", async () => {
    const exported = JSON.parse(exportUniversalCrfJson(ONCOLOGY_RECIST_PRESET));
    expect(exported.$schema).toBe(getUniversalCrfSchemaUrl());
    expect(new URL(exported.$schema).pathname).toBe(
      "/schemas/crf/v1/universal-crf.schema.json"
    );

    const res = await GET();
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain(
      "application/schema+json"
    );
    const schema = await res.json();
    expect(schema.$id).toBe(getUniversalCrfSchemaUrl());
    expect(schema.type).toBe("object");
    expect(schema.properties.forms).toBeDefined();
  });
});
