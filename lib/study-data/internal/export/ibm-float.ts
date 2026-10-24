/**
 * IEEE 754 double to IBM System/360 hexadecimal floating point, the numeric
 * format of SAS XPORT v5 files.
 *
 * An IBM double is a sign bit, a 7-bit excess-64 exponent of 16 and a 56-bit
 * fraction in [1/16, 1). An IEEE double has a 53-bit significand, which fits
 * inside the 56-bit fraction whatever hexadecimal shift normalisation needs,
 * so every finite double inside the IBM exponent range converts exactly.
 */

/** Bytes of the SAS standard missing value `.`. */
export const SAS_MISSING_NUMERIC: readonly number[] = Object.freeze([
  0x2e, 0, 0, 0, 0, 0, 0, 0,
]);

/**
 * Exclusive upper bound on the magnitude, 16^63. The largest IBM double is
 * (1 - 16^-14) * 16^63; every IEEE double below 16^63 fits.
 */
const IBM_LIMIT = 2 ** 252;
/** Smallest normalised magnitude an IBM double can hold, 16^-65. */
const IBM_MIN = 2 ** -260;

/**
 * Encodes one number as an 8-byte big-endian IBM double. `null` encodes the
 * SAS missing value `.`; zero, positive or negative, encodes as eight zero
 * bytes.
 *
 * @param value - A finite number, or `null` for missing.
 * @returns Eight bytes.
 * @throws RangeError when the value is not finite or outside the IBM range
 *   (about 5.4e-79 to 7.2e75 in magnitude).
 */
export function encodeIbmFloat(value: number | null): Uint8Array {
  const out = new Uint8Array(8);
  if (value === null) {
    out.set(SAS_MISSING_NUMERIC);
    return out;
  }
  if (!Number.isFinite(value)) {
    throw new RangeError(`${value} cannot be stored as an IBM double.`);
  }
  if (value === 0) return out;
  const magnitude = Math.abs(value);
  if (magnitude >= IBM_LIMIT || magnitude < IBM_MIN) {
    throw new RangeError(`${value} is outside the IBM double range.`);
  }
  // magnitude = (significand / 2^53) * 2^power, significand in [2^52, 2^53).
  const view = new DataView(new ArrayBuffer(8));
  view.setFloat64(0, magnitude);
  const biased = view.getUint16(0) >> 4;
  const power = biased - 1022;
  const significand = magnitude * 2 ** (53 - power);
  // Choose the hexadecimal exponent so the fraction lands in [1/16, 1).
  const hexExponent = Math.ceil(power / 4);
  const shift = hexExponent * 4 - power;
  let fraction = significand * 2 ** (3 - shift);
  for (let index = 7; index >= 1; index -= 1) {
    const byte = fraction % 256;
    out[index] = byte;
    fraction = (fraction - byte) / 256;
  }
  out[0] = (value < 0 ? 0x80 : 0) | (hexExponent + 64);
  return out;
}
