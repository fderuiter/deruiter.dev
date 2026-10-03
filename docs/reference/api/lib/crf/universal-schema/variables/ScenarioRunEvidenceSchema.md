[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/crf/universal-schema](../README.md) / ScenarioRunEvidenceSchema

# Variable: ScenarioRunEvidenceSchema

> `const` **ScenarioRunEvidenceSchema**: `ZodObject`\<\{ `dependencies`: `ZodOptional`\<`ZodObject`\<\{ `fingerprints`: `ZodRecord`\<`ZodString`, `ZodString`\>; `version`: `ZodNumber`; \}, `$strip`\>\>; `failed`: `ZodDefault`\<`ZodNumber`\>; `formFingerprint`: `ZodString`; `passed`: `ZodDefault`\<`ZodNumber`\>; `ranAt`: `ZodString`; `results`: `ZodDefault`\<`ZodArray`\<`ZodObject`\<\{ `actualLabel`: `ZodString`; `expectation`: `ZodDiscriminatedUnion`\<\[`ZodObject`\<\{ `expected`: `ZodBoolean`; `fieldId`: `ZodString`; `kind`: `ZodLiteral`\<...\>; \}, `$strip`\>, `ZodObject`\<\{ `expected`: `ZodBoolean`; `fieldId`: `ZodString`; `kind`: `ZodLiteral`\<...\>; \}, `$strip`\>, `ZodObject`\<\{ `expectedStatus`: `ZodEnum`\<...\>; `expectedValue`: `ZodOptional`\<...\>; `fieldId`: `ZodString`; `kind`: `ZodLiteral`\<...\>; \}, `$strip`\>, `ZodObject`\<\{ `expected`: `ZodEnum`\<...\>; `kind`: `ZodLiteral`\<...\>; `ruleId`: `ZodString`; \}, `$strip`\>\], `"kind"`\>; `expectedLabel`: `ZodString`; `satisfied`: `ZodBoolean`; `subjectId`: `ZodString`; `subjectKind`: `ZodEnum`\<\{ `field`: `"field"`; `rule`: `"rule"`; \}\>; \}, `$strip`\>\>\>; \}, `$strip`\>
