/**
 * Clinical Data Platform: column-level OpenLineage and impact analysis types.
 */
import type { LineageStage } from "./platform";

/** A node reached from another, and how many edges away (#2637). */
export interface LineageReach {
  readonly id: string;
  readonly stage: LineageStage;
  readonly distance: number;
}

/** What a change to one node reaches, and who to tell (#2637). */
export interface LineageImpact {
  readonly origin: string;
  /** Every downstream node, nearest first, then by id. */
  readonly downstream: readonly LineageReach[];
  /** Roles accountable for a downstream node, each with the nodes they own, by role. */
  readonly notify: readonly {
    readonly owner: string;
    readonly nodeIds: readonly string[];
  }[];
}

/**
 * What a change between two releases of a data contract reaches through the
 * lineage graph, and who to tell (#2637). Used to review a contract change
 * (#2626) before it is released.
 */
export interface ContractChangeImpact {
  readonly productId: string;
  /** Version of the earlier release. */
  readonly from: string;
  /** Version of the later release. */
  readonly to: string;
  /** Lineage node ids of the columns that changed or were removed, by id. */
  readonly changed: readonly string[];
  /** Every node downstream of a changed column, nearest first, then by id. */
  readonly downstream: readonly LineageReach[];
  /** Roles accountable for a downstream node, each with the nodes they own, by role. */
  readonly notify: LineageImpact["notify"];
}

/** A broken rule of the lineage graph (#2637). */
export interface LineageFinding {
  readonly rule:
    | "dangling-edge"
    | "duplicate-node"
    | "cycle"
    | "metric-without-source"
    | "report-without-metric";
  readonly message: string;
}

/** One input field of an OpenLineage column-lineage facet (#2637). */
export interface OpenLineageInputField {
  readonly namespace: string;
  readonly name: string;
  readonly field: string;
  readonly transformations: readonly {
    readonly type: "DIRECT" | "INDIRECT";
    readonly subtype: string;
    readonly description: string;
  }[];
}

/** An OpenLineage 2-0-2 dataset reference, with facets on outputs (#2637). */
export interface OpenLineageDataset {
  readonly namespace: string;
  readonly name: string;
  readonly facets?: Readonly<Record<string, unknown>>;
}

/**
 * An OpenLineage 2-0-2 `RunEvent` for one platform step: the job that
 * builds one dataset, its inputs, and the output with its schema, owners
 * and column lineage (#2637).
 */
export interface OpenLineageRunEvent {
  readonly eventType: "COMPLETE";
  readonly eventTime: string;
  readonly producer: string;
  readonly schemaURL: string;
  readonly run: { readonly runId: string };
  readonly job: {
    readonly namespace: string;
    readonly name: string;
    readonly facets: Readonly<Record<string, unknown>>;
  };
  readonly inputs: readonly OpenLineageDataset[];
  readonly outputs: readonly OpenLineageDataset[];
}
