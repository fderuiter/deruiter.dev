/**
 * Self-contained Apache Parquet (`PAR1`) result writer for the SQL notebook.
 *
 * Uploaded `.parquet` files are read natively by DuckDB's `read_parquet`
 * before `WORKBENCH_ENGINE_SETTINGS` locks the engine configuration. Once
 * locked (`enable_external_access = false`, `lock_configuration = true`),
 * DuckDB refuses `COPY (...) TO` against the virtual file system as well, so
 * exporting an in-memory `WorkbenchResult` to `.parquet` writes uncompressed
 * `PLAIN` data pages directly in TypeScript.
 */
import type { WorkbenchResult, WorkbenchResultColumn } from "../../types";

const MAGIC = new Uint8Array([0x50, 0x41, 0x52, 0x31]); // "PAR1"
const encoder = new TextEncoder();

// Parquet Thrift enums (parquet.thrift)
const TYPE_BOOLEAN = 0;
const TYPE_INT32 = 1;
const TYPE_INT64 = 2;
const TYPE_DOUBLE = 5;
const TYPE_BYTE_ARRAY = 6;

const CONVERTED_UTF8 = 0;
const REP_OPTIONAL = 1;

const ENC_PLAIN = 0;
const ENC_RLE = 3;

const CODEC_UNCOMPRESSED = 0;
const PAGE_DATA = 0;

// TCompactProtocol wire types
const CT_STOP = 0;
const CT_I32 = 5;
const CT_I64 = 6;
const CT_BINARY = 8;
const CT_LIST = 9;
const CT_STRUCT = 12;

class ByteWriter {
  private buf = new Uint8Array(1024);
  private pos = 0;

  get length(): number {
    return this.pos;
  }

  private ensure(extra: number): void {
    if (this.pos + extra <= this.buf.length) return;
    let next = this.buf.length * 2;
    while (next < this.pos + extra) next *= 2;
    const grown = new Uint8Array(next);
    grown.set(this.buf.subarray(0, this.pos));
    this.buf = grown;
  }

  writeByte(b: number): void {
    this.ensure(1);
    this.buf[this.pos++] = b & 0xff;
  }

  writeBytes(bytes: Uint8Array): void {
    this.ensure(bytes.length);
    this.buf.set(bytes, this.pos);
    this.pos += bytes.length;
  }

  writeInt32LE(value: number): void {
    this.ensure(4);
    const view = new DataView(
      this.buf.buffer,
      this.buf.byteOffset + this.pos,
      4
    );
    view.setInt32(0, value, true);
    this.pos += 4;
  }

  writeInt64LE(value: bigint): void {
    this.ensure(8);
    const view = new DataView(
      this.buf.buffer,
      this.buf.byteOffset + this.pos,
      8
    );
    view.setBigInt64(0, value, true);
    this.pos += 8;
  }

  writeFloat64LE(value: number): void {
    this.ensure(8);
    const view = new DataView(
      this.buf.buffer,
      this.buf.byteOffset + this.pos,
      8
    );
    view.setFloat64(0, value, true);
    this.pos += 8;
  }

  writeVarint32(value: number): void {
    let u = value >>> 0;
    while (u >= 0x80) {
      this.writeByte((u & 0x7f) | 0x80);
      u >>>= 7;
    }
    this.writeByte(u);
  }

  writeVarint64(value: bigint): void {
    let u = BigInt.asUintN(64, value);
    const b128 = BigInt(128);
    const b7f = BigInt(0x7f);
    const b7 = BigInt(7);
    while (u >= b128) {
      this.writeByte(Number(u & b7f) | 0x80);
      u >>= b7;
    }
    this.writeByte(Number(u));
  }

  writeZigZag32(value: number): void {
    const n = value | 0;
    this.writeVarint32(((n << 1) ^ (n >> 31)) >>> 0);
  }

  writeZigZag64(value: bigint): void {
    const n = BigInt.asIntN(64, value);
    this.writeVarint64((n << BigInt(1)) ^ (n >> BigInt(63)));
  }

  toUint8Array(): Uint8Array {
    return this.buf.slice(0, this.pos);
  }
}

class CompactThriftWriter {
  private readonly stack: number[] = [];
  private lastFieldId = 0;

  constructor(readonly out: ByteWriter) {}

  beginStruct(): void {
    this.stack.push(this.lastFieldId);
    this.lastFieldId = 0;
  }

  endStruct(): void {
    this.out.writeByte(CT_STOP);
    this.lastFieldId = this.stack.pop() ?? 0;
  }

  private writeFieldHeader(fieldId: number, compactType: number): void {
    const delta = fieldId - this.lastFieldId;
    if (delta > 0 && delta <= 15) {
      this.out.writeByte((delta << 4) | compactType);
    } else {
      this.out.writeByte(compactType);
      this.out.writeZigZag32(fieldId);
    }
    this.lastFieldId = fieldId;
  }

  writeI32Field(fieldId: number, value: number): void {
    this.writeFieldHeader(fieldId, CT_I32);
    this.out.writeZigZag32(value);
  }

  writeI64Field(fieldId: number, value: bigint): void {
    this.writeFieldHeader(fieldId, CT_I64);
    this.out.writeZigZag64(value);
  }

  writeStringField(fieldId: number, value: string): void {
    this.writeFieldHeader(fieldId, CT_BINARY);
    const bytes = encoder.encode(value);
    this.out.writeVarint32(bytes.length);
    this.out.writeBytes(bytes);
  }

  writeStructField(fieldId: number, fn: () => void): void {
    this.writeFieldHeader(fieldId, CT_STRUCT);
    this.beginStruct();
    fn();
    this.endStruct();
  }

  writeListHeader(fieldId: number, elemType: number, size: number): void {
    this.writeFieldHeader(fieldId, CT_LIST);
    if (size < 15) {
      this.out.writeByte((size << 4) | elemType);
    } else {
      this.out.writeByte(0xf0 | elemType);
      this.out.writeVarint32(size);
    }
  }
}

function deduplicateNames(names: readonly string[]): string[] {
  const counts = new Map<string, number>();
  return names.map((raw, index) => {
    const base = raw.trim() || `column_${index + 1}`;
    const seen = counts.get(base) ?? 0;
    counts.set(base, seen + 1);
    return seen === 0 ? base : `${base}_${seen + 1}`;
  });
}

type WriterPhysicalSpec =
  | { readonly parquetType: typeof TYPE_BOOLEAN }
  | { readonly parquetType: typeof TYPE_INT32 }
  | { readonly parquetType: typeof TYPE_INT64 }
  | { readonly parquetType: typeof TYPE_DOUBLE }
  | { readonly parquetType: typeof TYPE_BYTE_ARRAY; readonly utf8: boolean };

function chooseWriterType(
  col: WorkbenchResultColumn,
  rows: readonly (readonly (string | null)[])[],
  at: number
): WriterPhysicalSpec {
  if (col.type === "Boolean") {
    const valid = rows.every((r) => {
      const v = r[at];
      return v === null || v === "true" || v === "false";
    });
    if (valid) return { parquetType: TYPE_BOOLEAN };
  }
  if (/^Int(8|16|32)$|^UInt(8|16)$/.test(col.type)) {
    const valid = rows.every((r) => {
      const v = r[at];
      if (v === null) return true;
      if (!/^-?\d+$/.test(v)) return false;
      const n = Number(v);
      return Number.isInteger(n) && n >= -2147483648 && n <= 2147483647;
    });
    if (valid) return { parquetType: TYPE_INT32 };
  }
  if (col.type === "Int64" || col.type === "UInt32") {
    const min64 = BigInt("-9223372036854775808");
    const max64 = BigInt("9223372036854775807");
    const valid = rows.every((r) => {
      const v = r[at];
      if (v === null) return true;
      if (!/^-?\d+$/.test(v)) return false;
      try {
        const b = BigInt(v);
        return b >= min64 && b <= max64;
      } catch {
        return false;
      }
    });
    if (valid) return { parquetType: TYPE_INT64 };
  }
  if (col.type === "Double" || col.type === "Float") {
    const valid = rows.every((r) => {
      const v = r[at];
      if (v === null) return true;
      const n = Number(v);
      return Number.isFinite(n);
    });
    if (valid) return { parquetType: TYPE_DOUBLE };
  }
  return { parquetType: TYPE_BYTE_ARRAY, utf8: true };
}

/** Encodes 1-bit definition levels (0 for null, 1 for present) with Parquet RLE/bit-packing. */
function encodeDefinitionLevels(
  rows: readonly (readonly (string | null)[])[],
  at: number
): Uint8Array {
  const count = rows.length;
  const groups = Math.ceil(count / 8);
  const payload = new ByteWriter();
  payload.writeVarint32((groups << 1) | 1);
  for (let g = 0; g < groups; g += 1) {
    let byte = 0;
    for (let bit = 0; bit < 8; bit += 1) {
      const idx = g * 8 + bit;
      if (idx < count && rows[idx][at] !== null) {
        byte |= 1 << bit;
      }
    }
    payload.writeByte(byte);
  }
  const encoded = payload.toUint8Array();
  const withLength = new ByteWriter();
  withLength.writeInt32LE(encoded.length);
  withLength.writeBytes(encoded);
  return withLength.toUint8Array();
}

function encodePlainValues(
  spec: WriterPhysicalSpec,
  rows: readonly (readonly (string | null)[])[],
  at: number
): Uint8Array {
  const out = new ByteWriter();
  if (spec.parquetType === TYPE_BOOLEAN) {
    const bools: boolean[] = [];
    for (const row of rows) {
      if (row[at] !== null) bools.push(row[at] === "true");
    }
    const byteCount = Math.ceil(bools.length / 8);
    for (let b = 0; b < byteCount; b += 1) {
      let packed = 0;
      for (let bit = 0; bit < 8; bit += 1) {
        const idx = b * 8 + bit;
        if (idx < bools.length && bools[idx]) packed |= 1 << bit;
      }
      out.writeByte(packed);
    }
    return out.toUint8Array();
  }
  for (const row of rows) {
    const val = row[at];
    if (val === null) continue;
    switch (spec.parquetType) {
      case TYPE_INT32:
        out.writeInt32LE(Number(val));
        break;
      case TYPE_INT64:
        out.writeInt64LE(BigInt(val));
        break;
      case TYPE_DOUBLE:
        out.writeFloat64LE(Number(val));
        break;
      case TYPE_BYTE_ARRAY: {
        const utf8 = encoder.encode(val);
        out.writeInt32LE(utf8.length);
        out.writeBytes(utf8);
        break;
      }
    }
  }
  return out.toUint8Array();
}

/**
 * Serializes a workbench query result into an Apache Parquet (`PAR1`) binary
 * file with optional definition levels and uncompressed PLAIN data pages.
 */
export function writeWorkbenchParquet(result: WorkbenchResult): Uint8Array {
  const out = new ByteWriter();
  out.writeBytes(MAGIC);

  const names = deduplicateNames(result.columns.map((c) => c.name));
  const specs = result.columns.map((col, at) =>
    chooseWriterType(col, result.rows, at)
  );
  const numRows = result.rows.length;

  interface ChunkWritten {
    readonly name: string;
    readonly parquetType: number;
    readonly offset: number;
    readonly totalSize: number;
    readonly numValues: number;
  }

  const chunks: ChunkWritten[] = [];

  if (numRows > 0 && result.columns.length > 0) {
    for (let at = 0; at < result.columns.length; at += 1) {
      const defBytes = encodeDefinitionLevels(result.rows, at);
      const valBytes = encodePlainValues(specs[at], result.rows, at);
      const pageSize = defBytes.length + valBytes.length;

      const headerBuf = new ByteWriter();
      const headerThrift = new CompactThriftWriter(headerBuf);
      headerThrift.beginStruct();
      headerThrift.writeI32Field(1, PAGE_DATA);
      headerThrift.writeI32Field(2, pageSize);
      headerThrift.writeI32Field(3, pageSize);
      headerThrift.writeStructField(5, () => {
        headerThrift.writeI32Field(1, numRows);
        headerThrift.writeI32Field(2, ENC_PLAIN);
        headerThrift.writeI32Field(3, ENC_RLE);
        headerThrift.writeI32Field(4, ENC_RLE);
      });
      headerThrift.endStruct();
      const headerBytes = headerBuf.toUint8Array();

      const offset = out.length;
      out.writeBytes(headerBytes);
      out.writeBytes(defBytes);
      out.writeBytes(valBytes);
      const totalSize = out.length - offset;

      chunks.push({
        name: names[at],
        parquetType: specs[at].parquetType,
        offset,
        totalSize,
        numValues: numRows,
      });
    }
  }

  const footerStart = out.length;
  const ft = new CompactThriftWriter(out);
  ft.beginStruct();
  // 1: version
  ft.writeI32Field(1, 1);
  // 2: schema
  ft.writeListHeader(2, CT_STRUCT, 1 + result.columns.length);
  ft.beginStruct();
  ft.writeStringField(4, "schema");
  ft.writeI32Field(5, result.columns.length);
  ft.endStruct();
  for (let at = 0; at < result.columns.length; at += 1) {
    const spec = specs[at];
    ft.beginStruct();
    ft.writeI32Field(1, spec.parquetType);
    ft.writeI32Field(3, REP_OPTIONAL);
    ft.writeStringField(4, names[at]);
    if (spec.parquetType === TYPE_BYTE_ARRAY && spec.utf8) {
      ft.writeI32Field(6, CONVERTED_UTF8);
    }
    ft.endStruct();
  }
  // 3: num_rows
  ft.writeI64Field(3, BigInt(numRows));
  // 4: row_groups
  if (chunks.length === 0) {
    ft.writeListHeader(4, CT_STRUCT, 0);
  } else {
    const totalBytes = chunks.reduce((sum, c) => sum + c.totalSize, 0);
    ft.writeListHeader(4, CT_STRUCT, 1);
    ft.beginStruct();
    ft.writeListHeader(1, CT_STRUCT, chunks.length);
    for (const chunk of chunks) {
      ft.beginStruct();
      ft.writeI64Field(2, BigInt(chunk.offset));
      ft.writeStructField(3, () => {
        ft.writeI32Field(1, chunk.parquetType);
        ft.writeListHeader(2, CT_I32, 2);
        out.writeZigZag32(ENC_PLAIN);
        out.writeZigZag32(ENC_RLE);
        ft.writeListHeader(3, CT_BINARY, 1);
        const pathBytes = encoder.encode(chunk.name);
        out.writeVarint32(pathBytes.length);
        out.writeBytes(pathBytes);
        ft.writeI32Field(4, CODEC_UNCOMPRESSED);
        ft.writeI64Field(5, BigInt(chunk.numValues));
        ft.writeI64Field(6, BigInt(chunk.totalSize));
        ft.writeI64Field(7, BigInt(chunk.totalSize));
        ft.writeI64Field(9, BigInt(chunk.offset));
      });
      ft.endStruct();
    }
    ft.writeI64Field(2, BigInt(totalBytes));
    ft.writeI64Field(3, BigInt(numRows));
    ft.endStruct();
  }
  // 6: created_by
  ft.writeStringField(6, "deruiter.dev clinical-platform");
  ft.endStruct();

  const footerLength = out.length - footerStart;
  out.writeInt32LE(footerLength);
  out.writeBytes(MAGIC);
  return out.toUint8Array();
}
