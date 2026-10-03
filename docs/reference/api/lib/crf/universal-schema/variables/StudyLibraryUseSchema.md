[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/crf/universal-schema](../README.md) / StudyLibraryUseSchema

# Variable: StudyLibraryUseSchema

> `const` **StudyLibraryUseSchema**: `ZodObject`\<\{ `entryId`: `ZodString`; `entryName`: `ZodString`; `entryVersion`: `ZodNumber`; `formId`: `ZodString`; `id`: `ZodString`; `idMap`: `ZodRecord`\<`ZodString`, `ZodString`\>; `insertedAt`: `ZodString`; `sectionId`: `ZodString`; `upgradeHistory`: `ZodOptional`\<`ZodArray`\<`ZodObject`\<\{ `appliedAt`: `ZodString`; `conflictCount`: `ZodNumber`; `fromVersion`: `ZodNumber`; `incomingChangeCount`: `ZodNumber`; `localCustomizationCount`: `ZodNumber`; `previousIdMap`: `ZodRecord`\<`ZodString`, `ZodString`\>; `previousVariableMap`: `ZodRecord`\<`ZodString`, `ZodString`\>; `resolutions`: `ZodRecord`\<`ZodString`, `ZodEnum`\<\{ `current`: `"current"`; `incoming`: `"incoming"`; \}\>\>; `toVersion`: `ZodNumber`; \}, `$strip`\>\>\>; `variableMap`: `ZodRecord`\<`ZodString`, `ZodString`\>; \}, `$strip`\>

Lineage of a personal-library block inside a study (#681).
