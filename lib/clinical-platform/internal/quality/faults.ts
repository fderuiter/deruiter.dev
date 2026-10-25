/**
 * Defects of the kind operational feeds really deliver (#2636), each applied
 * to the silver layer as it would arrive from its source. Gold is not
 * rebuilt, so the reconciliation rules see silver and gold disagree, as
 * they would between a bad load and the next build.
 */
import type { DqScenario, Warehouse, WarehouseRow } from "../../types";
import { addDays } from "../warehouse/dates";
import { addRow, editRow } from "./context";

interface Scenario extends DqScenario {
  readonly apply: (warehouse: Warehouse) => Warehouse;
}

function table(warehouse: Warehouse, name: string): readonly WarehouseRow[] {
  const rows = warehouse.tables[name];
  if (rows === undefined) throw new Error(`the warehouse has no ${name}`);
  return rows;
}

const SCENARIOS: readonly Scenario[] = [
  {
    id: "duplicate-ctms-site",
    name: "A site arrives twice from a second CTMS instance",
    story:
      "A CRO migrates a study to its own CTMS and both instances feed the warehouse, so one site arrives under two site ids.",
    sourceSystem: "CTMS",
    ruleIds: ["DQ-C09", "DQ-U01", "DQ-U02"],
    apply: (w) =>
      addRow(
        w,
        "silver.site",
        (r) => r.activated_on !== null,
        (r) => ({ site_id: `${String(r.site_id)}-CRO` })
      ),
  },
  {
    id: "visit-before-consent",
    name: "A visit is dated before the subject consented",
    story:
      "A coordinator keys the visit date in the wrong year, which puts the visit before the subject signed consent.",
    sourceSystem: "EDC",
    ruleIds: ["DQ-K02", "DQ-T01"],
    apply: (w) =>
      editRow(
        w,
        "silver.edc_visit",
        (r) => r.visit_status === "entered" && r.planned_visit_id !== "D1",
        (r) => ({ visit_date: addDays(String(r.visit_date), -365) })
      ),
  },
  {
    id: "query-closed-before-open",
    name: "A query is closed before it was opened",
    story:
      "An EDC upgrade writes the close timestamp in local time and the open timestamp in UTC, so a query closes hours before it opens.",
    sourceSystem: "EDC",
    ruleIds: ["DQ-K04"],
    apply: (w) =>
      editRow(
        w,
        "silver.edc_query",
        (r) => r.query_status === "closed",
        (r) => ({
          closed_at: `${addDays(String(r.opened_at), -1)}T23:00:00Z`,
        })
      ),
  },
  {
    id: "expired-kit-dispensed",
    name: "A kit is dispensed after it expired",
    story:
      "The IRT accepts a dispensation the site keyed late from a kit that had already expired on the shelf.",
    sourceSystem: "IRT",
    ruleIds: ["DQ-K08"],
    apply: (w) =>
      editRow(
        w,
        "silver.irt_kit",
        (r) => r.kit_status === "dispensed",
        (r) => ({ dispensed_on: addDays(String(r.expires_on), 5) })
      ),
  },
  {
    id: "finance-double-load",
    name: "A finance quarter is loaded twice",
    story:
      "A rerun of the finance extract adds a quarter's actuals on top of the first load instead of replacing them, so the keys stay unique and the amounts double.",
    sourceSystem: "Finance",
    ruleIds: ["DQ-A04"],
    apply: (w) => {
      const first = table(w, "silver.finance_line")[0];
      return {
        ...w,
        tables: {
          ...w.tables,
          "silver.finance_line": table(w, "silver.finance_line").map((r) =>
            r.study_id === first.study_id &&
            r.fiscal_quarter === first.fiscal_quarter
              ? { ...r, actual_usd: Number(r.actual_usd) * 2 }
              : r
          ),
        },
      };
    },
  },
  {
    id: "enrollment-date-dropped",
    name: "An enrolled subject loses their enrollment date",
    story:
      "An interface change maps the EDC's enrollment date from a renamed field, so a subject enrolled after the change arrives enrolled with no date.",
    sourceSystem: "EDC",
    ruleIds: ["DQ-C02", "DQ-K07", "DQ-A03"],
    apply: (w) =>
      editRow(
        w,
        "silver.edc_subject",
        (r) => r.subject_status === "enrolled",
        () => ({ enrolled_on: null })
      ),
  },
  {
    id: "late-edc-entry",
    name: "A site enters its visits six weeks late",
    story:
      "A site's coordinator leaves and the backlog of visit data is entered in one sitting six weeks later. The portfolio threshold absorbs one site's backlog, so the rule's failing count rises and its status holds; the site-level entry lag KRI is what flags the site.",
    sourceSystem: "EDC",
    ruleIds: ["DQ-T01"],
    apply: (w) => {
      const visits = table(w, "silver.edc_visit");
      const site = visits.find((r) => r.visit_status === "entered")?.site_id;
      return {
        ...w,
        tables: {
          ...w.tables,
          "silver.edc_visit": visits.map((r) =>
            r.site_id === site && r.visit_status === "entered"
              ? {
                  ...r,
                  data_entered_at: `${addDays(String(r.visit_date), 42)}T16:00:00Z`,
                }
              : r
          ),
        },
      };
    },
  },
];

/** The named defects, each with the rules that catch it. */
export const DQ_SCENARIOS: readonly DqScenario[] = Object.freeze(
  SCENARIOS.map(({ apply: _apply, ...scenario }) => scenario)
);

/**
 * A copy of a warehouse with one named defect in it.
 *
 * @throws Error for an unknown scenario id.
 */
export function applyDqScenario(
  warehouse: Warehouse,
  scenarioId: string
): Warehouse {
  const scenario = SCENARIOS.find((s) => s.id === scenarioId);
  if (scenario === undefined) {
    throw new Error(`no data quality scenario ${scenarioId}`);
  }
  return scenario.apply(warehouse);
}
