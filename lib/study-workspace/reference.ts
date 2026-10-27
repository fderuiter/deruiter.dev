/**
 * Reference studies every link in the Clinical Study Studio is tested on
 * (epic #3071). DEMO-301, the randomised drug study, lives with the pipeline
 * (`DEMO_301_USDM` in `lib/study-data/presets`); this module holds the
 * two device studies that complement it.
 */
import type { UsdmV4Document } from "@/lib/clinical-standards";
import tavrDevice from "./reference/tavr-device.usdm.json";
import tavrSavr from "./reference/tavr-savr-randomised.usdm.json";

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

/**
 * The randomised TAVR versus SAVR reference study as a USDM v4 document: a
 * fictional two-arm trial, randomised 1:1 in permuted blocks stratified by
 * surgical risk, whose primary endpoint is a hierarchical composite over one
 * year (all-cause death, disabling stroke, valve-related or heart-failure
 * rehospitalisation, then change in quality of life with a 5-point margin)
 * analysed by a stratified win ratio in all randomised participants.
 *
 * It was derived on 2026-10-27 from {@link TAVR_DEVICE_USDM} and shares its
 * forms, visits and valve. USDM v4 has no class for stratification, so the
 * design carries the randomisation characteristics as codes and the ratio
 * and strata in the shared `randomisation` extension. The quality-of-life
 * level uses the Valve Symptom and Function Score, a fictional instrument
 * standing in for a licensed questionnaire. This file is the source; edit it
 * directly.
 */
export const TAVR_SAVR_USDM = tavrSavr as unknown as UsdmV4Document;
