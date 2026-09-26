[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/trial-and-error/internal/package](../README.md) / reconcilePackage

# Function: reconcilePackage()

> **reconcilePackage**(`outputs`): [`PackageReport`](../interfaces/PackageReport.md)

Reconciles a CSR package: the outputs in slot order, left to right. Each
slot takes the output at its position and checks, in order, that one is
there, that it carries the slot's CSR stage, that it is current, that it
is validated, that it follows the active SAP and that no finding is open.
The first broken slot names its evidence. Pure.

## Parameters

### outputs

readonly [`PackageEvidence`](../interfaces/PackageEvidence.md)[]

## Returns

[`PackageReport`](../interfaces/PackageReport.md)
