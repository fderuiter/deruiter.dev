[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/trial-and-error/types](../README.md) / FdaIrSchema

# Variable: FdaIrSchema

> `const` **FdaIrSchema**: `ZodObject`\<\{ `clockHours`: `ZodNumber`; `hands`: `ZodArray`\<`ZodEnum`\<\{ `CSR_STRAIGHT`: `"CSR_STRAIGHT"`; `EFFICACY_FULL_HOUSE`: `"EFFICACY_FULL_HOUSE"`; `HIGH_TABLE`: `"HIGH_TABLE"`; `MEDDRA_FIVE_OF_A_KIND`: `"MEDDRA_FIVE_OF_A_KIND"`; `POPULATION_FLUSH`: `"POPULATION_FLUSH"`; `TLF_PAIR`: `"TLF_PAIR"`; `TLF_TWO_PAIR`: `"TLF_TWO_PAIR"`; \}\>\>; `hours`: `ZodRecord`\<`ZodEnum`\<\{ `DISCARD`: `"DISCARD"`; `INSPECT`: `"INSPECT"`; `PLAY_HAND`: `"PLAY_HAND"`; `TRACE`: `"TRACE"`; \}\>, `ZodNumber`\>; `kind`: `ZodLiteral`\<`"FDA_IR"`\>; `letter`: `ZodOptional`\<`ZodObject`\<\{ `consequence`: `ZodString`; `request`: `ZodString`; \}, `$strip`\>\>; `questions`: `ZodArray`\<`ZodObject`\<\{ `cardId`: `ZodString`; `id`: `ZodString`; `question`: `ZodString`; `quota`: `ZodNumber`; \}, `$strip`\>\>; \}, `$strip`\>

The End-of-Phase-2 FDA Information Request (T&E-10, #921): targeted
questions answered against a deterministic clock. Every move costs hours;
nothing reads the wall clock. Answering every question clears the Blind,
and running out of hours first is a Clinical Hold, which ends the run.
