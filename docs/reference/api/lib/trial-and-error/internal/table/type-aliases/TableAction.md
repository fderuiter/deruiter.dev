[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/trial-and-error/internal/table](../README.md) / TableAction

# Type Alias: TableAction

> **TableAction** = \{ `cardId`: `string`; `type`: `"TOGGLE_SELECT"`; \} \| \{ `type`: `"PLAY_HAND"`; \} \| \{ `type`: `"DISCARD"`; \} \| \{ `cardId`: `string`; `type`: `"INSPECT_CARD"`; \} \| \{ `type`: `"CLOSE_INSPECT"`; \} \| \{ `col`: `number`; `row`: `number`; `type`: `"INSPECT_CELL"`; \} \| \{ `findingId`: `string`; `type`: `"CORRECT_FINDING"`; \} \| \{ `col`: `number`; `row`: `number`; `type`: `"TRACE_CELL"`; \} \| \{ `cardId`: `string`; `toIndex`: `number`; `type`: `"MOVE_CARD"`; \} \| \{ `cardId`: `string`; `type`: `"RECOMPILE"`; \} \| \{ `cardId`: `string`; `population`: [`PopulationType`](../../../types/type-aliases/PopulationType.md); `type`: `"ALLOCATE"`; \} \| \{ `cardId`: `string`; `consumableId`: `string`; `type`: `"APPLY_SEAL"`; \} \| \{ `consumableId`: `string`; `type`: `"SELL_CONSUMABLE"`; \} \| \{ `consumableId`: `string`; `type`: `"USE_GUIDANCE"`; \} \| \{ `choiceId`: `string`; `type`: `"RESOLVE_CRISIS"`; \} \| \{ `cardId`: `string`; `type`: `"STRUCTURAL_QC"`; \} \| \{ `cardId`: `string`; `type`: `"PEEK_BLINDED"`; \} \| \{ `session`: [`DmcSession`](../../blinding/type-aliases/DmcSession.md); `type`: `"SET_SESSION"`; \} \| \{ `relicId`: `string`; `type`: `"CLAIM_RELIC"`; \} \| \{ `type`: `"AMEND_PROTOCOL"`; \} \| \{ `type`: `"RESET"`; \}

Player intents the Card Table reducer accepts.

## Union Members

### Type Literal

\{ `cardId`: `string`; `type`: `"TOGGLE_SELECT"`; \}

***

### Type Literal

\{ `type`: `"PLAY_HAND"`; \}

***

### Type Literal

\{ `type`: `"DISCARD"`; \}

***

### Type Literal

\{ `cardId`: `string`; `type`: `"INSPECT_CARD"`; \}

***

### Type Literal

\{ `type`: `"CLOSE_INSPECT"`; \}

***

### Type Literal

\{ `col`: `number`; `row`: `number`; `type`: `"INSPECT_CELL"`; \}

***

### Type Literal

\{ `findingId`: `string`; `type`: `"CORRECT_FINDING"`; \}

***

### Type Literal

\{ `col`: `number`; `row`: `number`; `type`: `"TRACE_CELL"`; \}

Traces a flagged cell of the inspected Table to its Listing rows. Free.

***

### Type Literal

\{ `cardId`: `string`; `toIndex`: `number`; `type`: `"MOVE_CARD"`; \}

Cosmetic: moves a card within the hand. Costs nothing.

***

### Type Literal

\{ `cardId`: `string`; `type`: `"RECOMPILE"`; \}

Reruns a stale output against the current snapshot.

***

### Type Literal

\{ `cardId`: `string`; `population`: [`PopulationType`](../../../types/type-aliases/PopulationType.md); `type`: `"ALLOCATE"`; \}

Allocates an analysis set to a blank shell, which compiles it. Free and final.

***

### Type Literal

\{ `cardId`: `string`; `consumableId`: `string`; `type`: `"APPLY_SEAL"`; \}

Affixes a footnote seal from the tray to a card. Free; uses the seal up.

***

### Type Literal

\{ `consumableId`: `string`; `type`: `"SELL_CONSUMABLE"`; \}

Sells a tray consumable for its sell value.

***

### Type Literal

\{ `consumableId`: `string`; `type`: `"USE_GUIDANCE"`; \}

Uses a Guidance card from the tray: its hand levels up for the run.

***

### Type Literal

\{ `choiceId`: `string`; `type`: `"RESOLVE_CRISIS"`; \}

Answers the Blind's crisis with one of its choices.

***

### Type Literal

\{ `cardId`: `string`; `type`: `"STRUCTURAL_QC"`; \}

Structural QC of a face-down output: shape and format, no values.

***

### Type Literal

\{ `cardId`: `string`; `type`: `"PEEK_BLINDED"`; \}

Views a face-down output without DMC authorization: a blinding violation.
Logged, and the next hand played scores ×0.

***

### Type Literal

\{ `session`: [`DmcSession`](../../blinding/type-aliases/DmcSession.md); `type`: `"SET_SESSION"`; \}

Moves to the other DMC session under the scenario's charter.

***

### Type Literal

\{ `relicId`: `string`; `type`: `"CLAIM_RELIC"`; \}

Takes one relic from a defended encounter's reward.

***

### Type Literal

\{ `type`: `"AMEND_PROTOCOL"`; \}

Files a formal protocol amendment against a locked CSR package: the lock
breaks, the lock hand is withdrawn and its outputs' reviews are
invalidated until they are validated again.

***

### Type Literal

\{ `type`: `"RESET"`; \}
