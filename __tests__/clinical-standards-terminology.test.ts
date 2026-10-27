/**
 * The two controlled-terminology subsets in lib/clinical-standards (#2927
 * item 9): the codelists CRF Studio offers for collection and the codelists
 * the study-data pipeline writes to SDTM, ADaM and Define-XML. They stay
 * separate because each lists only the terms its own output uses, but a
 * CDISC codelist both carry must agree on every term they share, so a code
 * fixed in one cannot stay wrong in the other.
 */
import { describe, expect, it } from "vitest";
import {
  CONTROLLED_TERMINOLOGY,
  STANDARD_CODELISTS,
} from "@/lib/clinical-standards";

const pipelineByNci = new Map(
  CONTROLLED_TERMINOLOGY.filter((list) => list.nciCode).map((list) => [
    list.nciCode!,
    list,
  ])
);
const shared = STANDARD_CODELISTS.flatMap((crf) => {
  const pipeline =
    crf.nciCodelistCode && pipelineByNci.get(crf.nciCodelistCode);
  return pipeline ? [{ crf, pipeline }] : [];
});

describe("shared CDISC codelists", () => {
  it("covers the codelists both tools use", () => {
    expect(shared.map(({ pipeline }) => pipeline.id).sort()).toEqual([
      "NY",
      "RACEC",
      "ROUTE",
      "SEX",
      "UNIT",
    ]);
  });

  it.each(
    shared.map(({ crf, pipeline }) => [crf.id, pipeline.id, crf, pipeline])
  )(
    "%s and %s agree on every shared term's NCI code",
    (_crfId, _pipelineId, crf, pipeline) => {
      const pipelineCodes = new Map(
        pipeline.terms.map((term) => [term.value, term.nciCode])
      );
      const disagreements = crf.options
        .filter(
          (option) =>
            pipelineCodes.has(option.code) &&
            pipelineCodes.get(option.code) !== option.nciCode
        )
        .map(
          (option) =>
            `${option.code}: CRF ${option.nciCode}, pipeline ${pipelineCodes.get(option.code)}`
        );
      expect(disagreements).toEqual([]);
    }
  );
});
