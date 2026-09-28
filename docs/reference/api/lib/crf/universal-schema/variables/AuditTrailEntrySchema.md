[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/crf/universal-schema](../README.md) / AuditTrailEntrySchema

# Variable: AuditTrailEntrySchema

> `const` **AuditTrailEntrySchema**: `ZodObject`\<\{ `action`: `ZodOptional`\<`ZodString`\>; `changedBy`: `ZodString`; `fieldId`: `ZodOptional`\<`ZodString`\>; `fieldName`: `ZodOptional`\<`ZodString`\>; `formId`: `ZodOptional`\<`ZodString`\>; `id`: `ZodString`; `newValue`: `ZodOptional`\<`ZodUnion`\<readonly \[`ZodString`, `ZodNumber`, `ZodBoolean`, `ZodNull`\]\>\>; `previousValue`: `ZodOptional`\<`ZodUnion`\<readonly \[`ZodString`, `ZodNumber`, `ZodBoolean`, `ZodNull`\]\>\>; `reasonForChange`: `ZodOptional`\<`ZodString`\>; `subjectId`: `ZodOptional`\<`ZodString`\>; `targetId`: `ZodOptional`\<`ZodString`\>; `targetType`: `ZodOptional`\<`ZodString`\>; `timestamp`: `ZodString`; `userRole`: `ZodOptional`\<`ZodString`\>; \}, `$strip`\>
