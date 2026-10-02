[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/trial-and-error/types](../README.md) / CustomScenarioSpecSchema

# Variable: CustomScenarioSpecSchema

> `const` **CustomScenarioSpecSchema**: `ZodObject`\<\{ `cardIds`: `ZodArray`\<`ZodString`\>; `events`: `ZodOptional`\<`ZodArray`\<`ZodObject`\<\{ `afterHands`: `ZodNumber`; `transition`: `ZodObject`\<\{ `change`: `ZodEnum`\<\{ `ENROLL`: `"ENROLL"`; `JOIN`: `"JOIN"`; `LEAVE`: `"LEAVE"`; \}\>; `description`: `ZodString`; `effectiveAt`: `ZodISODateTime`; `id`: `ZodString`; `populations`: `ZodArray`\<`ZodEnum`\<\{ `FAS`: ...; `ITT`: ...; `PER_PROTOCOL`: ...; `SAFETY`: ...; `SCREENED`: ...; \}\>\>; `reason`: `ZodEnum`\<\{ `DROPOUT`: `"DROPOUT"`; `PROTOCOL_AMENDMENT`: `"PROTOCOL_AMENDMENT"`; `PROTOCOL_DEVIATION`: `"PROTOCOL_DEVIATION"`; `SCREEN_FAILURE`: `"SCREEN_FAILURE"`; `SITE_ACTIVATION`: `"SITE_ACTIVATION"`; \}\>; `subject`: `ZodOptional`\<`ZodObject`\<\{ `adverseEvents`: ...; `age`: ...; `arm`: ...; `id`: ...; `populations`: ...; `sex`: ...; \}, `$strip`\>\>; `subjectId`: `ZodString`; \}, `$strip`\>; \}, `$strip`\>\>\>; `id`: `ZodOptional`\<`ZodString`\>; `intro`: `ZodOptional`\<`ZodString`\>; `quota`: `ZodNumber`; `rulebook`: `ZodObject`\<\{ `meanPrecision`: `ZodNumber`; `percentPrecision`: `ZodNumber`; `populationSuit`: `ZodOptional`\<`ZodEnum`\<\{ `FAS`: `"FAS"`; `ITT`: `"ITT"`; `PER_PROTOCOL`: `"PER_PROTOCOL"`; `SAFETY`: `"SAFETY"`; `SCREENED`: `"SCREENED"`; \}\>\>; `roundingMode`: `ZodEnum`\<\{ `HALF_AWAY_FROM_ZERO`: `"HALF_AWAY_FROM_ZERO"`; `HALF_EVEN`: `"HALF_EVEN"`; `TRUNCATE`: `"TRUNCATE"`; \}\>; \}, `$strip`\>; `startingCpu`: `ZodNumber`; `summary`: `ZodOptional`\<`ZodString`\>; `title`: `ZodString`; \}, `$strip`\>

A custom scenario specification created in the Deck Builder or imported.
Supports custom card decks, study quota, starting CPU, rulebook settings,
and protocol events.
