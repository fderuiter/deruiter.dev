[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/trial-and-error/types](../README.md) / DeviationEventSchema

# Variable: DeviationEventSchema

> `const` **DeviationEventSchema**: `ZodObject`\<\{ `afterHands`: `ZodArray`\<`ZodNumber`\>; `flavor`: `ZodString`; `id`: `ZodString`; `name`: `ZodString`; `transition`: `ZodObject`\<\{ `change`: `ZodEnum`\<\{ `ENROLL`: `"ENROLL"`; `JOIN`: `"JOIN"`; `LEAVE`: `"LEAVE"`; \}\>; `description`: `ZodString`; `effectiveAt`: `ZodISODateTime`; `id`: `ZodString`; `populations`: `ZodArray`\<`ZodEnum`\<\{ `FAS`: `"FAS"`; `ITT`: `"ITT"`; `PER_PROTOCOL`: `"PER_PROTOCOL"`; `SAFETY`: `"SAFETY"`; `SCREENED`: `"SCREENED"`; \}\>\>; `reason`: `ZodEnum`\<\{ `DROPOUT`: `"DROPOUT"`; `PROTOCOL_AMENDMENT`: `"PROTOCOL_AMENDMENT"`; `PROTOCOL_DEVIATION`: `"PROTOCOL_DEVIATION"`; `SCREEN_FAILURE`: `"SCREEN_FAILURE"`; `SITE_ACTIVATION`: `"SITE_ACTIVATION"`; \}\>; `subject`: `ZodOptional`\<`ZodObject`\<\{ `adverseEvents`: `ZodOptional`\<`ZodArray`\<`ZodObject`\<\{ `grade`: ...; `ledToDiscontinuation`: ...; `serious`: ...; `soc`: ...; `term`: ...; \}, `$strip`\>\>\>; `age`: `ZodNumber`; `arm`: `ZodEnum`\<\{ `ACTIVE`: `"ACTIVE"`; `PLACEBO`: `"PLACEBO"`; \}\>; `id`: `ZodString`; `populations`: `ZodArray`\<`ZodEnum`\<\{ `FAS`: `"FAS"`; `ITT`: `"ITT"`; `PER_PROTOCOL`: `"PER_PROTOCOL"`; `SAFETY`: `"SAFETY"`; `SCREENED`: `"SCREENED"`; \}\>\>; `sex`: `ZodEnum`\<\{ `F`: `"F"`; `M`: `"M"`; \}\>; \}, `$strip`\>\>; `subjectId`: `ZodString`; \}, `$strip`\>; \}, `$strip`\>

A protocol deviation (#1087): a seeded mid-Blind event that finds a
subject out of line with the protocol and removes them from (or returns
them to) analysis populations. The run's draw decides whether one fires in
a Blind and after which of `afterHands` it lands. The transition's
`effectiveAt` is replaced when it fires: it lands a day after the current
snapshot, so study time only moves forward.
