[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/trial-and-error/internal/tutorial](../README.md) / TutorialWait

# Type Alias: TutorialWait

> **TutorialWait** = `null` \| \{ `cardId`: `string`; `kind`: `"INSPECTING"`; \} \| \{ `cardId`: `string`; `col`: `number`; `kind`: `"CELL_REVIEWED"`; `row`: `number`; \} \| \{ `cardId`: `string`; `findingId`: `string`; `kind`: `"CORRECTED"`; \} \| \{ `kind`: `"INSPECT_CLOSED"`; \} \| \{ `cardIds`: `string`[]; `kind`: `"SELECTED"`; \} \| \{ `kind`: `"PLAYED"`; \}

The table outcome a guided step waits for; null waits for Next.
