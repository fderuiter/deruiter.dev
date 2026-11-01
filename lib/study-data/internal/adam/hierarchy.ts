/**
 * Hierarchical composite specs: for each study, the time-to-event
 * parameters ADTTE derives for the composite, the components ADHCE
 * records, in priority order, and how the analysis compares each one.
 *
 * A study gets the spec whose endpoint ids it defines, all of them. A study
 * that defines none of them gets the DEMO-301 spec, as every study did
 * before specs were per study (#3420).
 */
import type { StudyDefinition } from "../../types";
import type { AdamMethodId } from "./specs";

/** Where a time-to-event parameter finds its event. */
export type TimeToEventSource =
  /** Death, dated at ADSL.DTHDT. */
  | { readonly kind: "death" }
  /** The first serious treatment-emergent AE in the on-treatment period. */
  | { readonly kind: "serious-teae" }
  /** The first rescue medication in the on-treatment period. */
  | { readonly kind: "rescue-medication" }
  /** The first SDTM CE record with this CEDECOD, on or after first exposure. */
  | {
      readonly kind: "clinical-event";
      readonly decod: string;
      readonly description: string;
    };

/** One ADTTE parameter the composite reads. */
export interface TimeToEventParameter {
  readonly paramcd: string;
  readonly param: string;
  readonly source: TimeToEventSource;
}

/** Where an ADHCE component takes its value from. */
export type HierarchyComponentSource =
  | { readonly dataset: "ADTTE"; readonly paramcd: string }
  | {
      readonly dataset: "ADVS" | "ADQS";
      readonly paramcd: string;
      /** AVISIT of the primary analysis record whose CHG is the value. */
      readonly visit: string;
    };

/** One component of a hierarchical composite. */
export interface HierarchyComponent {
  /** ADHCE PARAMCD. */
  readonly paramcd: string;
  /** ADHCE PARAM. */
  readonly param: string;
  /** ADHCE AVALU. */
  readonly unit: string;
  readonly from: HierarchyComponentSource;
  /** The value-level method that derives AVAL. */
  readonly method: AdamMethodId;
  /** Label for tables. */
  readonly label: string;
  readonly kind: "time-to-event" | "continuous";
  /** Which values are better; for a time to an event, later is `"higher"`. */
  readonly better: "higher" | "lower";
  /** The difference within which two continuous values tie. */
  readonly margin?: number;
  /** The comparison rule, in words, for table footnotes. */
  readonly rule: string;
}

/** One study's hierarchical composite. */
export interface HierarchySpec {
  /** Identifier, for example `DEMO-301`. */
  readonly id: string;
  /**
   * The USDM endpoint ids that select this spec. A study that defines all
   * of them gets it. Empty for the default spec.
   */
  readonly endpointIds: readonly string[];
  /**
   * The follow-up the time-to-event parameters are censored at, in days
   * from first exposure, or `null` for none.
   */
  readonly horizonDays: number | null;
  /** ADTTE parameters after TTADISC, in ASEQ order. */
  readonly timeToEvent: readonly TimeToEventParameter[];
  /** ADHCE components, most important first. */
  readonly components: readonly HierarchyComponent[];
  /** The methods ADTTE and ADHCE cite for this composite. */
  readonly methods: {
    readonly event: AdamMethodId;
    readonly censor: AdamMethodId;
    readonly component: AdamMethodId;
  };
}

/** DEMO-301: death, serious TEAE, rescue medication, then SBP at Week 12. */
export const DEMO_301_HIERARCHY: HierarchySpec = {
  id: "DEMO-301",
  endpointIds: [],
  horizonDays: null,
  timeToEvent: [
    {
      paramcd: "TTDTH",
      param: "Time to Death from Any Cause",
      source: { kind: "death" },
    },
    {
      paramcd: "TTSAE",
      param: "Time to First Serious TEAE",
      source: { kind: "serious-teae" },
    },
    {
      paramcd: "TTRESC",
      param: "Time to First Rescue Medication",
      source: { kind: "rescue-medication" },
    },
  ],
  components: [
    {
      paramcd: "HCEDTH",
      param: "Death from Any Cause (days)",
      unit: "DAYS",
      from: { dataset: "ADTTE", paramcd: "TTDTH" },
      method: "ADHCE_TTE",
      label: "Death from any cause",
      kind: "time-to-event",
      better: "higher",
      rule: "a later death, or no death, is better",
    },
    {
      paramcd: "HCESAE",
      param: "First Serious TEAE (days)",
      unit: "DAYS",
      from: { dataset: "ADTTE", paramcd: "TTSAE" },
      method: "ADHCE_TTE",
      label: "First serious TEAE",
      kind: "time-to-event",
      better: "higher",
      rule: "a later first serious TEAE, or none, is better",
    },
    {
      paramcd: "HCERESC",
      param: "First Rescue Medication (days)",
      unit: "DAYS",
      from: { dataset: "ADTTE", paramcd: "TTRESC" },
      method: "ADHCE_TTE",
      label: "First rescue medication",
      kind: "time-to-event",
      better: "higher",
      rule: "later first rescue medication, or none, is better",
    },
    {
      paramcd: "HCESBP",
      param: "SBP Change from Baseline at Week 12 (mmHg)",
      unit: "mmHg",
      from: { dataset: "ADVS", paramcd: "SYSBP", visit: "WEEK 12" },
      method: "ADHCE_SBP",
      label: "SBP change from baseline at Week 12",
      kind: "continuous",
      better: "lower",
      margin: 5,
      rule: "a larger fall is better, and differences of 5 mmHg or less tie",
    },
  ],
  methods: {
    event: "ADTTE_EVENT",
    censor: "ADTTE_CENSOR",
    component: "ADHCE_COMPONENT",
  },
};

/**
 * The randomised TAVR versus SAVR study's 1-year composite: death, disabling
 * stroke, valve-related or heart-failure rehospitalisation, then the change
 * in the VSFS overall summary score at 1 year.
 */
export const VALVE_1Y_HIERARCHY: HierarchySpec = {
  id: "VALVE-1Y",
  endpointIds: [
    "ep_rct_death",
    "ep_rct_stroke",
    "ep_rct_rehosp",
    "ep_rct_vsfs",
  ],
  horizonDays: 365,
  timeToEvent: [
    {
      paramcd: "TTDTH",
      param: "Time to Death from Any Cause",
      source: { kind: "death" },
    },
    {
      paramcd: "TTSTROKE",
      param: "Time to First Disabling Stroke",
      source: {
        kind: "clinical-event",
        decod: "DISABLING STROKE",
        description: "First adjudicated disabling stroke",
      },
    },
    {
      paramcd: "TTREHOSP",
      param: "Time to First Valve-Related or HF Rehospitalisation",
      source: {
        kind: "clinical-event",
        decod: "REHOSPITALISATION",
        description: "First adjudicated rehospitalisation",
      },
    },
  ],
  components: [
    {
      paramcd: "HCEDTH",
      param: "Death from Any Cause (days)",
      unit: "DAYS",
      from: { dataset: "ADTTE", paramcd: "TTDTH" },
      method: "ADHCE_TTE",
      label: "Death from any cause",
      kind: "time-to-event",
      better: "higher",
      rule: "a later death, or no death, is better",
    },
    {
      paramcd: "HCESTRK",
      param: "First Disabling Stroke (days)",
      unit: "DAYS",
      from: { dataset: "ADTTE", paramcd: "TTSTROKE" },
      method: "ADHCE_TTE",
      label: "Disabling stroke",
      kind: "time-to-event",
      better: "higher",
      rule: "a later disabling stroke, or none, is better",
    },
    {
      paramcd: "HCEREHOS",
      param: "First Valve-Related or HF Rehospitalisation (days)",
      unit: "DAYS",
      from: { dataset: "ADTTE", paramcd: "TTREHOSP" },
      method: "ADHCE_TTE",
      label: "Valve-related or heart-failure rehospitalisation",
      kind: "time-to-event",
      better: "higher",
      rule: "a later first rehospitalisation, or none, is better",
    },
    {
      paramcd: "HCEVSFS",
      param: "VSFS Overall Summary Change from Baseline at 1 Year",
      unit: "POINTS",
      from: {
        dataset: "ADQS",
        paramcd: "VSFSOS",
        visit: "1-Year Primary Endpoint Visit",
      },
      method: "ADHCE_VSFS",
      label: "VSFS overall summary change from baseline at 1 year",
      kind: "continuous",
      better: "higher",
      margin: 5,
      rule: "a larger improvement is better, and differences of less than 5 points tie",
    },
  ],
  methods: {
    event: "ADTTE_EVENT_1Y",
    censor: "ADTTE_CENSOR_1Y",
    component: "ADHCE_COMPONENT_1Y",
  },
};

/** Every hierarchy spec, the default first. */
export const HIERARCHY_SPECS: readonly HierarchySpec[] = [
  DEMO_301_HIERARCHY,
  VALVE_1Y_HIERARCHY,
];

/** The hierarchy spec of a study: the one whose endpoint ids it defines. */
export function hierarchyFor(definition: StudyDefinition): HierarchySpec {
  const endpoints = new Set(
    definition.design.objectives.flatMap((objective) =>
      objective.endpoints.map((endpoint) => endpoint.id)
    )
  );
  return (
    HIERARCHY_SPECS.find(
      (spec) =>
        spec.endpointIds.length > 0 &&
        spec.endpointIds.every((id) => endpoints.has(id))
    ) ?? DEMO_301_HIERARCHY
  );
}
