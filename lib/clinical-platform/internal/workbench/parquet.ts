/**
 * Self-contained Apache Parquet (`PAR1`) reader and writer for the SQL
 * notebook. Exporting query results and ingesting uploaded `.parquet` files
 * run in pure TypeScript without downloading external WebAssembly extensions
 * or opening DuckDB's file access.
 */
import type {
  WorkbenchDatasetColumn,
  WorkbenchDatasetColumnType,
  WorkbenchResult,
  WorkbenchResultColumn,
} from "../../types";

const MAGIC = new Uint8Array([0x50, 0x41, 0x52, 0x31]); // "PAR1"
const encoder = new TextEncoder();
const decoder = new TextDecoder("utf-8", { fatal: false });

// Parquet Thrift enums (parquet.thrift)
const TYPE_BOOLEAN = 0;
const TYPE_INT32 = 1;
const TYPE_INT64 = 2;
const TYPE_INT96 = 3;
const TYPE_FLOAT = 4;
const TYPE_DOUBLE = 5;
const TYPE_BYTE_ARRAY = 6;
const TYPE_FIXED_LEN_BYTE_ARRAY = 7;

const CONVERTED_UTF8 = 0;
const CONVERTED_DECIMAL = 5;
const CONVERTED_DATE = 6;
const CONVERTED_TIMESTAMP_MILLIS = 9;
const CONVERTED_TIMESTAMP_MICROS = 10;
const CONVERTED_UINT_8 = 11;
const CONVERTED_UINT_16 = 12;
const CONVERTED_UINT_32 = 13;
const CONVERTED_UINT_64 = 14;

const REP_REQUIRED = 0;
const REP_OPTIONAL = 1;

const ENC_PLAIN = 0;
const ENC_PLAIN_DICTIONARY = 2;
const ENC_RLE = 3;
const ENC_RLE_DICTIONARY = 8;

const CODEC_UNCOMPRESSED = 0;
const CODEC_SNAPPY = 1;

const PAGE_DATA = 0;
const PAGE_DICTIONARY = 2;
const PAGE_DATA_V2 = 3;

// TCompactProtocol wire types
const CT_STOP = 0;
const CT_BOOL_TRUE = 1;
const CT_BOOL_FALSE = 2;
const CT_BYTE = 3;
const CT_I16 = 4;
const CT_I32 = 5;
const CT_I64 = 6;
const CT_DOUBLE = 7;
const CT_BINARY = 8;
const CT_LIST = 9;
const CT_SET = 10;
const CT_MAP = 11;
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

// ============================================================================
// Apache Parquet Reader (Compact Thrift + Snappy + Dictionary / RLE / Plain)
// ============================================================================

class CompactThriftReader {
  private readonly stack: number[] = [];
  private lastFieldId = 0;

  constructor(
    readonly bytes: Uint8Array,
    public pos = 0
  ) {}

  private ensure(n: number): void {
    if (this.pos + n > this.bytes.length) {
      throw new Error(
        "The Parquet file ended unexpectedly while reading metadata."
      );
    }
  }

  readByte(): number {
    this.ensure(1);
    return this.bytes[this.pos++];
  }

  readVarint32(): number {
    let result = 0;
    let shift = 0;
    for (let i = 0; i < 5; i += 1) {
      const b = this.readByte();
      result |= (b & 0x7f) << shift;
      if ((b & 0x80) === 0) return result >>> 0;
      shift += 7;
    }
    throw new Error("Malformed varint32 in Parquet metadata.");
  }

  readVarint64(): bigint {
    let result = BigInt(0);
    let shift = BigInt(0);
    const b7 = BigInt(7);
    for (let i = 0; i < 10; i += 1) {
      const b = this.readByte();
      result |= BigInt(b & 0x7f) << shift;
      if ((b & 0x80) === 0) return result;
      shift += b7;
    }
    throw new Error("Malformed varint64 in Parquet metadata.");
  }

  readZigZag32(): number {
    const u = this.readVarint32();
    return (u >>> 1) ^ -(u & 1);
  }

  readZigZag64(): bigint {
    const u = this.readVarint64();
    const one = BigInt(1);
    return (u >> one) ^ -(u & one);
  }

  readBinary(): Uint8Array {
    const len = this.readVarint32();
    this.ensure(len);
    const slice = this.bytes.subarray(this.pos, this.pos + len);
    this.pos += len;
    return slice;
  }

  readString(): string {
    return decoder.decode(this.readBinary());
  }

  beginStruct(): void {
    this.stack.push(this.lastFieldId);
    this.lastFieldId = 0;
  }

  endStruct(): void {
    this.lastFieldId = this.stack.pop() ?? 0;
  }

  nextField(): { fieldId: number; type: number } | null {
    const header = this.readByte();
    if (header === CT_STOP) return null;
    const delta = (header & 0xf0) >>> 4;
    const type = header & 0x0f;
    const fieldId =
      delta === 0 ? this.readZigZag32() : this.lastFieldId + delta;
    this.lastFieldId = fieldId;
    return { fieldId, type };
  }

  readListHeader(): { elemType: number; size: number } {
    const b = this.readByte();
    const elemType = b & 0x0f;
    const high = (b & 0xf0) >>> 4;
    const size = high === 15 ? this.readVarint32() : high;
    return { elemType, size };
  }

  skip(type: number): void {
    switch (type) {
      case CT_BOOL_TRUE:
      case CT_BOOL_FALSE:
        return;
      case CT_BYTE:
        this.readByte();
        return;
      case CT_I16:
      case CT_I32:
        this.readVarint32();
        return;
      case CT_I64:
        this.readVarint64();
        return;
      case CT_DOUBLE:
        this.ensure(8);
        this.pos += 8;
        return;
      case CT_BINARY: {
        const len = this.readVarint32();
        this.ensure(len);
        this.pos += len;
        return;
      }
      case CT_LIST:
      case CT_SET: {
        const { elemType, size } = this.readListHeader();
        for (let i = 0; i < size; i += 1) this.skip(elemType);
        return;
      }
      case CT_MAP: {
        const size = this.readVarint32();
        if (size === 0) return;
        const kv = this.readByte();
        const keyType = (kv & 0xf0) >>> 4;
        const valType = kv & 0x0f;
        for (let i = 0; i < size; i += 1) {
          this.skip(keyType);
          this.skip(valType);
        }
        return;
      }
      case CT_STRUCT: {
        this.beginStruct();
        for (;;) {
          const field = this.nextField();
          if (field === null) break;
          this.skip(field.type);
        }
        this.endStruct();
        return;
      }
      default:
        throw new Error(
          `Unsupported Thrift wire type ${type} in Parquet file.`
        );
    }
  }
}

/** Decompresses a raw Snappy block as used in Apache Parquet pages. */
function snappyUncompress(input: Uint8Array): Uint8Array {
  let src = 0;
  let uncompressedLength = 0;
  let shift = 0;
  for (;;) {
    if (src >= input.length) {
      throw new Error("Truncated Snappy header in Parquet page.");
    }
    const b = input[src++];
    uncompressedLength |= (b & 0x7f) << shift;
    if ((b & 0x80) === 0) break;
    shift += 7;
    if (shift > 28) throw new Error("Invalid Snappy length in Parquet page.");
  }
  const out = new Uint8Array(uncompressedLength >>> 0);
  let dst = 0;

  while (src < input.length) {
    const tag = input[src++];
    const tagType = tag & 0x03;
    if (tagType === 0) {
      let lenMinus1 = tag >>> 2;
      if (lenMinus1 >= 60) {
        const extraBytes = lenMinus1 - 59;
        if (src + extraBytes > input.length) {
          throw new Error("Truncated Snappy literal in Parquet page.");
        }
        lenMinus1 = 0;
        for (let i = 0; i < extraBytes; i += 1) {
          lenMinus1 |= input[src++] << (i * 8);
        }
      }
      const len = (lenMinus1 >>> 0) + 1;
      if (src + len > input.length || dst + len > out.length) {
        throw new Error("Snappy literal exceeds Parquet page buffer.");
      }
      out.set(input.subarray(src, src + len), dst);
      src += len;
      dst += len;
    } else {
      let len = 0;
      let offset = 0;
      if (tagType === 1) {
        if (src >= input.length) throw new Error("Truncated Snappy copy-1.");
        len = ((tag >>> 2) & 0x07) + 4;
        offset = ((tag & 0xe0) << 3) | input[src++];
      } else if (tagType === 2) {
        if (src + 2 > input.length) throw new Error("Truncated Snappy copy-2.");
        len = (tag >>> 2) + 1;
        offset = input[src] | (input[src + 1] << 8);
        src += 2;
      } else {
        if (src + 4 > input.length) throw new Error("Truncated Snappy copy-4.");
        len = (tag >>> 2) + 1;
        offset =
          (input[src] |
            (input[src + 1] << 8) |
            (input[src + 2] << 16) |
            (input[src + 3] << 24)) >>>
          0;
        src += 4;
      }
      if (offset === 0 || offset > dst || dst + len > out.length) {
        throw new Error("Invalid Snappy copy offset in Parquet page.");
      }
      let copySrc = dst - offset;
      for (let i = 0; i < len; i += 1) {
        out[dst++] = out[copySrc++];
      }
    }
  }
  if (dst !== out.length) {
    throw new Error("Snappy page uncompressed length mismatch.");
  }
  return out;
}

type LogicalAnnotation =
  | { readonly kind: "string" }
  | { readonly kind: "date" }
  | { readonly kind: "timestamp"; readonly unit: "millis" | "micros" | "nanos" }
  | {
      readonly kind: "decimal";
      readonly scale: number;
      readonly precision: number;
    }
  | { readonly kind: "uint"; readonly bitWidth: number }
  | { readonly kind: "none" };

interface ParquetSchemaElement {
  readonly type: number | null;
  readonly typeLength: number;
  readonly repetitionType: number | null;
  readonly name: string;
  readonly numChildren: number;
  readonly convertedType: number | null;
  readonly scale: number;
  readonly precision: number;
  readonly logical: LogicalAnnotation;
}

interface ParquetColumnMeta {
  readonly type: number;
  readonly pathInSchema: readonly string[];
  readonly codec: number;
  readonly numValues: number;
  readonly dataPageOffset: number;
  readonly dictionaryPageOffset: number | null;
}

interface ParquetRowGroup {
  readonly numRows: number;
  readonly columns: readonly ParquetColumnMeta[];
}

interface ParquetPageHeader {
  readonly type: number;
  readonly uncompressedSize: number;
  readonly compressedSize: number;
  readonly numValues: number;
  readonly numNulls: number;
  readonly encoding: number;
  readonly defLevelEncoding: number;
  readonly defLevelsByteLength: number;
  readonly repLevelsByteLength: number;
  readonly isCompressed: boolean;
}

function readLogicalType(reader: CompactThriftReader): LogicalAnnotation {
  let result: LogicalAnnotation = { kind: "none" };
  reader.beginStruct();
  for (;;) {
    const f = reader.nextField();
    if (f === null) break;
    if (f.fieldId === 1 && f.type === CT_STRUCT) {
      reader.skip(f.type);
      result = { kind: "string" };
    } else if (f.fieldId === 5 && f.type === CT_STRUCT) {
      let scale = 0;
      let precision = 0;
      reader.beginStruct();
      for (;;) {
        const df = reader.nextField();
        if (df === null) break;
        if (df.fieldId === 1 && df.type === CT_I32)
          scale = reader.readZigZag32();
        else if (df.fieldId === 2 && df.type === CT_I32)
          precision = reader.readZigZag32();
        else reader.skip(df.type);
      }
      reader.endStruct();
      result = { kind: "decimal", scale, precision };
    } else if (f.fieldId === 6 && f.type === CT_STRUCT) {
      reader.skip(f.type);
      result = { kind: "date" };
    } else if (f.fieldId === 8 && f.type === CT_STRUCT) {
      let unit: "millis" | "micros" | "nanos" = "micros";
      reader.beginStruct();
      for (;;) {
        const tf = reader.nextField();
        if (tf === null) break;
        if (tf.fieldId === 2 && tf.type === CT_STRUCT) {
          reader.beginStruct();
          for (;;) {
            const uf = reader.nextField();
            if (uf === null) break;
            if (uf.fieldId === 1) unit = "millis";
            else if (uf.fieldId === 2) unit = "micros";
            else if (uf.fieldId === 3) unit = "nanos";
            reader.skip(uf.type);
          }
          reader.endStruct();
        } else {
          reader.skip(tf.type);
        }
      }
      reader.endStruct();
      result = { kind: "timestamp", unit };
    } else if (f.fieldId === 10 && f.type === CT_STRUCT) {
      let bitWidth = 32;
      let isSigned = true;
      reader.beginStruct();
      for (;;) {
        const intF = reader.nextField();
        if (intF === null) break;
        if (intF.fieldId === 1 && intF.type === CT_BYTE)
          bitWidth = reader.readByte();
        else if (intF.fieldId === 2) isSigned = intF.type === CT_BOOL_TRUE;
        else reader.skip(intF.type);
      }
      reader.endStruct();
      if (!isSigned) result = { kind: "uint", bitWidth };
    } else {
      reader.skip(f.type);
    }
  }
  reader.endStruct();
  return result;
}

function readSchemaElement(reader: CompactThriftReader): ParquetSchemaElement {
  let type: number | null = null;
  let typeLength = 0;
  let repetitionType: number | null = null;
  let name = "";
  let numChildren = 0;
  let convertedType: number | null = null;
  let scale = 0;
  let precision = 0;
  let logical: LogicalAnnotation = { kind: "none" };

  reader.beginStruct();
  for (;;) {
    const f = reader.nextField();
    if (f === null) break;
    switch (f.fieldId) {
      case 1:
        type = reader.readZigZag32();
        break;
      case 2:
        typeLength = reader.readZigZag32();
        break;
      case 3:
        repetitionType = reader.readZigZag32();
        break;
      case 4:
        name = reader.readString();
        break;
      case 5:
        numChildren = reader.readZigZag32();
        break;
      case 6:
        convertedType = reader.readZigZag32();
        break;
      case 7:
        scale = reader.readZigZag32();
        break;
      case 8:
        precision = reader.readZigZag32();
        break;
      case 10:
        if (f.type === CT_STRUCT) logical = readLogicalType(reader);
        else reader.skip(f.type);
        break;
      default:
        reader.skip(f.type);
    }
  }
  reader.endStruct();

  if (logical.kind === "none" && convertedType !== null) {
    if (convertedType === CONVERTED_UTF8) logical = { kind: "string" };
    else if (convertedType === CONVERTED_DATE) logical = { kind: "date" };
    else if (convertedType === CONVERTED_DECIMAL)
      logical = { kind: "decimal", scale, precision };
    else if (convertedType === CONVERTED_TIMESTAMP_MILLIS)
      logical = { kind: "timestamp", unit: "millis" };
    else if (convertedType === CONVERTED_TIMESTAMP_MICROS)
      logical = { kind: "timestamp", unit: "micros" };
    else if (convertedType === CONVERTED_UINT_8)
      logical = { kind: "uint", bitWidth: 8 };
    else if (convertedType === CONVERTED_UINT_16)
      logical = { kind: "uint", bitWidth: 16 };
    else if (convertedType === CONVERTED_UINT_32)
      logical = { kind: "uint", bitWidth: 32 };
    else if (convertedType === CONVERTED_UINT_64)
      logical = { kind: "uint", bitWidth: 64 };
  }

  return {
    type,
    typeLength,
    repetitionType,
    name,
    numChildren,
    convertedType,
    scale,
    precision,
    logical,
  };
}

function readColumnMetaData(reader: CompactThriftReader): ParquetColumnMeta {
  let type = TYPE_BYTE_ARRAY;
  const pathInSchema: string[] = [];
  let codec = CODEC_UNCOMPRESSED;
  let numValues = 0;
  let dataPageOffset = 0;
  let dictionaryPageOffset: number | null = null;

  reader.beginStruct();
  for (;;) {
    const f = reader.nextField();
    if (f === null) break;
    switch (f.fieldId) {
      case 1:
        type = reader.readZigZag32();
        break;
      case 3: {
        const list = reader.readListHeader();
        for (let i = 0; i < list.size; i += 1) {
          pathInSchema.push(reader.readString());
        }
        break;
      }
      case 4:
        codec = reader.readZigZag32();
        break;
      case 5:
        numValues = Number(reader.readZigZag64());
        break;
      case 9:
        dataPageOffset = Number(reader.readZigZag64());
        break;
      case 11:
        dictionaryPageOffset = Number(reader.readZigZag64());
        break;
      default:
        reader.skip(f.type);
    }
  }
  reader.endStruct();

  return {
    type,
    pathInSchema,
    codec,
    numValues,
    dataPageOffset,
    dictionaryPageOffset,
  };
}

function readFileMetaData(bytes: Uint8Array): {
  schema: ParquetSchemaElement[];
  numRows: number;
  rowGroups: ParquetRowGroup[];
} {
  const reader = new CompactThriftReader(bytes, 0);
  const schema: ParquetSchemaElement[] = [];
  let numRows = 0;
  const rowGroups: ParquetRowGroup[] = [];

  reader.beginStruct();
  for (;;) {
    const f = reader.nextField();
    if (f === null) break;
    switch (f.fieldId) {
      case 2: {
        const list = reader.readListHeader();
        for (let i = 0; i < list.size; i += 1) {
          schema.push(readSchemaElement(reader));
        }
        break;
      }
      case 3:
        numRows = Number(reader.readZigZag64());
        break;
      case 4: {
        const list = reader.readListHeader();
        for (let i = 0; i < list.size; i += 1) {
          let rgRows = 0;
          const cols: ParquetColumnMeta[] = [];
          reader.beginStruct();
          for (;;) {
            const rf = reader.nextField();
            if (rf === null) break;
            if (rf.fieldId === 1) {
              const cl = reader.readListHeader();
              for (let c = 0; c < cl.size; c += 1) {
                let meta: ParquetColumnMeta | null = null;
                reader.beginStruct();
                for (;;) {
                  const cf = reader.nextField();
                  if (cf === null) break;
                  if (cf.fieldId === 3 && cf.type === CT_STRUCT) {
                    meta = readColumnMetaData(reader);
                  } else {
                    reader.skip(cf.type);
                  }
                }
                reader.endStruct();
                if (meta) cols.push(meta);
              }
            } else if (rf.fieldId === 3) {
              rgRows = Number(reader.readZigZag64());
            } else {
              reader.skip(rf.type);
            }
          }
          reader.endStruct();
          rowGroups.push({ numRows: rgRows, columns: cols });
        }
        break;
      }
      default:
        reader.skip(f.type);
    }
  }
  reader.endStruct();
  return { schema, numRows, rowGroups };
}

function readPageHeader(
  bytes: Uint8Array,
  offset: number
): { header: ParquetPageHeader; nextOffset: number } {
  const reader = new CompactThriftReader(bytes, offset);
  let type = PAGE_DATA;
  let uncompressedSize = 0;
  let compressedSize = 0;
  let numValues = 0;
  let numNulls = 0;
  let encoding = ENC_PLAIN;
  let defLevelEncoding = ENC_RLE;
  let defLevelsByteLength = 0;
  let repLevelsByteLength = 0;
  let isCompressed = true;

  reader.beginStruct();
  for (;;) {
    const f = reader.nextField();
    if (f === null) break;
    switch (f.fieldId) {
      case 1:
        type = reader.readZigZag32();
        break;
      case 2:
        uncompressedSize = reader.readZigZag32();
        break;
      case 3:
        compressedSize = reader.readZigZag32();
        break;
      case 5: {
        reader.beginStruct();
        for (;;) {
          const df = reader.nextField();
          if (df === null) break;
          if (df.fieldId === 1) numValues = reader.readZigZag32();
          else if (df.fieldId === 2) encoding = reader.readZigZag32();
          else if (df.fieldId === 3) defLevelEncoding = reader.readZigZag32();
          else reader.skip(df.type);
        }
        reader.endStruct();
        break;
      }
      case 7: {
        reader.beginStruct();
        for (;;) {
          const dicf = reader.nextField();
          if (dicf === null) break;
          if (dicf.fieldId === 1) numValues = reader.readZigZag32();
          else if (dicf.fieldId === 2) encoding = reader.readZigZag32();
          else reader.skip(dicf.type);
        }
        reader.endStruct();
        break;
      }
      case 8: {
        reader.beginStruct();
        for (;;) {
          const v2f = reader.nextField();
          if (v2f === null) break;
          if (v2f.fieldId === 1) numValues = reader.readZigZag32();
          else if (v2f.fieldId === 2) numNulls = reader.readZigZag32();
          else if (v2f.fieldId === 4) encoding = reader.readZigZag32();
          else if (v2f.fieldId === 5)
            defLevelsByteLength = reader.readZigZag32();
          else if (v2f.fieldId === 6)
            repLevelsByteLength = reader.readZigZag32();
          else if (v2f.fieldId === 7) isCompressed = v2f.type === CT_BOOL_TRUE;
          else reader.skip(v2f.type);
        }
        reader.endStruct();
        break;
      }
      default:
        reader.skip(f.type);
    }
  }
  reader.endStruct();

  return {
    header: {
      type,
      uncompressedSize,
      compressedSize,
      numValues,
      numNulls,
      encoding,
      defLevelEncoding,
      defLevelsByteLength,
      repLevelsByteLength,
      isCompressed,
    },
    nextOffset: reader.pos,
  };
}

/** Decodes `count` integers from a Parquet RLE / bit-packed hybrid buffer. */
function decodeRleBitPacked(
  buf: Uint8Array,
  start: number,
  bitWidth: number,
  count: number
): { values: number[]; nextPos: number } {
  if (bitWidth === 0) {
    return { values: new Array<number>(count).fill(0), nextPos: start };
  }
  const values: number[] = [];
  let pos = start;
  const byteWidth = Math.ceil(bitWidth / 8);
  const mask = bitWidth === 32 ? 0xffffffff : (1 << bitWidth) - 1;

  while (values.length < count) {
    if (pos >= buf.length) {
      throw new Error("Truncated RLE/bit-packed stream in Parquet page.");
    }
    let header = 0;
    let shift = 0;
    for (;;) {
      if (pos >= buf.length) {
        throw new Error("Truncated RLE run header in Parquet page.");
      }
      const b = buf[pos++];
      header |= (b & 0x7f) << shift;
      if ((b & 0x80) === 0) break;
      shift += 7;
    }
    if ((header & 1) === 0) {
      const runLen = header >>> 1;
      let val = 0;
      for (let i = 0; i < byteWidth; i += 1) {
        val |= (buf[pos++] ?? 0) << (i * 8);
      }
      const needed = Math.min(runLen, count - values.length);
      for (let i = 0; i < needed; i += 1) values.push(val >>> 0);
    } else {
      const groups = header >>> 1;
      const totalVals = groups * 8;
      const totalBytes = groups * bitWidth;
      if (pos + totalBytes > buf.length) {
        throw new Error("Truncated bit-packed run in Parquet page.");
      }
      let bitBuf = BigInt(0);
      let bitsInBuf = 0;
      let byteCursor = pos;
      const one = BigInt(1);
      const bigMask = (one << BigInt(bitWidth)) - one;
      for (let i = 0; i < totalVals; i += 1) {
        while (bitsInBuf < bitWidth) {
          bitBuf |= BigInt(buf[byteCursor++]) << BigInt(bitsInBuf);
          bitsInBuf += 8;
        }
        const v = Number(bitBuf & bigMask) & mask;
        bitBuf >>= BigInt(bitWidth);
        bitsInBuf -= bitWidth;
        if (values.length < count) values.push(v >>> 0);
      }
      pos += totalBytes;
    }
  }
  return { values, nextPos: pos };
}

function formatDecimalBigInt(unscaled: bigint, scale: number): string {
  if (scale <= 0) return unscaled.toString();
  const neg = unscaled < BigInt(0);
  const digits = (neg ? -unscaled : unscaled)
    .toString()
    .padStart(scale + 1, "0");
  const text = `${digits.slice(0, -scale)}.${digits.slice(-scale)}`;
  return neg ? `-${text}` : text;
}

function formatDateDays(days: number): string {
  return new Date(days * 86_400_000).toISOString().slice(0, 10);
}

function formatTimestampEpoch(
  raw: bigint,
  unit: "millis" | "micros" | "nanos"
): string {
  const ms =
    unit === "millis"
      ? Number(raw)
      : unit === "micros"
        ? Number(raw / BigInt(1000))
        : Number(raw / BigInt(1_000_000));
  return new Date(ms).toISOString();
}

function decodePlainValues(
  buf: Uint8Array,
  start: number,
  count: number,
  elem: ParquetSchemaElement
): { values: string[]; nextPos: number } {
  const values: string[] = [];
  let pos = start;
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);

  switch (elem.type) {
    case TYPE_BOOLEAN: {
      const byteLen = Math.ceil(count / 8);
      if (pos + byteLen > buf.length) {
        throw new Error("Truncated BOOLEAN page in Parquet file.");
      }
      for (let i = 0; i < count; i += 1) {
        const bit = (buf[pos + (i >> 3)] >> (i & 7)) & 1;
        values.push(bit === 1 ? "true" : "false");
      }
      pos += byteLen;
      break;
    }
    case TYPE_INT32: {
      if (pos + count * 4 > buf.length) {
        throw new Error("Truncated INT32 page in Parquet file.");
      }
      for (let i = 0; i < count; i += 1) {
        if (elem.logical.kind === "uint") {
          values.push(String(view.getUint32(pos, true)));
        } else {
          const v = view.getInt32(pos, true);
          if (elem.logical.kind === "date") values.push(formatDateDays(v));
          else if (elem.logical.kind === "decimal")
            values.push(formatDecimalBigInt(BigInt(v), elem.logical.scale));
          else values.push(String(v));
        }
        pos += 4;
      }
      break;
    }
    case TYPE_INT64: {
      if (pos + count * 8 > buf.length) {
        throw new Error("Truncated INT64 page in Parquet file.");
      }
      for (let i = 0; i < count; i += 1) {
        if (elem.logical.kind === "uint" && elem.logical.bitWidth === 64) {
          values.push(view.getBigUint64(pos, true).toString());
        } else {
          const v = view.getBigInt64(pos, true);
          if (elem.logical.kind === "timestamp")
            values.push(formatTimestampEpoch(v, elem.logical.unit));
          else if (elem.logical.kind === "decimal")
            values.push(formatDecimalBigInt(v, elem.logical.scale));
          else values.push(v.toString());
        }
        pos += 8;
      }
      break;
    }
    case TYPE_INT96: {
      if (pos + count * 12 > buf.length) {
        throw new Error("Truncated INT96 page in Parquet file.");
      }
      for (let i = 0; i < count; i += 1) {
        const nanosOfDay = view.getBigUint64(pos, true);
        const julianDay = view.getInt32(pos + 8, true);
        const epochDays = BigInt(julianDay - 2440588);
        const epochMs = Number(
          epochDays * BigInt(86_400_000) + nanosOfDay / BigInt(1_000_000)
        );
        values.push(new Date(epochMs).toISOString());
        pos += 12;
      }
      break;
    }
    case TYPE_FLOAT: {
      if (pos + count * 4 > buf.length) {
        throw new Error("Truncated FLOAT page in Parquet file.");
      }
      for (let i = 0; i < count; i += 1) {
        values.push(String(view.getFloat32(pos, true)));
        pos += 4;
      }
      break;
    }
    case TYPE_DOUBLE: {
      if (pos + count * 8 > buf.length) {
        throw new Error("Truncated DOUBLE page in Parquet file.");
      }
      for (let i = 0; i < count; i += 1) {
        values.push(String(view.getFloat64(pos, true)));
        pos += 8;
      }
      break;
    }
    case TYPE_BYTE_ARRAY: {
      for (let i = 0; i < count; i += 1) {
        if (pos + 4 > buf.length) {
          throw new Error("Truncated BYTE_ARRAY length in Parquet file.");
        }
        const len = view.getInt32(pos, true);
        pos += 4;
        if (len < 0 || pos + len > buf.length) {
          throw new Error("Invalid BYTE_ARRAY length in Parquet file.");
        }
        const slice = buf.subarray(pos, pos + len);
        pos += len;
        if (elem.logical.kind === "decimal") {
          let unscaled = BigInt(0);
          const b8 = BigInt(8);
          const negative = slice.length > 0 && (slice[0] & 0x80) !== 0;
          for (const b of slice) {
            unscaled = (unscaled << b8) | BigInt(negative ? b ^ 0xff : b);
          }
          if (negative) unscaled = -(unscaled + BigInt(1));
          values.push(formatDecimalBigInt(unscaled, elem.logical.scale));
        } else {
          values.push(decoder.decode(slice));
        }
      }
      break;
    }
    case TYPE_FIXED_LEN_BYTE_ARRAY: {
      const len = elem.typeLength;
      if (pos + count * len > buf.length) {
        throw new Error("Truncated FIXED_LEN_BYTE_ARRAY page in Parquet file.");
      }
      for (let i = 0; i < count; i += 1) {
        const slice = buf.subarray(pos, pos + len);
        pos += len;
        if (elem.logical.kind === "decimal") {
          let unscaled = BigInt(0);
          const b8 = BigInt(8);
          const negative = slice.length > 0 && (slice[0] & 0x80) !== 0;
          for (const b of slice) {
            unscaled = (unscaled << b8) | BigInt(negative ? b ^ 0xff : b);
          }
          if (negative) unscaled = -(unscaled + BigInt(1));
          values.push(formatDecimalBigInt(unscaled, elem.logical.scale));
        } else {
          values.push(decoder.decode(slice));
        }
      }
      break;
    }
    default:
      throw new Error(`Unsupported physical Parquet type ${elem.type}.`);
  }

  return { values, nextPos: pos };
}

function uncompressPage(
  raw: Uint8Array,
  codec: number,
  expectedLength: number
): Uint8Array {
  if (codec === CODEC_UNCOMPRESSED) return raw;
  if (codec === CODEC_SNAPPY) {
    const out = snappyUncompress(raw);
    if (expectedLength > 0 && out.length !== expectedLength) {
      throw new Error("Parquet page uncompressed byte length mismatch.");
    }
    return out;
  }
  throw new Error(
    `Unsupported Parquet compression codec (${codec}); export the Parquet file uncompressed or with Snappy compression.`
  );
}

function sqlColumnType(elem: ParquetSchemaElement): WorkbenchDatasetColumnType {
  if (elem.logical.kind === "date") return "DATE";
  if (elem.logical.kind === "timestamp" || elem.type === TYPE_INT96)
    return "TIMESTAMP";
  if (elem.logical.kind === "decimal") return "DOUBLE";
  switch (elem.type) {
    case TYPE_BOOLEAN:
      return "BOOLEAN";
    case TYPE_INT32:
    case TYPE_INT64:
      return "BIGINT";
    case TYPE_FLOAT:
    case TYPE_DOUBLE:
      return "DOUBLE";
    default:
      return "VARCHAR";
  }
}

function readColumnChunk(
  fileBytes: Uint8Array,
  meta: ParquetColumnMeta,
  elem: ParquetSchemaElement
): (string | null)[] {
  const values: (string | null)[] = [];
  let dictionary: string[] | null = null;
  let offset =
    meta.dictionaryPageOffset !== null && meta.dictionaryPageOffset > 0
      ? meta.dictionaryPageOffset
      : meta.dataPageOffset;

  const isOptional = elem.repetitionType !== REP_REQUIRED;

  while (values.length < meta.numValues) {
    const { header, nextOffset } = readPageHeader(fileBytes, offset);
    if (nextOffset + header.compressedSize > fileBytes.length) {
      throw new Error("Parquet page extends past the end of the file.");
    }
    const rawPayload = fileBytes.subarray(
      nextOffset,
      nextOffset + header.compressedSize
    );
    offset = nextOffset + header.compressedSize;

    if (header.type === PAGE_DICTIONARY) {
      const pageBuf = uncompressPage(
        rawPayload,
        meta.codec,
        header.uncompressedSize
      );
      dictionary = decodePlainValues(pageBuf, 0, header.numValues, elem).values;
      continue;
    }

    if (header.type !== PAGE_DATA && header.type !== PAGE_DATA_V2) {
      continue;
    }

    let defLevels: number[] | null = null;
    let dataBuf: Uint8Array;
    let dataPos = 0;

    if (header.type === PAGE_DATA_V2) {
      const levelsBytes =
        header.repLevelsByteLength + header.defLevelsByteLength;
      if (isOptional) {
        if (header.defLevelsByteLength === 0) {
          defLevels = new Array<number>(header.numValues).fill(
            header.numNulls === header.numValues ? 0 : 1
          );
        } else {
          defLevels = decodeRleBitPacked(
            rawPayload,
            header.repLevelsByteLength,
            1,
            header.numValues
          ).values;
        }
      }
      const compressedValues = rawPayload.subarray(levelsBytes);
      dataBuf = header.isCompressed
        ? uncompressPage(
            compressedValues,
            meta.codec,
            header.uncompressedSize - levelsBytes
          )
        : compressedValues;
    } else {
      const pageBuf = uncompressPage(
        rawPayload,
        meta.codec,
        header.uncompressedSize
      );
      let cursor = 0;
      if (isOptional) {
        if (cursor + 4 > pageBuf.length) {
          throw new Error("Truncated definition levels in Parquet page.");
        }
        const byteLen = new DataView(
          pageBuf.buffer,
          pageBuf.byteOffset + cursor,
          4
        ).getInt32(0, true);
        cursor += 4;
        defLevels = decodeRleBitPacked(
          pageBuf,
          cursor,
          1,
          header.numValues
        ).values;
        cursor += byteLen;
      }
      dataBuf = pageBuf;
      dataPos = cursor;
    }

    const nonNullCount = defLevels
      ? defLevels.reduce((acc, d) => acc + (d > 0 ? 1 : 0), 0)
      : header.numValues;

    let decodedNonNull: string[];
    if (
      header.encoding === ENC_PLAIN_DICTIONARY ||
      header.encoding === ENC_RLE_DICTIONARY
    ) {
      if (!dictionary) {
        throw new Error(
          "Parquet data page references a dictionary that was not present."
        );
      }
      if (nonNullCount === 0) {
        decodedNonNull = [];
      } else {
        if (dataPos >= dataBuf.length) {
          throw new Error("Missing dictionary bit-width in Parquet page.");
        }
        const bitWidth = dataBuf[dataPos++];
        const indices = decodeRleBitPacked(
          dataBuf,
          dataPos,
          bitWidth,
          nonNullCount
        ).values;
        decodedNonNull = indices.map((idx) => {
          const entry = dictionary?.[idx];
          if (entry === undefined) {
            throw new Error("Dictionary index out of bounds in Parquet page.");
          }
          return entry;
        });
      }
    } else if (header.encoding === ENC_PLAIN) {
      decodedNonNull = decodePlainValues(
        dataBuf,
        dataPos,
        nonNullCount,
        elem
      ).values;
    } else if (header.encoding === ENC_RLE && elem.type === TYPE_BOOLEAN) {
      if (nonNullCount === 0) {
        decodedNonNull = [];
      } else {
        const byteLen = new DataView(
          dataBuf.buffer,
          dataBuf.byteOffset + dataPos,
          4
        ).getInt32(0, true);
        const bits = decodeRleBitPacked(
          dataBuf.subarray(dataPos + 4, dataPos + 4 + byteLen),
          0,
          1,
          nonNullCount
        ).values;
        decodedNonNull = bits.map((b) => (b === 1 ? "true" : "false"));
      }
    } else {
      throw new Error(
        `Unsupported Parquet value encoding (${header.encoding}) for column "${elem.name}".`
      );
    }

    if (!defLevels) {
      for (const v of decodedNonNull) values.push(v);
    } else {
      let vi = 0;
      for (const d of defLevels) {
        values.push(d > 0 ? (decodedNonNull[vi++] ?? null) : null);
      }
    }
  }

  return values;
}

/**
 * Reads an Apache Parquet (`PAR1`) binary buffer into typed columns and text
 * cells suitable for loading into DuckDB's `uploads` schema.
 */
export function readParquetDataset(bytes: Uint8Array): {
  columns: WorkbenchDatasetColumn[];
  rows: (string | null)[][];
} {
  if (bytes.length < 12) {
    throw new Error("The file is too small to be a valid Parquet file.");
  }
  for (let i = 0; i < 4; i += 1) {
    if (bytes[i] !== MAGIC[i] || bytes[bytes.length - 4 + i] !== MAGIC[i]) {
      throw new Error(
        "The file does not have Apache Parquet PAR1 magic bytes."
      );
    }
  }

  const footerLen = new DataView(
    bytes.buffer,
    bytes.byteOffset + bytes.length - 8,
    4
  ).getInt32(0, true);
  const footerStart = bytes.length - 8 - footerLen;
  if (footerLen <= 0 || footerStart < 4) {
    throw new Error("The Parquet footer length is invalid or corrupted.");
  }

  const meta = readFileMetaData(bytes.subarray(footerStart, bytes.length - 8));
  if (meta.schema.length < 2) {
    throw new Error("The Parquet file contains no columns.");
  }

  const root = meta.schema[0];
  const leaves = meta.schema.slice(1);
  if (
    root.numChildren !== leaves.length ||
    leaves.some((leaf) => leaf.numChildren > 0 || leaf.type === null)
  ) {
    throw new Error(
      "Nested Parquet structs, lists or maps are not supported in flat table uploads; flatten columns before uploading."
    );
  }

  const columns: WorkbenchDatasetColumn[] = leaves.map((leaf) => ({
    name: leaf.name,
    type: sqlColumnType(leaf),
    nullable: leaf.repetitionType !== REP_REQUIRED,
  }));

  const colData: (string | null)[][] = leaves.map(() => []);

  for (const rg of meta.rowGroups) {
    if (rg.columns.length !== leaves.length) {
      throw new Error("Parquet row group column count does not match schema.");
    }
    for (let c = 0; c < leaves.length; c += 1) {
      const chunkVals = readColumnChunk(bytes, rg.columns[c], leaves[c]);
      for (const v of chunkVals) colData[c].push(v);
    }
  }

  const totalRows = colData[0]?.length ?? 0;
  const rows: (string | null)[][] = [];
  for (let r = 0; r < totalRows; r += 1) {
    rows.push(leaves.map((_, c) => colData[c][r] ?? null));
  }

  return { columns, rows };
}
