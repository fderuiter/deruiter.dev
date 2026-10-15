// @vitest-environment node
import { describe, expect, it } from "vitest";
import { CHIP_SPECS, isWireCompatible, type ChipKind } from "@/lib/protocol-drift";
import { wireRefusal } from "@/components/protocol-drift/wire-refusal";

const kinds = Object.keys(CHIP_SPECS) as ChipKind[];

/** Every refused output/input pair in the chip set. */
function refusedPairs() {
  const pairs: Array<[ChipKind, string, ChipKind, string]> = [];
  for (const a of kinds)
    for (const out of CHIP_SPECS[a].outputs)
      for (const b of kinds)
        for (const inp of CHIP_SPECS[b].inputs)
          if (!isWireCompatible(a, out.handle, b, inp.handle))
            pairs.push([a, out.handle, b, inp.handle]);
  return pairs;
}

describe("wire refusal copy (#2167)", () => {
  it("names both pins and a reason for every refused pair", () => {
    const pairs = refusedPairs();
    expect(pairs.length).toBeGreaterThan(0);
    for (const [a, out, b, inp] of pairs) {
      const text = wireRefusal(a, out, b, inp);
      expect(text).toContain(`${a}.${out} to ${b}.${inp}`);
      expect(text).toMatch(/sends \w+ data and the pin takes \w+|flows down/);
    }
  });

  it("explains a type mismatch with both data types", () => {
    const [a, out, b, inp] = refusedPairs().find(
      ([a, out, b, inp]) =>
        CHIP_SPECS[a].outputs.find((p) => p.handle === out)?.type !==
        CHIP_SPECS[b].inputs.find((p) => p.handle === inp)?.type
    )!;
    const sent = CHIP_SPECS[a].outputs.find((p) => p.handle === out)?.type;
    const taken = CHIP_SPECS[b].inputs.find((p) => p.handle === inp)?.type;
    expect(wireRefusal(a, out, b, inp)).toBe(
      `Can't wire ${a}.${out} to ${b}.${inp}: it sends ${sent} data and the pin takes ${taken}.`
    );
  });
});
