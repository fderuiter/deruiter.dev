[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/crf/internal/universal-schema](../README.md) / ScenarioExpectationSchema

# Variable: ScenarioExpectationSchema

> `const` **ScenarioExpectationSchema**: `ZodDiscriminatedUnion`\<\[`ZodObject`\<\{ `expected`: `ZodBoolean`; `fieldId`: `ZodString`; `kind`: `ZodLiteral`\<`"field_visible"`\>; \}, `$strip`\>, `ZodObject`\<\{ `expected`: `ZodBoolean`; `fieldId`: `ZodString`; `kind`: `ZodLiteral`\<`"field_required"`\>; \}, `$strip`\>, `ZodObject`\<\{ `expectedStatus`: `ZodEnum`\<\{ `cyclic_dependency`: `"cyclic_dependency"`; `division_by_zero`: `"division_by_zero"`; `invalid_unit`: `"invalid_unit"`; `missing_inputs`: `"missing_inputs"`; `success`: `"success"`; `syntax_error`: `"syntax_error"`; \}\>; `expectedValue`: `ZodOptional`\<`ZodNullable`\<`ZodNumber`\>\>; `fieldId`: `ZodString`; `kind`: `ZodLiteral`\<`"calculation"`\>; \}, `$strip`\>, `ZodObject`\<\{ `expected`: `ZodEnum`\<\{ `false`: `"false"`; `incompatible`: `"incompatible"`; `missing`: `"missing"`; `true`: `"true"`; \}\>; `kind`: `ZodLiteral`\<`"rule_result"`\>; `ruleId`: `ZodString`; \}, `$strip`\>\], `"kind"`\>
