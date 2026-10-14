[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/trial-and-error/types](../README.md) / DmcDefenseSchema

# Variable: DmcDefenseSchema

> `const` **DmcDefenseSchema**: `ZodObject`\<\{ `kind`: `ZodLiteral`\<`"DMC_DEFENSE"`\>; `rewards`: `ZodArray`\<`ZodObject`\<\{ `description`: `ZodString`; `id`: `ZodString`; `modifier`: `ZodObject`\<\{ `chips`: `ZodNumber`; `label`: `ZodString`; `plusMult`: `ZodNumber`; `sourceId`: `ZodString`; `xMult`: `ZodNumber`; \}, `$strip`\>; `name`: `ZodString`; `rarity`: `ZodOptional`\<`ZodEnum`\<\{ `COMMON`: `"COMMON"`; `RARE`: `"RARE"`; `UNCOMMON`: `"UNCOMMON"`; \}\>\>; `trigger`: `ZodOptional`\<`ZodDiscriminatedUnion`\<\[`ZodObject`\<\{ `phase`: `ZodLiteral`\<...\>; `requires`: `ZodOptional`\<...\>; `scale`: `ZodOptional`\<...\>; \}, `$strip`\>, `ZodObject`\<\{ `cardType`: `ZodOptional`\<...\>; `phase`: `ZodLiteral`\<...\>; `population`: `ZodOptional`\<...\>; `qcPassedOnly`: `ZodOptional`\<...\>; `retrigger`: `ZodOptional`\<...\>; \}, `$strip`\>, `ZodObject`\<\{ `freeDiscards`: `ZodOptional`\<...\>; `phase`: `ZodLiteral`\<...\>; `stacks`: `ZodOptional`\<...\>; \}, `$strip`\>, `ZodObject`\<\{ `cpu`: `ZodNumber`; `cpuPerAct`: `ZodOptional`\<...\>; `phase`: `ZodLiteral`\<...\>; \}, `$strip`\>\], `"phase"`\>\>; \}, `$strip`\>\>; `stages`: `ZodTuple`\<\[`ZodObject`\<\{ `hands`: `ZodArray`\<`ZodEnum`\<\{ `CSR_STRAIGHT`: `"CSR_STRAIGHT"`; `EFFICACY_FULL_HOUSE`: `"EFFICACY_FULL_HOUSE"`; `HIGH_TABLE`: `"HIGH_TABLE"`; `MEDDRA_FIVE_OF_A_KIND`: `"MEDDRA_FIVE_OF_A_KIND"`; `POPULATION_FLUSH`: `"POPULATION_FLUSH"`; `TLF_PAIR`: `"TLF_PAIR"`; `TLF_TWO_PAIR`: `"TLF_TWO_PAIR"`; \}\>\>; `name`: `ZodString`; `quota`: `ZodNumber`; `session`: `ZodEnum`\<\{ `CLOSED`: `"CLOSED"`; `OPEN`: `"OPEN"`; \}\>; \}, `$strip`\>, `ZodObject`\<\{ `hands`: `ZodArray`\<`ZodEnum`\<\{ `CSR_STRAIGHT`: `"CSR_STRAIGHT"`; `EFFICACY_FULL_HOUSE`: `"EFFICACY_FULL_HOUSE"`; `HIGH_TABLE`: `"HIGH_TABLE"`; `MEDDRA_FIVE_OF_A_KIND`: `"MEDDRA_FIVE_OF_A_KIND"`; `POPULATION_FLUSH`: `"POPULATION_FLUSH"`; `TLF_PAIR`: `"TLF_PAIR"`; `TLF_TWO_PAIR`: `"TLF_TWO_PAIR"`; \}\>\>; `name`: `ZodString`; `quota`: `ZodNumber`; `session`: `ZodEnum`\<\{ `CLOSED`: `"CLOSED"`; `OPEN`: `"OPEN"`; \}\>; \}, `$strip`\>\], `null`\>; \}, `$strip`\>

The DMC milestone defense (T&E-09): an open-session package played from
the blinded study team's seat, then a closed-session package from the
independent statistician's seat. Defending both earns a choice of relics.
