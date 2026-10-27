[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/study-workspace/reference](../README.md) / TAVR\_DEVICE\_USDM

# Variable: TAVR\_DEVICE\_USDM

> `const` **TAVR\_DEVICE\_USDM**: [`UsdmV4Document`](../../../clinical-standards/usdm-v4-types/interfaces/UsdmV4Document.md)

The TAVR device reference study as a USDM v4 document: a fictional,
single-arm investigation of a transcatheter aortic valve whose primary
endpoint is the VARC-3 early safety composite at 30 days, estimated in the
attempted-implant population with an exact 95% interval against a
fictional performance goal.

It was seeded on 2026-10-27 from CRF Studio's TAVR preset export, with CRF
Studio's private extensions removed so any USDM reader sees the same study,
and then given what the preset lacks: the valve as a `MedicalDevice`, the
analysis populations, the primary estimand with its intercurrent events,
and a clinical events committee adjudication scheduled with the adverse
event and device deficiency logs at 30 days. This file is now the source;
edit it directly. Individual valve units and their UDIs belong in the
device specification, not in USDM.
