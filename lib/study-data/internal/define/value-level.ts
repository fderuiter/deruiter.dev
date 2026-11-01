import { HIERARCHY_SPECS } from "../adam/hierarchy";

/**
 * Value-level metadata specs: the datasets whose result variables differ by
 * parameter, the variable that names the parameter, and the variables the
 * define describes once per parameter.
 */

/** One dataset's value-level metadata spec. */
export interface ValueLevelSpec {
  /** The variable whose value selects the parameter, for example `VSTESTCD`. */
  readonly by: string;
  /** The variables described per parameter, in dataset order. */
  readonly variables: readonly string[];
  /**
   * Parameters whose values are derived rather than carried from a
   * predecessor, with the variables that are derived and the method that
   * derives them, for example ADEG's QTcF.
   */
  readonly derived?: Readonly<
    Record<
      string,
      { readonly variables: readonly string[]; readonly method: string }
    >
  >;
}

/**
 * The ADHCE components of every hierarchy spec, with the method that
 * derives each one's AVAL. A component two specs share keeps one method.
 */
const ADHCE_DERIVED = Object.fromEntries(
  HIERARCHY_SPECS.flatMap((spec) => spec.components).map((component) => [
    component.paramcd,
    { variables: ["AVAL"], method: component.method },
  ])
);

/**
 * Value-level metadata for the VS, LB, EG, ADVS, ADLB, ADEG, ADQS and
 * ADHCE parameters.
 */
export const VALUE_LEVEL: Readonly<Record<string, ValueLevelSpec>> =
  Object.freeze({
    VS: {
      by: "VSTESTCD",
      variables: ["VSORRES", "VSORRESU", "VSSTRESC", "VSSTRESN", "VSSTRESU"],
    },
    LB: {
      by: "LBTESTCD",
      variables: ["LBORRES", "LBORRESU", "LBSTRESC", "LBSTRESN", "LBSTRESU"],
    },
    EG: {
      by: "EGTESTCD",
      variables: ["EGORRES", "EGORRESU", "EGSTRESC", "EGSTRESN", "EGSTRESU"],
    },
    ADVS: { by: "PARAMCD", variables: ["AVAL", "AVALU"] },
    ADLB: { by: "PARAMCD", variables: ["AVAL", "AVALU"] },
    ADQS: { by: "PARAMCD", variables: ["AVAL"] },
    ADEG: {
      by: "PARAMCD",
      variables: ["AVAL", "AVALU"],
      derived: { QTCFAG: { variables: ["AVAL"], method: "ADEG_QTCF" } },
    },
    ADHCE: {
      by: "PARAMCD",
      variables: ["AVAL", "AVALU"],
      derived: ADHCE_DERIVED,
    },
  });
