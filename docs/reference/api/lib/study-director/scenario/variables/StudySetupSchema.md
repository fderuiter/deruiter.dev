[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/study-director/scenario](../README.md) / StudySetupSchema

# Variable: StudySetupSchema

> `const` **StudySetupSchema**: `ZodObject`\<\{ `budget`: `ZodNumber`; `clinicalPhase`: `ZodString`; `complexity`: `ZodNumber`; `design`: `ZodString`; `durationDays`: `ZodNumber`; `id`: `ZodString`; `protocolMaturity`: `ZodEnum`\<\{ `questionable`: `"questionable"`; `shaky`: `"shaky"`; `solid`: `"solid"`; \}\>; `regulatoryRisk`: `ZodEnum`\<\{ `high`: `"high"`; `low`: `"low"`; `moderate`: `"moderate"`; \}\>; `sponsor`: `ZodObject`\<\{ `archetype`: `ZodEnum`\<\{ `bigPharma`: `"bigPharma"`; `firstTimeBiotech`: `"firstTimeBiotech"`; \}\>; `name`: `ZodString`; \}, `$strip`\>; `subjects`: `ZodNumber`; `title`: `ZodString`; \}, `$strip`\>
