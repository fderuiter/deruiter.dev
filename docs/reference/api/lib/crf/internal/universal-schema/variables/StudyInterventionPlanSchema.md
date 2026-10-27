[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/crf/internal/universal-schema](../README.md) / StudyInterventionPlanSchema

# Variable: StudyInterventionPlanSchema

> `const` **StudyInterventionPlanSchema**: `ZodObject`\<\{ `administrationFormIds`: `ZodOptional`\<`ZodArray`\<`ZodString`\>\>; `armIds`: `ZodOptional`\<`ZodArray`\<`ZodString`\>\>; `description`: `ZodOptional`\<`ZodString`\>; `id`: `ZodString`; `name`: `ZodString`; `procedure`: `ZodOptional`\<`ZodObject`\<\{ `code`: `ZodString`; `name`: `ZodString`; \}, `$strip`\>\>; `role`: `ZodEnum`\<\{ `Active Comparator`: `"Active Comparator"`; `Experimental Intervention`: `"Experimental Intervention"`; `Placebo`: `"Placebo"`; \}\>; `type`: `ZodEnum`\<\{ `Biologic`: `"Biologic"`; `Device`: `"Device"`; `Drug`: `"Drug"`; \}\>; \}, `$strip`\>
