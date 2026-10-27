[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/crf/internal/universal-schema](../README.md) / UniversalCrfVisitSchema

# Variable: UniversalCrfVisitSchema

> `const` **UniversalCrfVisitSchema**: `ZodObject`\<\{ `armFormAssignments`: `ZodOptional`\<`ZodRecord`\<`ZodString`, `ZodArray`\<`ZodString`\>\>\>; `armIds`: `ZodOptional`\<`ZodArray`\<`ZodString`\>\>; `assignedFormIds`: `ZodDefault`\<`ZodArray`\<`ZodString`\>\>; `epochId`: `ZodOptional`\<`ZodString`\>; `formIds`: `ZodOptional`\<`ZodArray`\<`ZodString`\>\>; `id`: `ZodString`; `isRepeating`: `ZodOptional`\<`ZodBoolean`\>; `name`: `ZodString`; `oid`: `ZodOptional`\<`ZodString`\>; `repeatMax`: `ZodOptional`\<`ZodNumber`\>; `targetDay`: `ZodDefault`\<`ZodNumber`\>; `timepointDays`: `ZodOptional`\<`ZodNumber`\>; `visitType`: `ZodDefault`\<`ZodEnum`\<\{ `Common`: `"Common"`; `Scheduled`: `"Scheduled"`; `Unscheduled`: `"Unscheduled"`; \}\>\>; `windowAfter`: `ZodDefault`\<`ZodNumber`\>; `windowBefore`: `ZodDefault`\<`ZodNumber`\>; \}, `$strip`\>
