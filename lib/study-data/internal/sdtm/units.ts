/**
 * Conversions from a collected unit to a test's standard unit, for the
 * results a site may record in conventional rather than SI units. A
 * collected>standard pair not listed here has no conversion, and the
 * standard result stays missing rather than carrying a number in the wrong
 * unit.
 */
const CONVERSIONS: Readonly<
  Record<string, Readonly<Record<string, (value: number) => number>>>
> = {
  // Glucose, molar mass 180.16 g/mol: 1 mmol/L = 18.016 mg/dL.
  GLUC: { "mg/dL>mmol/L": (value) => value / 18.016 },
};

/**
 * A collected result in the test's standard unit.
 *
 * @param testCode - The test short name.
 * @param value - The collected numeric result.
 * @param unit - The collected unit.
 * @param standardUnit - The test's standard unit.
 * @returns The result in the standard unit, rounded to two decimals when
 * converted, or null when the units differ and no conversion is defined.
 */
export function toStandardUnit(
  testCode: string,
  value: number,
  unit: string | null,
  standardUnit: string | null
): number | null {
  if (unit === null || standardUnit === null || unit === standardUnit)
    return value;
  const convert = CONVERSIONS[testCode]?.[`${unit}>${standardUnit}`];
  return convert ? Math.round(convert(value) * 100) / 100 : null;
}
