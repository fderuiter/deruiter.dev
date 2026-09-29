[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/trial-and-error/internal/tutorial](../README.md) / TutorialTarget

# Type Alias: TutorialTarget

> **TutorialTarget** = \{ `kind`: `"NONE"`; \} \| \{ `cardId`: `string`; `kind`: `"CARD"`; \} \| \{ `cardIds`: `string`[]; `kind`: `"CARDS"`; \} \| \{ `col`: `number`; `kind`: `"CELL"`; `row`: `number`; \} \| \{ `kind`: `"CORRECT"`; \} \| \{ `kind`: `"CLOSE_INSPECT"`; \} \| \{ `kind`: `"PLAY"`; \}

What a guided step points at, so the adapter can mark it. `NONE` is a step
with nothing to act on, which the player moves past with Next.
