[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/clinical-trial-chaos/inspection](../README.md) / createInspectionRecord

# Function: createInspectionRecord()

> **createInspectionRecord**(`subject`, `station`, `signature`): [`InspectionRecord`](../interfaces/InspectionRecord.md)

The audit-trail record of a CRF at the moment it locks.

## Parameters

### subject

[`ClinicalSubject`](../../types/interfaces/ClinicalSubject.md)

The CRF as it was locked.

### station

[`CDISCDomain`](../../types/type-aliases/CDISCDomain.md)

The station it was routed to.

### signature

[`InspectionSignature`](../interfaces/InspectionSignature.md)

How it was signed.

## Returns

[`InspectionRecord`](../interfaces/InspectionRecord.md)

The record the inspection can ask about.
