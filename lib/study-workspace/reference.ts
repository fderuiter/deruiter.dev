/**
 * Reference studies every link in the Clinical Study Studio is tested on
 * (epic #3071). DEMO-301, the randomised drug study, lives with the pipeline
 * (`DEMO_301_USDM` in `lib/study-data/presets`); this module holds the
 * device study that complements it.
 */
import type { UsdmV4Document } from "@/lib/clinical-standards";
import tavrDevice from "./reference/tavr-device.usdm.json";

/**
 * The TAVR device reference study as a USDM v4 document: a fictional,
 * single-arm investigation of a transcatheter aortic valve whose primary
 * endpoint is the VARC-3 early safety composite at 30 days, estimated in the
 * attempted-implant population with an exact 95% interval against a
 * fictional performance goal.
 *
 * It was seeded on 2026-10-27 from CRF Studio's TAVR preset export, with CRF
 * Studio's private extensions removed so any USDM reader sees the same study,
 * and then given what the preset lacks: the valve as a `MedicalDevice`, the
 * analysis populations, the primary estimand with its intercurrent events,
 * and a clinical events committee adjudication scheduled with the adverse
 * event and device deficiency logs at 30 days. This file is now the source;
 * edit it directly. Individual valve units and their UDIs belong in the
 * device specification, not in USDM.
 */
export const TAVR_DEVICE_USDM = tavrDevice as unknown as UsdmV4Document;
