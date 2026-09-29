/**
 * Shared annotation helpers for CRF Studio's downloadable exports (#1203).
 *
 * Every export (PDF, DOCX, HTML aCRF, SAS, R, ODM-XML, FHIR) must agree with
 * the builder canvas about a field's SDTM target, and must link back with a
 * URL that still works once the file has left the site.
 */

import { resolveBaseUrl } from "@/lib/domain";
import type { CRFField } from "./types";

/**
 * The SDTM target annotated for a field.
 *
 * The CDASH metadata's `acrfAnnotation` carries the submission target (for
 * example `DS.DSSTDTC [DSDECOD=INFORMED CONSENT OBTAINED]`), whereas
 * `sdtmVariable` holds the CDASH collection name (`ICDAT`), which is not an
 * SDTM annotation. Falls back to `DOMAIN.VARIABLE`.
 *
 * @param field - The CRF field being annotated.
 * @param domain - The owning form's SDTM domain code.
 * @returns The annotation text shown in the aCRF and mapping tables.
 */
export function sdtmTargetFor(field: CRFField, domain: string): string {
  const annotation = field.cdashMetadata?.acrfAnnotation?.trim();
  return annotation || `${domain}.${field.variableName}`;
}

/**
 * Absolute consultation link for export footers. A relative `/schedule` means
 * nothing in a downloaded file, so this resolves against the canonical domain.
 *
 * @returns The canonical `/schedule` URL.
 */
export function consultationUrl(): string {
  return `${resolveBaseUrl()}/schedule`;
}
