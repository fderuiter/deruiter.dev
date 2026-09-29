import { CRFForm, StudyProtocol, StudyBranding } from "./types";
import { getStudyBranding } from "./branding-defaults";
import { consultationUrl, sdtmTargetFor } from "./export-annotations";

/**
 * SDTM Variable Mapping item for aCRF compliance
 */
export interface SdtmMappingRow {
  formDomain: string;
  formName: string;
  variableName: string;
  label: string;
  dataType: string;
  sdtmTarget: string;
  origin: "CRF" | "Derived" | "Assigned";
  core: string;
  nciCode?: string;
}

export interface AcrfHtmlOptions {
  mode?: "blank" | "annotated";
  branding?: StudyBranding;
}

/**
 * Generates an SDTM mapping matrix across all forms in a study protocol.
 *
 * @param study - The study protocol
 * @returns Array of SDTM mapping rows
 */
export function generateSdtmMappingMatrix(
  study: StudyProtocol
): SdtmMappingRow[] {
  const rows: SdtmMappingRow[] = [];

  study.forms.forEach((form) => {
    form.sections.forEach((sec) => {
      sec.fields.forEach((field) => {
        const meta = field.cdashMetadata;
        const origin: "CRF" | "Derived" | "Assigned" =
          field.dataType === "calculated"
            ? "Derived"
            : field.variableName.startsWith("VISIT") ||
                field.variableName.startsWith("STUDY")
              ? "Assigned"
              : "CRF";

        rows.push({
          formDomain: form.domain,
          formName: form.name,
          variableName: field.variableName,
          label: field.label,
          dataType: field.dataType,
          sdtmTarget: sdtmTargetFor(field, form.domain),
          origin,
          core: meta?.core || (field.required ? "HR" : "O"),
          nciCode: meta?.nciConceptId,
        });
      });
    });
  });

  return rows;
}

/**
 * Generates an HTML printable document with optional annotated SDTM/CDASH tags overlaid for a single form.
 *
 * @param form - The form to render
 * @param study - The parent study protocol
 * @param options - Mode ("blank" | "annotated") and branding overrides
 * @returns HTML document string
 */
export function generateAcrfHtml(
  form: CRFForm,
  study: StudyProtocol,
  options: AcrfHtmlOptions = {}
): string {
  const branding = options.branding || getStudyBranding(study);
  const isAnnotated = options.mode !== "blank";
  const primaryColor = branding.primaryColor || "#0284c7";
  const accentColor = branding.accentColor || "#0ea5e9";

  let sectionsHtml = "";

  form.sections.forEach((sec) => {
    let fieldsHtml = "";

    sec.fields.forEach((field) => {
      const sdtmTag = sdtmTargetFor(field, form.domain);
      const codelist = study.codelists.find((cl) => cl.id === field.codelistId);
      const isDerived = field.dataType === "calculated";
      const originColor = isDerived ? "#9333ea" : accentColor;
      const originLabel = isDerived ? "[Derived]" : "[CRF]";

      let inputMock = "";
      if (field.dataType === "radio" || field.dataType === "single_select") {
        const opts = field.customOptions ||
          codelist?.options || [{ code: "1", label: "Option 1", order: 1 }];
        inputMock = `<div style="display: flex; gap: 12px; flex-wrap: wrap; margin-top: 4px;">
          ${opts
            .map(
              (o) =>
                `<span>( ) ${o.label} <code style="color: ${primaryColor}; font-size: 10px; font-weight: bold;">[${o.code}]</code></span>`
            )
            .join("")}
        </div>`;
      } else if (
        field.dataType === "checkbox" ||
        field.dataType === "multi_select"
      ) {
        const opts = field.customOptions || codelist?.options;
        if (opts && opts.length > 0) {
          inputMock = `<div style="display: flex; gap: 12px; flex-wrap: wrap; margin-top: 4px;">
            ${opts
              .map(
                (o) =>
                  `<span>[ ] ${o.label} <code style="color: ${primaryColor}; font-size: 10px; font-weight: bold;">[${o.code}]</code></span>`
              )
              .join("")}
          </div>`;
        } else {
          inputMock = `<div style="margin-top: 4px;">[ ] Yes &nbsp;&nbsp;&nbsp;&nbsp; [ ] No</div>`;
        }
      } else if (field.dataType === "calculated") {
        inputMock = `<div style="margin-top: 4px; border: 1px dashed #94a3b8; padding: 4px 8px; font-size: 11px; color: #475569; background: #f8fafc;">
          [Calculated via formula: <code>${field.calculationFormula || "f(x)"}</code>]
        </div>`;
      } else if (field.dataType === "precision_date") {
        const nullFlavorsHtml = field.allowNullFlavor
          ? `<span style="font-size: 9px; font-family: monospace; color: #64748b; margin-left: 8px;">[ND] [NA] [UNK]</span>`
          : "";
        inputMock = `<div style="margin-top: 4px; font-family: monospace; font-size: 11px; color: #64748b; border: 1px solid #cbd5e1; border-radius: 4px; padding: 4px 8px; background: #f8fafc; display: flex; align-items: center; justify-content: space-between;">
          <span>[ YYYY - MM - DD ] ${field.allowPartial ? "(Partial)" : ""}</span>
          ${nullFlavorsHtml}
        </div>`;
      } else {
        inputMock = `<div style="margin-top: 4px; border-bottom: 1px solid #cbd5e1; height: 22px; width: 100%; display: flex; align-items: flex-end; font-size: 11px; color: #94a3b8;">
          ${field.placeholder || "_________________________"} ${field.unit ? ` (${field.unit})` : ""}
        </div>`;
      }

      const annotBadge = isAnnotated
        ? `<div style="position: absolute; top: -8px; right: 8px; background: ${originColor}; color: #ffffff; font-family: monospace; font-size: 10px; font-weight: bold; padding: 2px 6px; border-radius: 4px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); z-index: 10;">
             ${sdtmTag} <span style="font-size: 8px; opacity: 0.85;">${originLabel}</span>
           </div>`
        : "";

      fieldsHtml += `
      <div style="grid-column: span ${field.columnSpan || 12}; position: relative; border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px; background: #ffffff; margin-bottom: 8px;">
        ${annotBadge}
        <div style="font-weight: 600; font-size: 12px; color: #1e293b; margin-bottom: 4px;">
          ${field.label} ${field.required ? '<span style="color: #ef4444;">*</span>' : ""}
        </div>
        ${field.description ? `<div style="font-size: 10px; color: #64748b; margin-bottom: 6px;">${field.description}</div>` : ""}
        ${inputMock}
      </div>
      `;
    });

    sectionsHtml += `
    <div style="margin-bottom: 24px; border: 1px solid #cbd5e1; border-radius: 8px; overflow: hidden;">
      <div style="background: #f1f5f9; padding: 8px 12px; font-weight: bold; font-size: 13px; color: #0f172a; border-bottom: 1px solid #cbd5e1; border-left: 4px solid ${primaryColor};">
        ${sec.title}
      </div>
      <div style="display: grid; grid-template-columns: repeat(12, 1fr); gap: 12px; padding: 12px; background: #fafafa;">
        ${fieldsHtml}
      </div>
    </div>
    `;
  });

  const logoImgTag = branding.logoBase64
    ? `<img src="${branding.logoBase64}" alt="Sponsor Logo" style="max-height: 36px; max-width: 140px; object-fit: contain; margin-bottom: 8px;"/>`
    : "";

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>${isAnnotated ? "Annotated CRF" : "Case Report Form"} - ${study.protocolNumber} - ${form.name}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #0f172a;
      background: #ffffff;
      padding: 40px;
      max-width: 900px;
      margin: 0 auto;
    }
    @media print {
      body { padding: 0; }
      @page { margin: 15mm; }
    }
  </style>
</head>
<body>
  <!-- Title Header -->
  <div style="border-bottom: 2px solid ${primaryColor}; padding-bottom: 12px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: flex-end;">
    <div>
      ${logoImgTag}
      <div style="font-size: 11px; font-weight: bold; color: ${primaryColor}; text-transform: uppercase; letter-spacing: 1px;">
        ${branding.organizationName}
      </div>
      <div style="font-size: 18px; font-weight: 800; text-transform: uppercase; color: #0f172a; margin-top: 2px;">${study.studyName}</div>
      <div style="font-size: 12px; font-family: monospace; color: #64748b; margin-top: 4px;">
        Protocol: ${study.protocolNumber} | Phase: ${study.phase} | Sponsor: ${study.sponsor}
      </div>
    </div>
    <div style="text-align: right;">
      <div style="display: inline-block; background: ${primaryColor}; color: #ffffff; font-weight: bold; font-size: 11px; padding: 4px 8px; border-radius: 4px;">
        ${isAnnotated ? "SUBMISSION aCRF" : "CLINICAL CRF"}
      </div>
      <div style="font-size: 11px; font-family: monospace; color: #64748b; margin-top: 4px;">Domain: ${form.domain} | v${form.version}</div>
    </div>
  </div>

  <div style="margin-bottom: 16px;">
    <h2 style="font-size: 16px; margin: 0 0 4px 0; color: ${primaryColor};">${form.name}</h2>
    <p style="font-size: 11px; color: #475569; margin: 0;">${form.description}</p>
  </div>

  ${sectionsHtml}

  ${
    branding.confidentialityNotice
      ? `<div style="margin-top: 24px; padding: 8px 12px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; font-size: 10px; color: #64748b; font-style: italic;">
          ${branding.confidentialityNotice}
        </div>`
      : ""
  }

  <div style="margin-top: 30px; border-top: 1px solid #e2e8f0; padding-top: 12px; font-size: 10px; color: #94a3b8; display: flex; justify-content: space-between;">
    <span>${branding.footerText || "Generated by CRF Studio • CDISC CDASH v2.2 / SDTMIG v3.4"} • Schedule Consultation: ${consultationUrl()}</span>
    <span>Page 1 of 1</span>
  </div>
</body>
</html>`;
}

/**
 * Generates a complete, multi-page Study aCRF Book covering all forms with Table of Contents.
 *
 * @param study - The study protocol
 * @param options - Mode and branding overrides
 * @returns Complete unified HTML book string
 */
export function generateStudyAcrfBookHtml(
  study: StudyProtocol,
  options: AcrfHtmlOptions = {}
): string {
  const branding = options.branding || getStudyBranding(study);
  const isAnnotated = options.mode !== "blank";
  const primaryColor = branding.primaryColor || "#0284c7";
  const accentColor = branding.accentColor || "#0ea5e9";

  const formsHtml = study.forms
    .map((form, idx) => {
      let sectionsHtml = "";

      form.sections.forEach((sec) => {
        let fieldsHtml = "";

        sec.fields.forEach((field) => {
          const sdtmTag = sdtmTargetFor(field, form.domain);
          const isDerived = field.dataType === "calculated";
          const originColor = isDerived ? "#9333ea" : accentColor;
          const originLabel = isDerived ? "[Derived]" : "[CRF]";

          const annotBadge = isAnnotated
            ? `<div style="position: absolute; top: -8px; right: 8px; background: ${originColor}; color: #ffffff; font-family: monospace; font-size: 10px; font-weight: bold; padding: 2px 6px; border-radius: 4px;">
                ${sdtmTag} <span style="font-size: 8px; opacity: 0.85;">${originLabel}</span>
              </div>`
            : "";

          fieldsHtml += `
          <div style="grid-column: span ${field.columnSpan || 12}; position: relative; border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px; background: #ffffff; margin-bottom: 8px;">
            ${annotBadge}
            <div style="font-weight: 600; font-size: 12px; color: #1e293b; margin-bottom: 4px;">
              ${field.label} ${field.required ? '<span style="color: #ef4444;">*</span>' : ""}
            </div>
            ${field.description ? `<div style="font-size: 10px; color: #64748b; margin-bottom: 4px;">${field.description}</div>` : ""}
            <div style="margin-top: 4px; border-bottom: 1px solid #cbd5e1; height: 18px; width: 100%;"></div>
          </div>
          `;
        });

        sectionsHtml += `
        <div style="margin-bottom: 20px; border: 1px solid #cbd5e1; border-radius: 6px; overflow: hidden;">
          <div style="background: #f1f5f9; padding: 6px 10px; font-weight: bold; font-size: 12px; color: #0f172a; border-left: 4px solid ${primaryColor};">
            ${sec.title}
          </div>
          <div style="display: grid; grid-template-columns: repeat(12, 1fr); gap: 10px; padding: 10px; background: #fafafa;">
            ${fieldsHtml}
          </div>
        </div>
        `;
      });

      return `
      <div style="page-break-before: always; padding-top: 20px;">
        <div style="display: flex; justify-content: space-between; align-items: baseline; border-bottom: 2px solid ${primaryColor}; padding-bottom: 6px; margin-bottom: 14px;">
          <div>
            <span style="font-size: 11px; font-family: monospace; font-weight: bold; color: ${primaryColor};">SECTION ${idx + 1}</span>
            <h2 style="font-size: 16px; margin: 2px 0 0 0; color: #0f172a;">[${form.domain}] ${form.name}</h2>
          </div>
          <span style="font-size: 10px; font-family: monospace; color: #64748b;">v${form.version}</span>
        </div>
        ${sectionsHtml}
        <div style="text-align: right; font-size: 10px; color: #94a3b8; margin-top: 20px;">
          Document Page ${idx + 2} of ${study.forms.length + 1}
        </div>
      </div>
      `;
    })
    .join("");

  const logoImgTag = branding.logoBase64
    ? `<img src="${branding.logoBase64}" alt="Sponsor Logo" style="max-height: 48px; max-width: 180px; object-fit: contain; margin-bottom: 16px;"/>`
    : "";

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>${isAnnotated ? "Unified aCRF Submission Book" : "Clinical Case Report Form Book"} - ${study.protocolNumber}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #0f172a;
      background: #ffffff;
      padding: 40px;
      max-width: 900px;
      margin: 0 auto;
    }
    @media print {
      body { padding: 0; }
      @page { margin: 15mm; }
    }
  </style>
</head>
<body>
  <!-- COVER PAGE -->
  <div style="text-align: center; padding: 60px 20px; border-bottom: 2px solid ${primaryColor};">
    ${logoImgTag}
    <div style="font-size: 14px; font-weight: bold; color: ${primaryColor}; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 8px;">
      ${branding.organizationName}
    </div>
    <div style="font-size: 12px; font-family: monospace; letter-spacing: 2px; color: ${accentColor}; font-weight: bold; margin-bottom: 12px;">
      ${isAnnotated ? "REGULATORY SUBMISSION ANNOTATED CASE REPORT FORM BOOK (aCRF)" : "CLINICAL CASE REPORT FORM BOOK"}
    </div>
    <h1 style="font-size: 24px; font-weight: 800; color: #0f172a; margin-bottom: 16px;">
      ${study.studyName}
    </h1>
    <div style="font-size: 14px; font-family: monospace; color: #334155; margin-bottom: 24px;">
      Protocol: ${study.protocolNumber} | Phase: ${study.phase} | Version: ${study.version}
    </div>
    <div style="font-size: 12px; color: #64748b;">
      Sponsor: <strong>${study.sponsor}</strong> • Therapeutic Area: <strong>${study.therapeuticArea}</strong>
    </div>

    ${
      branding.confidentialityNotice
        ? `<div style="margin-top: 30px; padding: 12px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; font-size: 11px; color: #64748b; font-style: italic; max-width: 650px; margin-left: auto; margin-right: auto;">
            ${branding.confidentialityNotice}
          </div>`
        : ""
    }
  </div>

  <!-- TABLE OF CONTENTS -->
  <div style="page-break-before: always; padding-top: 30px;">
    <h2 style="font-size: 16px; border-bottom: 2px solid ${primaryColor}; padding-bottom: 8px; margin-bottom: 16px; color: ${primaryColor};">
      Table of Contents &amp; SDTM Domain Index
    </h2>
    <table style="width: 100%; border-collapse: collapse; font-size: 12px; font-family: monospace;">
      <thead>
        <tr style="background: #f1f5f9; text-align: left;">
          <th style="padding: 8px; border: 1px solid #cbd5e1;">#</th>
          <th style="padding: 8px; border: 1px solid #cbd5e1;">Domain</th>
          <th style="padding: 8px; border: 1px solid #cbd5e1;">CRF Form Title</th>
          <th style="padding: 8px; border: 1px solid #cbd5e1;">Fields</th>
          <th style="padding: 8px; border: 1px solid #cbd5e1;">Doc Page</th>
        </tr>
      </thead>
      <tbody>
        ${study.forms
          .map(
            (f, idx) => `
          <tr>
            <td style="padding: 8px; border: 1px solid #cbd5e1;">${idx + 1}</td>
            <td style="padding: 8px; border: 1px solid #cbd5e1; color: ${primaryColor}; font-weight: bold;">${f.domain}</td>
            <td style="padding: 8px; border: 1px solid #cbd5e1;">${f.name}</td>
            <td style="padding: 8px; border: 1px solid #cbd5e1;">${f.sections.flatMap((s) => s.fields).length}</td>
            <td style="padding: 8px; border: 1px solid #cbd5e1; text-align: right;">${idx + 2}</td>
          </tr>
        `
          )
          .join("")}
      </tbody>
    </table>
  </div>

  <!-- ALL FORMS -->
  ${formsHtml}

  <div style="margin-top: 30px; border-top: 1px solid #e2e8f0; padding-top: 12px; font-size: 10px; color: #94a3b8; text-align: center;">
    ${branding.footerText || "Generated by CRF Studio • CDISC CDASH v2.2 / SDTMIG v3.4"} • Schedule Consultation: ${consultationUrl()}
  </div>
</body>
</html>`;
}
