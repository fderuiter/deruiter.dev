import {
  Document,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  AlignmentType,
  HeadingLevel,
  BorderStyle,
  Header,
  Footer,
  PageNumber,
  Packer,
  ShadingType,
  ImageRun,
} from "docx";
import { CRFForm, StudyProtocol, CRFField, ExportDocxOptions } from "./types";
import { getStudyBranding } from "./branding-defaults";
import { consultationUrl, sdtmTargetFor } from "./export-annotations";

/**
 * Sanitizes hex color strings for docx (removes leading #).
 */
function cleanHex(color?: string, fallback = "0284C7"): string {
  if (!color) return fallback;
  return color.replace(/^#/, "").toUpperCase();
}

/**
 * Table width in DXA (Twips) matching standard 1-inch margins on Letter paper (8.5" - 2" = 6.5" = 9,360 DXA).
 */
export const TABLE_WIDTH_DXA = 9360;

/**
 * Standard mode section table column widths in DXA (sum = 9,360).
 */
export const STANDARD_COL_WIDTH_1 = 3931; // ~42%
export const STANDARD_COL_WIDTH_2 = 5429; // ~58%

/**
 * Annotated mode section table column widths in DXA (sum = 9,360).
 */
export const ANNOTATED_COL_WIDTH_1 = 2995; // ~32%
export const ANNOTATED_COL_WIDTH_2 = 3744; // 40%
export const ANNOTATED_COL_WIDTH_3 = 2621; // ~28%

/**
 * Table of contents column widths in DXA (sum = 9,360).
 */
export const TOC_COL_WIDTH_1 = 749; // ~8%
export const TOC_COL_WIDTH_2 = 1404; // 15%
export const TOC_COL_WIDTH_3 = 4399; // ~47%
export const TOC_COL_WIDTH_4 = 1404; // 15%
export const TOC_COL_WIDTH_5 = 1404; // 15%

/**
 * SDTM specification appendix column widths in DXA (sum = 9,360).
 */
export const SDTM_COL_WIDTH_1 = 1123; // ~12%
export const SDTM_COL_WIDTH_2 = 1685; // ~18%
export const SDTM_COL_WIDTH_3 = 2808; // 30%
export const SDTM_COL_WIDTH_4 = 1872; // 20%
export const SDTM_COL_WIDTH_5 = 936; // 10%
export const SDTM_COL_WIDTH_6 = 936; // 10%

/**
 * Decodes base64 image data to Uint8Array for docx ImageRun.
 */
function base64ToUint8Array(base64String: string): Uint8Array | null {
  try {
    const clean = base64String.replace(/^data:image\/\w+;base64,/, "");
    if (typeof Buffer !== "undefined") {
      return Buffer.from(clean, "base64");
    }
    const binary = atob(clean);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  } catch {
    return null;
  }
}

/**
 * Formats the response blank/input mock for Word documents.
 */
function renderFieldResponseMock(
  field: CRFField,
  study: StudyProtocol
): Paragraph[] {
  const codelist = study.codelists.find((cl) => cl.id === field.codelistId);

  if (field.dataType === "radio" || field.dataType === "single_select") {
    const opts = field.customOptions ||
      codelist?.options || [
        { code: "1", label: "Option 1", order: 1 },
        { code: "2", label: "Option 2", order: 2 },
      ];

    const runs: TextRun[] = [];
    opts.forEach((o, i) => {
      if (i > 0) runs.push(new TextRun({ text: "    " }));
      runs.push(
        new TextRun({ text: `( ) ${o.label} `, size: 20 }),
        new TextRun({
          text: `[${o.code}]`,
          size: 18,
          color: "64748B",
          bold: true,
        })
      );
    });

    return [
      new Paragraph({ children: runs, spacing: { before: 80, after: 80 } }),
    ];
  }

  if (field.dataType === "multi_select" || field.dataType === "checkbox") {
    const opts = field.customOptions || codelist?.options;
    if (opts && opts.length > 0) {
      const runs: TextRun[] = [];
      opts.forEach((o, i) => {
        if (i > 0) runs.push(new TextRun({ text: "    " }));
        runs.push(
          new TextRun({ text: `[ ] ${o.label} `, size: 20 }),
          new TextRun({
            text: `[${o.code}]`,
            size: 18,
            color: "64748B",
            bold: true,
          })
        );
      });
      return [
        new Paragraph({ children: runs, spacing: { before: 80, after: 80 } }),
      ];
    }

    return [
      new Paragraph({
        children: [new TextRun({ text: "[ ] Yes    [ ] No", size: 20 })],
        spacing: { before: 80, after: 80 },
      }),
    ];
  }

  if (field.dataType === "calculated") {
    return [
      new Paragraph({
        children: [
          new TextRun({
            text: `[Derived Formula: ${field.calculationFormula || "f(x)"}]`,
            italics: true,
            color: "7C3AED",
            size: 20,
          }),
        ],
        spacing: { before: 80, after: 80 },
      }),
    ];
  }

  if (field.dataType === "precision_date") {
    const nullFlavorText = field.allowNullFlavor ? "   [ND] [NA] [UNK]" : "";
    return [
      new Paragraph({
        children: [
          new TextRun({
            text: `[ YYYY - MM - DD ]${field.allowPartial ? " (Partial Allowed)" : ""}${nullFlavorText}`,
            color: "64748B",
            size: 20,
            font: "Courier New",
          }),
        ],
        spacing: { before: 80, after: 80 },
      }),
    ];
  }

  if (field.dataType === "repeating_table") {
    return [
      new Paragraph({
        children: [
          new TextRun({
            text: "[Repeating Log Table - Multiple Records Allowed]",
            italics: true,
            color: "0284C7",
            size: 20,
          }),
        ],
        spacing: { before: 80, after: 80 },
      }),
    ];
  }

  // Text, Number, Date, Time, etc.
  const underlineSpace = "____________________________________";
  const unitText = field.unit ? ` (${field.unit})` : "";
  return [
    new Paragraph({
      children: [
        new TextRun({
          text: `${underlineSpace}${unitText}`,
          color: "94A3B8",
          size: 20,
        }),
      ],
      spacing: { before: 80, after: 80 },
    }),
  ];
}

/**
 * Builds a styled section table with all fields.
 */
function createSectionTable(
  fields: CRFField[],
  study: StudyProtocol,
  isAnnotated: boolean,
  _primaryColor: string,
  accentColor: string,
  domain: string
): Table {
  const cellBorder = {
    top: { style: BorderStyle.SINGLE, size: 1, color: "CBD5E1" },
    bottom: { style: BorderStyle.SINGLE, size: 1, color: "CBD5E1" },
    left: { style: BorderStyle.SINGLE, size: 1, color: "CBD5E1" },
    right: { style: BorderStyle.SINGLE, size: 1, color: "CBD5E1" },
  };

  const rows: TableRow[] = [];

  // Table Column Headers
  if (isAnnotated) {
    rows.push(
      new TableRow({
        tableHeader: true,
        children: [
          new TableCell({
            width: { size: ANNOTATED_COL_WIDTH_1, type: WidthType.DXA },
            shading: { type: ShadingType.CLEAR, fill: "F1F5F9" },
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: "Question / Field Prompt",
                    bold: true,
                    size: 20,
                    color: "0F172A",
                  }),
                ],
              }),
            ],
          }),
          new TableCell({
            width: { size: ANNOTATED_COL_WIDTH_2, type: WidthType.DXA },
            shading: { type: ShadingType.CLEAR, fill: "F1F5F9" },
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: "Clinical Data Response Blank",
                    bold: true,
                    size: 20,
                    color: "0F172A",
                  }),
                ],
              }),
            ],
          }),
          new TableCell({
            width: { size: ANNOTATED_COL_WIDTH_3, type: WidthType.DXA },
            shading: { type: ShadingType.CLEAR, fill: "F1F5F9" },
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: "SDTM / CDASH Annotation",
                    bold: true,
                    size: 20,
                    color: "0F172A",
                  }),
                ],
              }),
            ],
          }),
        ],
      })
    );
  } else {
    rows.push(
      new TableRow({
        tableHeader: true,
        children: [
          new TableCell({
            width: { size: STANDARD_COL_WIDTH_1, type: WidthType.DXA },
            shading: { type: ShadingType.CLEAR, fill: "F1F5F9" },
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: "Question Prompt / Variable",
                    bold: true,
                    size: 20,
                    color: "0F172A",
                  }),
                ],
              }),
            ],
          }),
          new TableCell({
            width: { size: STANDARD_COL_WIDTH_2, type: WidthType.DXA },
            shading: { type: ShadingType.CLEAR, fill: "F1F5F9" },
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: "Clinical Value / Observations",
                    bold: true,
                    size: 20,
                    color: "0F172A",
                  }),
                ],
              }),
            ],
          }),
        ],
      })
    );
  }

  // Field Rows
  fields.forEach((field) => {
    const isRequired = field.required;
    const isDerived = field.dataType === "calculated";
    const sdtmTarget = sdtmTargetFor(field, domain);
    const sdtmOrigin = isDerived ? "Derived" : "CRF";
    const sdtmCore = field.cdashMetadata?.core || (isRequired ? "HR" : "O");

    const labelRuns: TextRun[] = [
      new TextRun({ text: field.label, bold: true, size: 20, color: "0F172A" }),
    ];
    if (isRequired) {
      labelRuns.push(
        new TextRun({ text: " *", bold: true, color: "DC2626", size: 20 })
      );
    }

    const labelParagraphs: Paragraph[] = [
      new Paragraph({ children: labelRuns, spacing: { after: 40 } }),
    ];

    if (field.description) {
      labelParagraphs.push(
        new Paragraph({
          children: [
            new TextRun({
              text: field.description,
              size: 18,
              italics: true,
              color: "64748B",
            }),
          ],
          spacing: { after: 40 },
        })
      );
    }

    labelParagraphs.push(
      new Paragraph({
        children: [
          new TextRun({
            text: `[${field.variableName} • ${field.dataType}]`,
            size: 16,
            color: "94A3B8",
            font: "Courier New",
          }),
        ],
      })
    );

    const responseParagraphs = renderFieldResponseMock(field, study);

    if (isAnnotated) {
      const annotRuns: TextRun[] = [
        new TextRun({
          text: sdtmTarget,
          bold: true,
          size: 20,
          color: isDerived ? "7C3AED" : cleanHex(accentColor, "0284C7"),
          font: "Courier New",
        }),
        new TextRun({
          text: `\n[${sdtmOrigin}] [${sdtmCore}]`,
          size: 18,
          color: "475569",
          bold: true,
        }),
      ];

      if (field.cdashMetadata?.nciConceptId) {
        annotRuns.push(
          new TextRun({
            text: `\nNCI: ${field.cdashMetadata.nciConceptId}`,
            size: 16,
            color: "94A3B8",
          })
        );
      }

      rows.push(
        new TableRow({
          children: [
            new TableCell({
              borders: cellBorder,
              children: labelParagraphs,
              width: { size: ANNOTATED_COL_WIDTH_1, type: WidthType.DXA },
            }),
            new TableCell({
              borders: cellBorder,
              children: responseParagraphs,
              width: { size: ANNOTATED_COL_WIDTH_2, type: WidthType.DXA },
            }),
            new TableCell({
              borders: cellBorder,
              children: [new Paragraph({ children: annotRuns })],
              shading: {
                type: ShadingType.CLEAR,
                fill: isDerived ? "FAF5FF" : "F0F9FF",
              },
              width: { size: ANNOTATED_COL_WIDTH_3, type: WidthType.DXA },
            }),
          ],
        })
      );
    } else {
      rows.push(
        new TableRow({
          children: [
            new TableCell({
              borders: cellBorder,
              children: labelParagraphs,
              width: { size: STANDARD_COL_WIDTH_1, type: WidthType.DXA },
            }),
            new TableCell({
              borders: cellBorder,
              children: responseParagraphs,
              width: { size: STANDARD_COL_WIDTH_2, type: WidthType.DXA },
            }),
          ],
        })
      );
    }
  });

  return new Table({
    width: { size: TABLE_WIDTH_DXA, type: WidthType.DXA },
    rows,
  });
}

/**
 * Creates the Table of Contents table in docx.
 */
function createTableOfContentsTable(forms: CRFForm[]): Table {
  const cellBorder = {
    top: { style: BorderStyle.SINGLE, size: 1, color: "CBD5E1" },
    bottom: { style: BorderStyle.SINGLE, size: 1, color: "CBD5E1" },
    left: { style: BorderStyle.SINGLE, size: 1, color: "CBD5E1" },
    right: { style: BorderStyle.SINGLE, size: 1, color: "CBD5E1" },
  };

  const rows: TableRow[] = [
    new TableRow({
      tableHeader: true,
      children: [
        new TableCell({
          width: { size: TOC_COL_WIDTH_1, type: WidthType.DXA },
          shading: { type: ShadingType.CLEAR, fill: "0F172A" },
          children: [
            new Paragraph({
              children: [
                new TextRun({
                  text: "#",
                  bold: true,
                  color: "FFFFFF",
                  size: 20,
                }),
              ],
            }),
          ],
        }),
        new TableCell({
          width: { size: TOC_COL_WIDTH_2, type: WidthType.DXA },
          shading: { type: ShadingType.CLEAR, fill: "0F172A" },
          children: [
            new Paragraph({
              children: [
                new TextRun({
                  text: "Domain",
                  bold: true,
                  color: "FFFFFF",
                  size: 20,
                }),
              ],
            }),
          ],
        }),
        new TableCell({
          width: { size: TOC_COL_WIDTH_3, type: WidthType.DXA },
          shading: { type: ShadingType.CLEAR, fill: "0F172A" },
          children: [
            new Paragraph({
              children: [
                new TextRun({
                  text: "CRF Form Name",
                  bold: true,
                  color: "FFFFFF",
                  size: 20,
                }),
              ],
            }),
          ],
        }),
        new TableCell({
          width: { size: TOC_COL_WIDTH_4, type: WidthType.DXA },
          shading: { type: ShadingType.CLEAR, fill: "0F172A" },
          children: [
            new Paragraph({
              children: [
                new TextRun({
                  text: "Sections",
                  bold: true,
                  color: "FFFFFF",
                  size: 20,
                }),
              ],
            }),
          ],
        }),
        new TableCell({
          width: { size: TOC_COL_WIDTH_5, type: WidthType.DXA },
          shading: { type: ShadingType.CLEAR, fill: "0F172A" },
          children: [
            new Paragraph({
              children: [
                new TextRun({
                  text: "Fields",
                  bold: true,
                  color: "FFFFFF",
                  size: 20,
                }),
              ],
            }),
          ],
        }),
      ],
    }),
  ];

  forms.forEach((f, idx) => {
    const totalFields = f.sections.flatMap((s) => s.fields).length;
    rows.push(
      new TableRow({
        children: [
          new TableCell({
            borders: cellBorder,
            children: [
              new Paragraph({
                children: [new TextRun({ text: `${idx + 1}`, size: 20 })],
              }),
            ],
          }),
          new TableCell({
            borders: cellBorder,
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: f.domain,
                    bold: true,
                    color: "0284C7",
                    size: 20,
                  }),
                ],
              }),
            ],
          }),
          new TableCell({
            borders: cellBorder,
            children: [
              new Paragraph({
                children: [new TextRun({ text: f.name, size: 20 })],
              }),
            ],
          }),
          new TableCell({
            borders: cellBorder,
            children: [
              new Paragraph({
                children: [
                  new TextRun({ text: `${f.sections.length}`, size: 20 }),
                ],
              }),
            ],
          }),
          new TableCell({
            borders: cellBorder,
            children: [
              new Paragraph({
                children: [new TextRun({ text: `${totalFields}`, size: 20 })],
              }),
            ],
          }),
        ],
      })
    );
  });

  return new Table({
    width: { size: TABLE_WIDTH_DXA, type: WidthType.DXA },
    rows,
  });
}

/**
 * Builds the complete SDTM Appendix specification table.
 */
function createSdtmSpecificationTable(forms: CRFForm[]): Table {
  const cellBorder = {
    top: { style: BorderStyle.SINGLE, size: 1, color: "CBD5E1" },
    bottom: { style: BorderStyle.SINGLE, size: 1, color: "CBD5E1" },
    left: { style: BorderStyle.SINGLE, size: 1, color: "CBD5E1" },
    right: { style: BorderStyle.SINGLE, size: 1, color: "CBD5E1" },
  };

  const rows: TableRow[] = [
    new TableRow({
      tableHeader: true,
      children: [
        new TableCell({
          width: { size: SDTM_COL_WIDTH_1, type: WidthType.DXA },
          shading: { type: ShadingType.CLEAR, fill: "0F172A" },
          children: [
            new Paragraph({
              children: [
                new TextRun({
                  text: "Domain",
                  bold: true,
                  color: "FFFFFF",
                  size: 18,
                }),
              ],
            }),
          ],
        }),
        new TableCell({
          width: { size: SDTM_COL_WIDTH_2, type: WidthType.DXA },
          shading: { type: ShadingType.CLEAR, fill: "0F172A" },
          children: [
            new Paragraph({
              children: [
                new TextRun({
                  text: "Variable",
                  bold: true,
                  color: "FFFFFF",
                  size: 18,
                }),
              ],
            }),
          ],
        }),
        new TableCell({
          width: { size: SDTM_COL_WIDTH_3, type: WidthType.DXA },
          shading: { type: ShadingType.CLEAR, fill: "0F172A" },
          children: [
            new Paragraph({
              children: [
                new TextRun({
                  text: "CDASH Question Label",
                  bold: true,
                  color: "FFFFFF",
                  size: 18,
                }),
              ],
            }),
          ],
        }),
        new TableCell({
          width: { size: SDTM_COL_WIDTH_4, type: WidthType.DXA },
          shading: { type: ShadingType.CLEAR, fill: "0F172A" },
          children: [
            new Paragraph({
              children: [
                new TextRun({
                  text: "SDTM Target",
                  bold: true,
                  color: "FFFFFF",
                  size: 18,
                }),
              ],
            }),
          ],
        }),
        new TableCell({
          width: { size: SDTM_COL_WIDTH_5, type: WidthType.DXA },
          shading: { type: ShadingType.CLEAR, fill: "0F172A" },
          children: [
            new Paragraph({
              children: [
                new TextRun({
                  text: "Origin",
                  bold: true,
                  color: "FFFFFF",
                  size: 18,
                }),
              ],
            }),
          ],
        }),
        new TableCell({
          width: { size: SDTM_COL_WIDTH_6, type: WidthType.DXA },
          shading: { type: ShadingType.CLEAR, fill: "0F172A" },
          children: [
            new Paragraph({
              children: [
                new TextRun({
                  text: "Core",
                  bold: true,
                  color: "FFFFFF",
                  size: 18,
                }),
              ],
            }),
          ],
        }),
      ],
    }),
  ];

  forms.forEach((form) => {
    form.sections.forEach((sec) => {
      sec.fields.forEach((field) => {
        const isDerived = field.dataType === "calculated";
        const origin = isDerived ? "Derived" : "CRF";
        const sdtmTarget = sdtmTargetFor(field, form.domain);
        const core = field.cdashMetadata?.core || (field.required ? "HR" : "O");

        rows.push(
          new TableRow({
            children: [
              new TableCell({
                borders: cellBorder,
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: form.domain,
                        bold: true,
                        color: "0284C7",
                        size: 18,
                      }),
                    ],
                  }),
                ],
              }),
              new TableCell({
                borders: cellBorder,
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: field.variableName,
                        bold: true,
                        size: 18,
                      }),
                    ],
                  }),
                ],
              }),
              new TableCell({
                borders: cellBorder,
                children: [
                  new Paragraph({
                    children: [new TextRun({ text: field.label, size: 18 })],
                  }),
                ],
              }),
              new TableCell({
                borders: cellBorder,
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: sdtmTarget,
                        color: "0284C7",
                        size: 18,
                      }),
                    ],
                  }),
                ],
              }),
              new TableCell({
                borders: cellBorder,
                children: [
                  new Paragraph({
                    children: [new TextRun({ text: origin, size: 18 })],
                  }),
                ],
              }),
              new TableCell({
                borders: cellBorder,
                children: [
                  new Paragraph({
                    children: [new TextRun({ text: core, size: 18 })],
                  }),
                ],
              }),
            ],
          })
        );
      });
    });
  });

  return new Table({
    width: { size: TABLE_WIDTH_DXA, type: WidthType.DXA },
    rows,
  });
}

/**
 * Generates a complete Microsoft Word (.docx) document representing the CRF Study or a Single Form.
 *
 * @param study - StudyProtocol definition
 * @param options - Export options. `all` includes every form; `single` includes the form matching
 *   the first `selectedFormIds` entry; `selected` includes matching requested forms in study order.
 *   Those scopes throw a `RangeError` if `selectedFormIds` is missing or empty, if the first ID
 *   does not resolve for `single`, or if no IDs resolve for `selected`.
 * @returns Promise resolving to binary Blob
 */
export async function generateStudyDocx(
  study: StudyProtocol,
  options: ExportDocxOptions
): Promise<Blob> {
  let formsToInclude: CRFForm[];
  if (options.scope === "all") {
    formsToInclude = study.forms;
  } else {
    const selectedFormIds = options.selectedFormIds;
    if (!selectedFormIds?.length) {
      const selectionError =
        options.scope === "single"
          ? "Cannot export with scope 'single': selectedFormIds must contain a first entry."
          : "Cannot export with scope 'selected': selectedFormIds must contain at least one entry.";
      throw new RangeError(selectionError);
    }

    if (options.scope === "single") {
      const form = study.forms.find(
        (candidate) => candidate.id === selectedFormIds[0]
      );
      if (!form) {
        throw new RangeError(
          "Cannot export with scope 'single': the first selectedFormIds entry must match a study form."
        );
      }
      formsToInclude = [form];
    } else {
      const requestedFormIds = new Set(selectedFormIds);
      formsToInclude = study.forms.filter((form) =>
        requestedFormIds.has(form.id)
      );
      if (formsToInclude.length === 0) {
        throw new RangeError(
          "Cannot export with scope 'selected': selectedFormIds must match at least one study form."
        );
      }
    }
  }

  const branding = options.branding || getStudyBranding(study);
  const isAnnotated = options.mode === "annotated";
  const primaryColor = cleanHex(branding.primaryColor, "0284C7");
  const accentColor = cleanHex(branding.accentColor, "0EA5E9");

  const documentChildren: (Paragraph | Table)[] = [];

  // 1. Organization Header & Logo
  if (branding.logoBase64) {
    try {
      const logoBytes = base64ToUint8Array(branding.logoBase64);
      if (logoBytes && logoBytes.length > 0) {
        documentChildren.push(
          new Paragraph({
            children: [
              new ImageRun({
                data: logoBytes,
                transformation: { width: 140, height: 45 },
                type: "png",
              }),
            ],
            alignment: AlignmentType.CENTER,
            spacing: { before: 200, after: 200 },
          })
        );
      }
    } catch {
      // Gracefully continue without logo if corrupted or unreadable
    }
  }

  // 2. Cover Title
  documentChildren.push(
    new Paragraph({
      children: [
        new TextRun({
          text: branding.organizationName.toUpperCase(),
          bold: true,
          size: 24,
          color: primaryColor,
          font: "Helvetica",
        }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { before: 100, after: 100 },
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: isAnnotated
            ? "REGULATORY SUBMISSION ANNOTATED CASE REPORT FORM BOOK (aCRF)"
            : "CLINICAL CASE REPORT FORM BOOK (DATA COLLECTION INSTRUMENT)",
          bold: true,
          size: 32,
          color: "0F172A",
        }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { before: 100, after: 200 },
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: study.studyName,
          bold: true,
          size: 26,
          color: "334155",
        }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { before: 100, after: 300 },
    })
  );

  // 3. Metadata Table
  const metaBorder = {
    top: { style: BorderStyle.NONE },
    bottom: { style: BorderStyle.NONE },
    left: { style: BorderStyle.NONE },
    right: { style: BorderStyle.NONE },
  };

  documentChildren.push(
    new Table({
      width: { size: TABLE_WIDTH_DXA, type: WidthType.DXA },
      rows: [
        new TableRow({
          children: [
            new TableCell({
              borders: metaBorder,
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: "Protocol Number: ",
                      bold: true,
                      size: 20,
                    }),
                    new TextRun({ text: study.protocolNumber, size: 20 }),
                  ],
                }),
                new Paragraph({
                  children: [
                    new TextRun({
                      text: "Study Phase: ",
                      bold: true,
                      size: 20,
                    }),
                    new TextRun({ text: study.phase, size: 20 }),
                  ],
                }),
                new Paragraph({
                  children: [
                    new TextRun({
                      text: "Therapeutic Area: ",
                      bold: true,
                      size: 20,
                    }),
                    new TextRun({ text: study.therapeuticArea, size: 20 }),
                  ],
                }),
              ],
            }),
            new TableCell({
              borders: metaBorder,
              children: [
                new Paragraph({
                  children: [
                    new TextRun({ text: "Sponsor: ", bold: true, size: 20 }),
                    new TextRun({ text: study.sponsor, size: 20 }),
                  ],
                }),
                new Paragraph({
                  children: [
                    new TextRun({ text: "Version: ", bold: true, size: 20 }),
                    new TextRun({ text: `v${study.version}`, size: 20 }),
                  ],
                }),
                new Paragraph({
                  children: [
                    new TextRun({
                      text: "Date / Generated: ",
                      bold: true,
                      size: 20,
                    }),
                    new TextRun({
                      text:
                        study.lastModified ||
                        new Date().toISOString().slice(0, 10),
                      size: 20,
                    }),
                  ],
                }),
              ],
            }),
          ],
        }),
      ],
    }),
    new Paragraph({ spacing: { before: 200, after: 200 } })
  );

  // 4. Confidentiality Box
  if (branding.confidentialityNotice) {
    documentChildren.push(
      new Table({
        width: { size: TABLE_WIDTH_DXA, type: WidthType.DXA },
        rows: [
          new TableRow({
            children: [
              new TableCell({
                shading: { type: ShadingType.CLEAR, fill: "F8FAFC" },
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: "CONFIDENTIALITY STATEMENT",
                        bold: true,
                        size: 18,
                        color: "64748B",
                      }),
                    ],
                    spacing: { after: 60 },
                  }),
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: branding.confidentialityNotice,
                        size: 18,
                        italics: true,
                        color: "475569",
                      }),
                    ],
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
      new Paragraph({ spacing: { before: 200, after: 200 } })
    );

    // Page Break after Cover Page
    documentChildren.push(
      new Paragraph({
        pageBreakBefore: true,
      })
    );
  }

  // 5. Table of Contents (if multi-form study and enabled)
  if (options.includeTableOfContents !== false && formsToInclude.length > 1) {
    documentChildren.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        children: [
          new TextRun({
            text: "Table of Contents & Domain Index",
            bold: true,
            size: 28,
            color: primaryColor,
          }),
        ],
        spacing: { before: 200, after: 200 },
      }),
      createTableOfContentsTable(formsToInclude),
      new Paragraph({ pageBreakBefore: true })
    );
  }

  // 6. Iterate through forms and sections
  formsToInclude.forEach((form, formIdx) => {
    // Form Banner
    documentChildren.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        children: [
          new TextRun({
            text: `[${form.domain}] ${form.name}`,
            bold: true,
            size: 28,
            color: primaryColor,
          }),
        ],
        spacing: { before: formIdx > 0 ? 300 : 100, after: 80 },
      })
    );

    if (form.description) {
      documentChildren.push(
        new Paragraph({
          children: [
            new TextRun({
              text: form.description,
              size: 20,
              color: "64748B",
            }),
          ],
          spacing: { after: 180 },
        })
      );
    }

    // Form Sections
    form.sections.forEach((section) => {
      documentChildren.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          children: [
            new TextRun({
              text: `Section: ${section.title}`,
              bold: true,
              size: 22,
              color: "0F172A",
            }),
          ],
          spacing: { before: 180, after: 80 },
        }),
        createSectionTable(
          section.fields,
          study,
          isAnnotated,
          primaryColor,
          accentColor,
          form.domain
        ),
        new Paragraph({ spacing: { after: 160 } })
      );
    });

    // Add page break between forms if multiple forms
    if (formIdx < formsToInclude.length - 1) {
      documentChildren.push(new Paragraph({ pageBreakBefore: true }));
    }
  });

  // 7. SDTM Appendix if enabled
  if (options.includeSdtmAppendix) {
    documentChildren.push(
      new Paragraph({
        pageBreakBefore: true,
        heading: HeadingLevel.HEADING_1,
        children: [
          new TextRun({
            text: "Appendix: CDISC SDTM Target Mapping Specifications",
            bold: true,
            size: 28,
            color: primaryColor,
          }),
        ],
        spacing: { before: 200, after: 160 },
      }),
      createSdtmSpecificationTable(formsToInclude)
    );
  }

  // 8. Headers & Footers
  const headerContent = new Header({
    children: [
      new Paragraph({
        children: [
          new TextRun({
            text: `${branding.organizationName} • ${study.protocolNumber} (${study.phase})`,
            size: 16,
            color: "64748B",
          }),
          new TextRun({
            text: `\t\t${branding.headerText || "CONFIDENTIAL"}`,
            size: 16,
            color: "94A3B8",
            bold: true,
          }),
        ],
      }),
    ],
  });

  const footerContent = new Footer({
    children: [
      new Paragraph({
        children: [
          new TextRun({
            text: `${branding.footerText || "CRF Studio Export"} • CDISC CDASH v2.2 • Schedule Consultation: ${consultationUrl()}`,
            size: 16,
            color: "94A3B8",
          }),
          new TextRun({
            text: "\t\tPage ",
            size: 16,
            color: "64748B",
          }),
          new TextRun({
            children: [PageNumber.CURRENT],
            size: 16,
            color: "64748B",
            bold: true,
          }),
          new TextRun({
            text: " of ",
            size: 16,
            color: "64748B",
          }),
          new TextRun({
            children: [PageNumber.TOTAL_PAGES],
            size: 16,
            color: "64748B",
            bold: true,
          }),
        ],
      }),
    ],
  });

  const doc = new Document({
    sections: [
      {
        headers: { default: headerContent },
        footers: { default: footerContent },
        properties: {
          page: {
            margin: {
              top: 1440, // 1 inch
              bottom: 1440, // 1 inch
              left: 1440, // 1 inch
              right: 1440, // 1 inch
            },
          },
        },
        children: documentChildren,
      },
    ],
  });

  return await Packer.toBlob(doc);
}

/**
 * Convenience helper to export a single form to docx.
 */
export async function generateFormDocx(
  form: CRFForm,
  study: StudyProtocol,
  options: Partial<ExportDocxOptions> = {}
): Promise<Blob> {
  return generateStudyDocx(study, {
    mode: options.mode || "blank",
    scope: "single",
    selectedFormIds: [form.id],
    includeTableOfContents: false,
    includeSdtmAppendix: options.includeSdtmAppendix || false,
    branding: options.branding,
  });
}
