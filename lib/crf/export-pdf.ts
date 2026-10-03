import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { CRFForm, StudyProtocol, CRFField, ExportPdfOptions } from "./types";
import { getStudyBranding } from "./branding-defaults";
import { consultationUrl, sdtmTargetFor } from "./export-annotations";

/**
 * jspdf-autotable's plugin attaches `lastAutoTable` to the jsPDF instance at
 * runtime, but the library ships no type augmentation for it.
 */
interface JsPDFWithAutoTable extends jsPDF {
  lastAutoTable: { finalY: number };
}

/**
 * Converts Hex string to RGB tuple for jsPDF.
 */
function hexToRgb(
  hex?: string,
  fallback: [number, number, number] = [2, 132, 199]
): [number, number, number] {
  if (!hex) return fallback;
  const clean = hex.replace(/^#/, "");
  const normalized =
    clean.length === 3
      ? clean
          .split("")
          .map((c) => c + c)
          .join("")
      : clean;
  const num = parseInt(normalized, 16);
  if (isNaN(num)) return fallback;
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

/**
 * Formats response mock text for PDF table.
 */
function formatResponseMock(field: CRFField, study: StudyProtocol): string {
  const codelist = study.codelists.find((cl) => cl.id === field.codelistId);

  if (field.dataType === "radio" || field.dataType === "single_select") {
    const opts = field.customOptions ||
      codelist?.options || [
        { code: "1", label: "Option 1", order: 1 },
        { code: "2", label: "Option 2", order: 2 },
      ];
    return opts.map((o) => `( ) ${o.label} [${o.code}]`).join("   ");
  }

  if (field.dataType === "multi_select" || field.dataType === "checkbox") {
    const opts = field.customOptions || codelist?.options;
    if (opts && opts.length > 0) {
      return opts.map((o) => `[ ] ${o.label} [${o.code}]`).join("   ");
    }
    return "[ ] Yes     [ ] No";
  }

  if (field.dataType === "calculated") {
    return `[Derived Formula: ${field.calculationFormula || "f(x)"}]`;
  }

  if (field.dataType === "precision_date") {
    const nullFlavorText = field.allowNullFlavor ? "  [ND] [NA] [UNK]" : "";
    return `[ YYYY - MM - DD ]${field.allowPartial ? " (Partial Allowed)" : ""}${nullFlavorText}`;
  }

  if (field.dataType === "repeating_table") {
    return "[Repeating Log Matrix - Multiple rows collected]";
  }

  return `_______________________ ${field.unit ? `(${field.unit})` : ""}`;
}

/**
 * Generates a high-fidelity PDF document representing a study or selected forms.
 *
 * @param study - StudyProtocol definition
 * @param options - Export options. `all` includes every form; `single` includes the form matching
 *   the first `selectedFormIds` entry; `selected` includes matching requested forms in study order.
 *   Those scopes throw a `RangeError` if `selectedFormIds` is missing or empty, if the first ID
 *   does not resolve for `single`, or if no IDs resolve for `selected`.
 * @returns Promise resolving to binary Blob
 */
export async function generateStudyPdf(
  study: StudyProtocol,
  options: ExportPdfOptions
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
  const primaryRgb = hexToRgb(branding.primaryColor, [2, 132, 199]);
  const accentRgb = hexToRgb(branding.accentColor, [14, 165, 233]);

  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  const MIN_SECTION_CLEARANCE = 40;
  let currentY = 20;

  // 1. Cover Page
  // Brand Logo if provided
  if (branding.logoBase64) {
    try {
      doc.addImage(
        branding.logoBase64,
        "PNG",
        pageWidth / 2 - 25,
        currentY,
        50,
        15
      );
      currentY += 22;
    } catch {
      // If image format fails, continue gracefully
      currentY += 5;
    }
  }

  // Sponsor Organization Name
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(primaryRgb[0], primaryRgb[1], primaryRgb[2]);
  doc.text(branding.organizationName.toUpperCase(), pageWidth / 2, currentY, {
    align: "center",
  });
  currentY += 10;

  // Title
  doc.setFontSize(16);
  doc.setTextColor(15, 23, 42);
  const titleText = isAnnotated
    ? "REGULATORY SUBMISSION aCRF BOOK"
    : "CLINICAL CASE REPORT FORM BOOK";
  doc.text(titleText, pageWidth / 2, currentY, { align: "center" });
  currentY += 8;

  // Study Name
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(51, 65, 85);
  const splitStudyName = doc.splitTextToSize(
    study.studyName,
    pageWidth - margin * 2 - 10
  );
  doc.text(splitStudyName, pageWidth / 2, currentY, { align: "center" });
  currentY += splitStudyName.length * 6 + 6;

  // Metadata Table
  autoTable(doc, {
    startY: currentY,
    margin: { left: margin, right: margin },
    theme: "plain",
    styles: { fontSize: 9, cellPadding: 2, textColor: [30, 41, 59] },
    body: [
      [
        {
          content: `Protocol Number: ${study.protocolNumber}`,
          styles: { fontStyle: "bold" },
        },
        { content: `Sponsor: ${study.sponsor}`, styles: { fontStyle: "bold" } },
      ],
      [
        { content: `Study Phase: ${study.phase}` },
        { content: `Version: v${study.version}` },
      ],
      [
        { content: `Therapeutic Area: ${study.therapeuticArea}` },
        {
          content: `Date: ${study.lastModified || new Date().toISOString().slice(0, 10)}`,
        },
      ],
    ],
  });

  currentY = (doc as JsPDFWithAutoTable).lastAutoTable.finalY + 8;

  // Confidentiality Notice Box
  if (branding.confidentialityNotice) {
    autoTable(doc, {
      startY: currentY,
      margin: { left: margin, right: margin },
      theme: "grid",
      styles: {
        fontSize: 8,
        cellPadding: 4,
        fillColor: [248, 250, 252],
        textColor: [71, 85, 105],
        fontStyle: "italic",
        lineColor: [203, 213, 225],
        lineWidth: 0.2,
      },
      head: [
        [
          {
            content: "CONFIDENTIALITY NOTICE",
            styles: {
              fontStyle: "bold",
              textColor: [100, 116, 139],
              fillColor: [241, 245, 249],
            },
          },
        ],
      ],
      body: [[branding.confidentialityNotice]],
    });

    // Page Break after Cover
    doc.addPage();
  }

  // 2. Table of Contents (if multi-form and enabled)
  if (options.includeTableOfContents !== false && formsToInclude.length > 1) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(primaryRgb[0], primaryRgb[1], primaryRgb[2]);
    doc.text("Table of Contents & Domain Index", margin, 20);

    const tocRows = formsToInclude.map((f, idx) => [
      `${idx + 1}`,
      f.domain,
      f.name,
      `${f.sections.length}`,
      `${f.sections.flatMap((s) => s.fields).length}`,
    ]);

    autoTable(doc, {
      startY: 25,
      margin: { left: margin, right: margin },
      head: [["#", "Domain", "Form Name", "Sections", "Fields"]],
      body: tocRows,
      theme: "striped",
      headStyles: {
        fillColor: [primaryRgb[0], primaryRgb[1], primaryRgb[2]],
        textColor: [255, 255, 255],
        fontStyle: "bold",
        fontSize: 9,
      },
      styles: { fontSize: 8.5, cellPadding: 2.5 },
      columnStyles: {
        0: { cellWidth: 10 },
        1: { cellWidth: 20, fontStyle: "bold" },
        2: { cellWidth: "auto" },
        3: { cellWidth: 20, halign: "center" },
        4: { cellWidth: 20, halign: "center" },
      },
    });

    doc.addPage();
  }

  // 3. Render Forms & Sections
  formsToInclude.forEach((form, fIdx) => {
    if (fIdx > 0) {
      doc.addPage();
    }

    // Form Title
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(primaryRgb[0], primaryRgb[1], primaryRgb[2]);
    doc.text(`[${form.domain}] ${form.name}`, margin, 18);

    if (form.description) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(100, 116, 139);
      doc.text(form.description, margin, 23);
    }

    let startY = form.description ? 28 : 24;

    form.sections.forEach((sec) => {
      if (startY > pageHeight - margin - MIN_SECTION_CLEARANCE) {
        doc.addPage();
        startY = 24;
      }

      // Section Header Banner
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(15, 23, 42);
      doc.text(`Section: ${sec.title}`, margin, startY);
      startY += 3;

      const tableData = sec.fields.map((field) => {
        const reqStar = field.required ? " *" : "";
        const desc = field.description ? `\n${field.description}` : "";
        const promptCol = `${field.label}${reqStar}\n[${field.variableName} • ${field.dataType}]${desc}`;
        const valCol = formatResponseMock(field, study);

        if (isAnnotated) {
          const sdtmTarget = sdtmTargetFor(field, form.domain);
          const isDerived = field.dataType === "calculated";
          const core =
            field.cdashMetadata?.core || (field.required ? "HR" : "O");
          const annotCol = `${sdtmTarget}\n[${isDerived ? "Derived" : "CRF"}] [${core}]`;
          return [promptCol, valCol, annotCol];
        }

        return [promptCol, valCol];
      });

      const head = isAnnotated
        ? [
            [
              "Question / Variable Prompt",
              "Clinical Value Blank",
              "SDTM / aCRF Tag",
            ],
          ]
        : [["Question / Variable Prompt", "Clinical Value / Observations"]];

      autoTable(doc, {
        startY,
        margin: { left: margin, right: margin },
        head,
        body: tableData,
        theme: "grid",
        headStyles: {
          fillColor: [241, 245, 249],
          textColor: [15, 23, 42],
          fontStyle: "bold",
          fontSize: 8,
          lineColor: [203, 213, 225],
          lineWidth: 0.1,
        },
        styles: {
          fontSize: 8,
          cellPadding: 2.5,
          lineColor: [226, 232, 240],
          lineWidth: 0.1,
          textColor: [30, 41, 59],
        },
        columnStyles: isAnnotated
          ? {
              0: { cellWidth: 60, fontStyle: "bold" },
              1: { cellWidth: "auto" },
              2: {
                cellWidth: 45,
                textColor: [accentRgb[0], accentRgb[1], accentRgb[2]],
                fontStyle: "bold",
                fillColor: [248, 250, 252],
              },
            }
          : {
              0: { cellWidth: 70, fontStyle: "bold" },
              1: { cellWidth: "auto" },
            },
      });

      startY = (doc as JsPDFWithAutoTable).lastAutoTable.finalY + 8;
    });
  });

  // 4. SDTM Appendix (if enabled)
  if (options.includeSdtmAppendix) {
    doc.addPage();
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(primaryRgb[0], primaryRgb[1], primaryRgb[2]);
    doc.text("Appendix: CDISC SDTM Mapping Specification", margin, 20);

    const sdtmRows: string[][] = [];
    formsToInclude.forEach((f) => {
      f.sections.forEach((sec) => {
        sec.fields.forEach((field) => {
          sdtmRows.push([
            f.domain,
            field.variableName,
            field.label,
            sdtmTargetFor(field, f.domain),
            field.dataType === "calculated" ? "Derived" : "CRF",
            field.cdashMetadata?.core || (field.required ? "HR" : "O"),
          ]);
        });
      });
    });

    autoTable(doc, {
      startY: 25,
      margin: { left: margin, right: margin },
      head: [
        ["Domain", "Variable", "CDASH Label", "SDTM Target", "Origin", "Core"],
      ],
      body: sdtmRows,
      theme: "striped",
      headStyles: {
        fillColor: [15, 23, 42],
        textColor: [255, 255, 255],
        fontStyle: "bold",
        fontSize: 8,
      },
      styles: { fontSize: 7.5, cellPadding: 2 },
    });
  }

  // 5. Header and Footer stamping across all pages
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);

    // Running Header
    doc.text(
      `${branding.organizationName} • ${study.protocolNumber} (${study.phase})`,
      margin,
      9
    );
    doc.text(branding.headerText || "CONFIDENTIAL", pageWidth - margin, 9, {
      align: "right",
    });
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.1);
    doc.line(margin, 11, pageWidth - margin, 11);

    // Running Footer
    doc.line(margin, pageHeight - 11, pageWidth - margin, pageHeight - 11);
    const consultationSuffix =
      options.includeConsultationLink === false
        ? ""
        : ` • Schedule Consultation: ${consultationUrl()}`;
    doc.text(
      `${branding.footerText || "CRF Studio"} • CDISC CDASH 2.2${consultationSuffix}`,
      margin,
      pageHeight - 7
    );
    if (branding.showPageNumbers !== false) {
      doc.text(
        `Page ${i} of ${totalPages}`,
        pageWidth - margin,
        pageHeight - 7,
        {
          align: "right",
        }
      );
    }
  }

  return doc.output("blob");
}

/**
 * Convenience helper to export a single form to PDF.
 */
export async function generateFormPdf(
  form: CRFForm,
  study: StudyProtocol,
  options: Partial<ExportPdfOptions> = {}
): Promise<Blob> {
  return generateStudyPdf(study, {
    mode: options.mode || "blank",
    scope: "single",
    selectedFormIds: [form.id],
    includeTableOfContents: false,
    includeSdtmAppendix: options.includeSdtmAppendix || false,
    branding: options.branding,
  });
}
