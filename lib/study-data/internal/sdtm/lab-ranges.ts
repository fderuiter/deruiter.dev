/**
 * The fictional central laboratory's category and reference range for each
 * test, in the test's standard unit. The ranges sit close to common adult
 * ranges and are set so that every result the generator flags NORMAL falls
 * inside them and every result it flags HIGH falls above them.
 */
export interface LabReference {
  /** LBCAT: the laboratory panel the test belongs to. */
  readonly category: "CHEMISTRY" | "HEMATOLOGY";
  readonly low: number;
  readonly high: number;
}

const LAB_REFERENCES: Readonly<Record<string, LabReference>> = {
  ALT: { category: "CHEMISTRY", low: 10, high: 35 },
  AST: { category: "CHEMISTRY", low: 10, high: 34 },
  BILI: { category: "CHEMISTRY", low: 5, high: 14 },
  CREAT: { category: "CHEMISTRY", low: 60, high: 110 },
  GLUC: { category: "CHEMISTRY", low: 3.9, high: 7.8 },
  HGB: { category: "HEMATOLOGY", low: 120, high: 170 },
  WBC: { category: "HEMATOLOGY", low: 4, high: 10 },
  PLAT: { category: "HEMATOLOGY", low: 150, high: 400 },
};

/** The category and standard-unit reference range of a test, if it has one. */
export function labReference(testCode: unknown): LabReference | undefined {
  return typeof testCode === "string" ? LAB_REFERENCES[testCode] : undefined;
}
