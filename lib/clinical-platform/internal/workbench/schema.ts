/**
 * What the SQL workbench loads and its schema browser shows (#2633): the
 * gold layer, the consumer layer an analyst queries and the one every
 * governed metric reads. Descriptions, owners and classifications come from
 * each table's data contract (#2626), so the browser shows the governance
 * a reviewer would check before using a column.
 */
import type {
  DataContract,
  DataProduct,
  Warehouse,
  WorkbenchTable,
} from "../../types";
import { WAREHOUSE_SCHEMA, qualifiedName } from "../warehouse/schema";

/**
 * The gold tables the workbench loads, in schema order, each with its
 * contract's columns and governance and its row count.
 *
 * Every visitor can read what the workbench loads, so a restricted column
 * must never reach it. The function refuses rather than drop the column
 * silently: a restricted column in gold is a contract decision to revisit.
 *
 * @param products - The data products, from `dataProducts`.
 * @param contracts - The contracts in force, from `dataContracts`.
 * @param warehouse - The warehouse the rows are counted in.
 * @returns The tables.
 * @throws Error when a gold column is classified restricted, or a gold
 *   table has no product or contract.
 */
export function workbenchSchema(
  products: readonly DataProduct[],
  contracts: readonly DataContract[],
  warehouse: Warehouse
): WorkbenchTable[] {
  const contractOf = new Map(contracts.map((c) => [c.productId, c]));
  const productOf = new Map(products.map((p) => [p.id, p]));
  return WAREHOUSE_SCHEMA.tables
    .filter((table) => table.layer === "gold")
    .map((table): WorkbenchTable => {
      const name = qualifiedName(table);
      const contract = contractOf.get(name);
      const product = productOf.get(name);
      const object = contract?.objects[0];
      if (contract === undefined || product === undefined || !object) {
        throw new Error(`${name} has no data product or contract`);
      }
      const restricted = object.columns.filter(
        (c) => c.classification === "restricted"
      );
      if (restricted.length > 0) {
        throw new Error(
          `${name}.${restricted[0].name} is restricted, and the workbench shows every column to every visitor`
        );
      }
      return {
        name,
        kind: table.kind,
        description: object.description,
        grain: object.grain,
        primaryKey: object.primaryKey,
        owner: product.owner,
        steward: product.steward,
        classification: product.classification,
        personalHealthData: product.personalHealthData,
        contractVersion: contract.version,
        rowCount: warehouse.tables[name]?.length ?? 0,
        columns: object.columns.map((c) => ({
          name: c.name,
          type: c.type,
          nullable: c.nullable,
          description: c.description,
          classification: c.classification,
        })),
      };
    });
}
