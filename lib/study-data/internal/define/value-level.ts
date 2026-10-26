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
}

/** Value-level metadata for the VS, LB, EG, ADVS and ADLB parameters. */
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
  });
