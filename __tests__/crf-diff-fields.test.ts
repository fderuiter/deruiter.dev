import { describe, expect, it } from "vitest";
import { diffFields } from "@/lib/crf";

/**
 * diffFields (#3477): the typed comparison the study baseline diff uses for
 * every entity, so it compares typed objects without casting them to a
 * record first.
 */

interface Entity {
  readonly id: string;
  readonly name: string;
  readonly required?: boolean;
  readonly options?: readonly string[];
}

describe("diffFields", () => {
  it("names a field that changed and not one that did not", () => {
    const before: Entity = { id: "a", name: "Weight", required: true };
    const after: Entity = { id: "a", name: "Body weight", required: true };
    expect(diffFields(before, after, ["name", "required"])).toEqual(["name"]);
  });

  it("names nothing when every listed field is equal", () => {
    const entity: Entity = { id: "a", name: "Weight", options: ["kg", "lb"] };
    expect(
      diffFields(entity, { ...entity, options: ["kg", "lb"] }, [
        "name",
        "options",
      ])
    ).toEqual([]);
  });

  it("names a key that is missing on one side", () => {
    const before: Entity = { id: "a", name: "Weight" };
    const after: Entity = { id: "a", name: "Weight", required: false };
    expect(diffFields(before, after, ["required"])).toEqual(["required"]);
    expect(diffFields(after, before, ["required"])).toEqual(["required"]);
  });

  it("compares only the keys it is given, in their order", () => {
    const before: Entity = { id: "a", name: "Weight", required: true };
    const after: Entity = { id: "b", name: "Height", required: false };
    expect(diffFields(before, after, ["required", "name"])).toEqual([
      "required",
      "name",
    ]);
  });
});
