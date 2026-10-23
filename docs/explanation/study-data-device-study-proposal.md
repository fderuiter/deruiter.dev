# Proposed DEMO-DEV-201 Device Study

Status: design proposal, 2026-10-23. No device study is implemented yet. All participants, device identifiers, readings and events in the proposed demo would be synthetic.

## What this study would show

DEMO-DEV-201 would be a fictional, prospective study of a wrist-worn blood-pressure monitor. Participants would use the investigational monitor alongside a reference cuff at paired measurement sessions. The visitor could follow a performance result and a safety event from the analysis dataset back through SDTM, a collected observation or device log, and the USDM activity that scheduled it.

This is a useful second study because a drug exposure row cannot demonstrate device identity, device replacement, use settings, device deficiencies or the distinction between a device event and a subject adverse event. CDISC's [SDTMIG for Medical Devices v1.1](https://www.cdisc.org/standards/foundational/medical-devices-sdtmig/sdtmig-medical-devices-v1-1) covers device data alongside the human SDTM implementation guide. FDA recognizes [ISO 14155:2020](https://www.accessdata.fda.gov/scripts/cdrh/cfdocs/cfstandards/detail.cfm?standard__identification_no=41711) as a standard addressing the design and conduct of clinical investigations of medical devices; this demo would not claim compliance with it.

## Proposed protocol spine

| Element | Proposal |
| --- | --- |
| Population | Synthetic adults attending repeated blood-pressure measurement sessions. |
| Design | One investigational monitor per participant, paired with a reference cuff. No drug treatment or diagnostic classification endpoint. |
| Visits | Screening; Day 1 fitting and paired measurements; Week 1 and Week 4 paired measurements; safety closeout after use. |
| Primary performance endpoint | Absolute difference between time-matched investigational and reference systolic readings, summarized at the participant level before group summary. |
| Secondary performance endpoint | Proportion of attempted sessions yielding a valid paired reading, with failure reasons visible. |
| Safety endpoints | Adverse device effects by relationship and seriousness; device deficiencies such as failed calibration or power loss, whether or not a subject AE followed. |
| Device lifecycle | Assign synthetic device ID, record each use interval and settings, capture replacement and final disposition. |

The statistical analysis plan must set the pairing tolerance, reference-measurement protocol, handling of invalid readings, performance threshold and safety observation window before any goldens are generated. These are study choices, not values supplied by CDISC.

## Data model and lineage

The synthetic collected layer would separate participant CRF observations from device telemetry and accountability logs. The SDTM layer would use shared subject domains (`DM`, `SV`, `AE`, `VS`, `DS`) plus the medical-device domains needed for this study: device identifiers (`DI`), properties (`DO`), in-use settings (`DU`), exposure (`DX`), device events (`DE`), tracking/disposition (`DT`) and device-subject relationships (`DR`). CDISC describes these domain roles in its [medical-device domain overview](https://www.cdisc.org/sites/default/files/2021-02/Paper_CDISC_EU_Interchange_2020_Carey_Smoak.v4.pdf). A malfunction would be represented as a device event; an injury or other untoward medical occurrence in a participant would also need an AE record when reportable under the study's AE collection rules.

Analysis outputs would include subject-level device assignment and exposure, a BDS performance dataset retaining each paired reading and its pairing decision, an adverse-event occurrence dataset, and a device-deficiency summary. Their final names and variables belong in derivation specifications. The performance result should point to both source measurements and the investigational device ID; a safety result should point to its AE and, when present, a related device event. The shared pipeline's `Dataset` shape and lineage metadata can support that, but its current single `SRCDOM/SRCSEQ` pointer is insufficient for a two-reading performance result. A multi-source lineage record is therefore a design prerequisite, not a reason to overload `SRCSEQ`.

Device identifiers would be visibly fictional, never real serial numbers or patient identifiers. The run manifest would pin the applicable device implementation guide alongside the existing standards and label the entire study synthetic. Adding SDTMIG-MD is a controlled version-profile change under [ADR 0065](../../adr/0065-study-data-pipeline-architecture.md); it should not silently change DEMO-301's pinned output.

## Boundary scenarios for the first implementation

- The investigational device is assigned but never used: no device exposure or performance value is invented.
- A device is replaced mid-study: readings and deficiencies remain linked to the correct unit and interval.
- A calibration failure produces a device event without a participant AE.
- A skin injury produces an AE and a device relationship, with an explicit onset relative to use.
- A reference reading is missing, outside the pairing tolerance or invalid: the investigational reading remains visible but cannot enter a paired performance summary.
- Two candidate reference readings qualify equally: the analysis specification supplies a deterministic tie rule.
- The same seed and protocol produce byte-identical outputs; adding a participant does not reroll prior device assignments or readings.

## Delivery boundary

This document is the first step. A future implementation should start with a separate USDM study definition and synthetic generator, pin and cite SDTMIG-MD, add the required device domains, then define analysis methods and golden files. It should reuse the existing pure pipeline and avoid changing DEMO-301's drug-study derivations. A clinical-device reviewer should confirm the protocol's performance and safety definitions before the runnable scenario is presented as a standards demonstration.
