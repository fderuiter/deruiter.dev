[**fderuiter-portfolio**](../../../../../../README.md)

***

[fderuiter-portfolio](../../../../../../modules.md) / [lib/study-data/internal/sdtm/ae-dictionary](../README.md) / HISTORY\_DICTIONARY

# Variable: HISTORY\_DICTIONARY

> `const` **HISTORY\_DICTIONARY**: readonly [`HistoryDictionaryEntry`](../interfaces/HistoryDictionaryEntry.md)[]

Medical history conditions, coded with the same fictional dictionary. They
are kept apart from `AE_DICTIONARY` because the generator draws adverse
events from that list by position, so adding a term there would change
every adverse event drawn after it. A condition's reported name is the
indication the concomitant medication page records for it.
