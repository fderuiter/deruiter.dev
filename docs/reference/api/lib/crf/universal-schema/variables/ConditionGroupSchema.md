[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/crf/universal-schema](../README.md) / ConditionGroupSchema

# Variable: ConditionGroupSchema

> `const` **ConditionGroupSchema**: `ZodObject`\<\{ `conditions`: `ZodArray`\<`ZodObject`\<\{ `compareFieldId`: `ZodOptional`\<`ZodString`\>; `crossVisitId`: `ZodOptional`\<`ZodString`\>; `fieldId`: `ZodString`; `operator`: `ZodEnum`\<\{ `contains`: `"contains"`; `eq`: `"eq"`; `gt`: `"gt"`; `gte`: `"gte"`; `in`: `"in"`; `is_empty`: `"is_empty"`; `is_not_empty`: `"is_not_empty"`; `lt`: `"lt"`; `lte`: `"lte"`; `neq`: `"neq"`; \}\>; `value`: `ZodUnion`\<readonly \[`ZodString`, `ZodNumber`, `ZodBoolean`, `ZodArray`\<`ZodString`\>\]\>; \}, `$strip`\>\>; `id`: `ZodString`; `logicalOperator`: `ZodEnum`\<\{ `AND`: `"AND"`; `OR`: `"OR"`; \}\>; \}, `$strip`\>
