/**
 * Builds the silver and gold layers of one portfolio.
 */
import type {
  Portfolio,
  SiteStaffAssignment,
  Warehouse,
  WarehouseRow,
} from "../../types";
import { siteStaffFeed } from "../portfolio/staff";
import { buildGold } from "./gold";
import { WAREHOUSE_SCHEMA, qualifiedName } from "./schema";
import { conformBronze, dedupe } from "./silver";

/** Options for `buildWarehouse`. */
export interface WarehouseOptions {
  /**
   * Site staff assignments to use in place of `siteStaffFeed(portfolio)`,
   * for example a fixture with a known principal investigator change.
   */
  readonly siteStaff?: readonly SiteStaffAssignment[];
}

/**
 * Builds the silver and gold layers of a portfolio. Silver conforms each
 * bronze feed and keeps one row per primary key; gold is a star schema of
 * conformed dimensions and facts at a declared grain, with SCD type 2 on
 * `dim_site`. The output is a pure function of the portfolio: no clock,
 * locale or random input.
 *
 * @param portfolio - The portfolio, from `generatePortfolio`.
 * @param options - Optional site staff override.
 * @returns Rows per qualified table name, in `WAREHOUSE_SCHEMA` order.
 * @throws Error when a fact has no site version on its date, which would mean
 * the portfolio broke its own date invariants.
 */
export function buildWarehouse(
  portfolio: Portfolio,
  options: WarehouseOptions = {}
): Warehouse {
  const conformed = conformBronze(
    portfolio,
    options.siteStaff ?? siteStaffFeed(portfolio)
  );
  const silver: Record<string, readonly WarehouseRow[]> = {};
  for (const table of WAREHOUSE_SCHEMA.tables) {
    if (table.layer !== "silver") continue;
    silver[table.name] = dedupe(conformed[table.name] ?? [], table.primaryKey);
  }
  const gold = buildGold(silver, portfolio.asOf);
  const tables: Record<string, readonly WarehouseRow[]> = {};
  for (const table of WAREHOUSE_SCHEMA.tables) {
    const rows =
      table.layer === "silver" ? silver[table.name] : gold[table.name];
    tables[qualifiedName(table)] = rows ?? [];
  }
  return {
    portfolioId: portfolio.id,
    seed: portfolio.seed,
    asOf: portfolio.asOf,
    tables,
  };
}
