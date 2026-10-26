/**
 * Turns the Arrow record batches the SQL engine streams back into the
 * workbench's result: each value as the text a person reads, with SQL NULL
 * kept apart. Numbers keep the precision the engine returned, dates are ISO
 * 8601, and a type the grid cannot show says how to see it.
 */
import { Type, util, type DataType, type Field } from "apache-arrow";
import type {
  WorkbenchResult,
  WorkbenchResultColumn,
} from "@/lib/clinical-platform";

/** The parts of an Arrow record batch the conversion reads. */
interface Batch {
  readonly numRows: number;
  readonly schema: { readonly fields: readonly Field[] };
  getChildAt(index: number): { get(row: number): unknown } | null;
}

const pad = (value: number, width = 2) => String(value).padStart(width, "0");

/** A decimal's unscaled integer with its point put back. */
function decimalText(unscaled: bigint, scale: number): string {
  if (scale <= 0) return unscaled.toString();
  const negative = unscaled < BigInt(0);
  const digits = (negative ? -unscaled : unscaled)
    .toString()
    .padStart(scale + 1, "0");
  const text = `${digits.slice(0, -scale)}.${digits.slice(-scale)}`;
  return negative ? `-${text}` : text;
}

function timestampText(ms: number, zoned: boolean): string {
  const date = new Date(ms);
  const time = `${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}`;
  const fraction =
    date.getUTCMilliseconds() === 0
      ? ""
      : `.${pad(date.getUTCMilliseconds(), 3)}`;
  return `${date.toISOString().slice(0, 10)} ${time}${fraction}${zoned ? "Z" : ""}`;
}

function jsonText(value: unknown): string {
  const plain =
    typeof value === "object" &&
    value !== null &&
    "toJSON" in value &&
    typeof value.toJSON === "function"
      ? (value.toJSON as () => unknown)()
      : value;
  return JSON.stringify(plain, (_key, item: unknown) =>
    typeof item === "bigint" ? item.toString() : item
  );
}

/**
 * One value as text, or `null` for SQL NULL.
 *
 * @param type - The column's Arrow type.
 * @param value - The value Arrow returned for one row.
 */
export function cellText(type: DataType, value: unknown): string | null {
  if (value === null || value === undefined) return null;
  switch (type.typeId) {
    case Type.Int:
    case Type.Float:
      return String(value);
    case Type.Decimal:
      return decimalText(
        util.bigNumToBigInt(value as Parameters<typeof util.bigNumToBigInt>[0]),
        (type as DataType<Type.Decimal> & { scale: number }).scale
      );
    case Type.Date:
      return new Date(Number(value)).toISOString().slice(0, 10);
    case Type.Timestamp:
      return timestampText(
        Number(value),
        Boolean(
          (type as DataType<Type.Timestamp> & { timezone?: string }).timezone
        )
      );
    case Type.Bool:
      return value ? "true" : "false";
    case Type.Utf8:
    case Type.LargeUtf8:
      return String(value);
    case Type.Binary:
    case Type.LargeBinary:
      return `\\x${Array.from(value as Uint8Array, (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
    case Type.List:
    case Type.FixedSizeList:
    case Type.Struct:
    case Type.Map:
      return jsonText(value);
    case Type.Dictionary:
      return typeof value === "string" ? value : jsonText(value);
    default:
      return `(${String(type)}: cast it to VARCHAR to read it)`;
  }
}

/** A short name for a column's Arrow type. */
function typeName(type: DataType): string {
  switch (type.typeId) {
    case Type.Int: {
      const int = type as DataType<Type.Int> & {
        bitWidth: number;
        isSigned: boolean;
      };
      return `${int.isSigned ? "Int" : "UInt"}${int.bitWidth}`;
    }
    case Type.Float:
      return "Double";
    case Type.Decimal: {
      const decimal = type as DataType<Type.Decimal> & {
        precision: number;
        scale: number;
      };
      return `Decimal(${decimal.precision},${decimal.scale})`;
    }
    case Type.Utf8:
    case Type.LargeUtf8:
      return "Text";
    case Type.Bool:
      return "Boolean";
    case Type.Date:
      return "Date";
    case Type.Timestamp:
      return "Timestamp";
    case Type.Dictionary:
      return typeName(
        (type as DataType<Type.Dictionary> & { dictionary: DataType })
          .dictionary
      );
    default:
      return String(type);
  }
}

const NUMERIC = new Set<Type>([Type.Int, Type.Float, Type.Decimal]);

/** The columns of a result, from its schema. */
function resultColumns(fields: readonly Field[]): WorkbenchResultColumn[] {
  return fields.map((field) => ({
    name: field.name,
    type: typeName(field.type),
    numeric: NUMERIC.has(field.type.typeId),
  }));
}

/**
 * Collects a result from the engine's record batches, keeping at most
 * `maxRows` rows and counting the rest.
 */
export class ResultCollector {
  private columns: WorkbenchResultColumn[] = [];
  private fields: readonly Field[] = [];
  private readonly rows: (string | null)[][] = [];
  private rowCount = 0;

  constructor(private readonly maxRows: number) {}

  /** Adds one record batch. */
  add(batch: Batch): void {
    if (this.fields.length === 0) {
      this.fields = batch.schema.fields;
      this.columns = resultColumns(this.fields);
    }
    const children = this.fields.map((_, at) => batch.getChildAt(at));
    const room = Math.max(0, this.maxRows - this.rows.length);
    const keep = Math.min(batch.numRows, room);
    for (let row = 0; row < keep; row += 1) {
      this.rows.push(
        this.fields.map((field, at) =>
          cellText(field.type, children[at]?.get(row))
        )
      );
    }
    this.rowCount += batch.numRows;
  }

  /** The result so far, timed at `elapsedMs`. */
  result(elapsedMs: number): WorkbenchResult {
    return {
      columns: this.columns,
      rows: this.rows,
      rowCount: this.rowCount,
      truncated: this.rowCount > this.rows.length,
      elapsedMs,
    };
  }
}
