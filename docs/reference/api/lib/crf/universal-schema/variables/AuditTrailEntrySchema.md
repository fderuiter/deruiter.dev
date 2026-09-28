[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/crf/universal-schema](../README.md) / AuditTrailEntrySchema

# Variable: AuditTrailEntrySchema

> `const` **AuditTrailEntrySchema**: `ZodObject`\<\{ `changedBy`: `ZodString`; `fieldId`: `ZodString`; `fieldName`: `ZodString`; `formId`: `ZodString`; `id`: `ZodString`; `newValue`: `ZodUnion`\<readonly \[`ZodString`, `ZodNumber`, `ZodBoolean`, `ZodNull`\]\>; `previousValue`: `ZodUnion`\<readonly \[`ZodString`, `ZodNumber`, `ZodBoolean`, `ZodNull`\]\>; `reasonForChange`: `ZodString`; `subjectId`: `ZodString`; `timestamp`: `ZodString`; `userRole`: `ZodEnum`\<\{ `CRA Monitor`: `"CRA Monitor"`; `Data Manager`: `"Data Manager"`; `Principal Investigator`: `"Principal Investigator"`; `Site Coordinator`: `"Site Coordinator"`; \}\>; \}, `$strip`\>
