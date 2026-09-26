[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/trial-and-error/internal/timeline](../README.md) / TimelineStep

# Type Alias: TimelineStep

> **TimelineStep** = `object` & \{ `chips`: `number`; `handType`: [`HandType`](../../../types/type-aliases/HandType.md); `kind`: `"HAND_BASE"`; `level`: `number`; `mult`: `number`; \} \| \{ `cardId`: `string`; `chips`: `number`; `kind`: `"CARD_SCORED"`; `mult`: `number`; `retrigger`: `number`; \} \| \{ `chipsDelta`: `number`; `evidence`: `string`; `kind`: `"RULE"`; `multDelta`: `number`; `ruleId`: `string`; \} \| \{ `cardId?`: `string`; `chips`: `number`; `kind`: `"RELIC"`; `mult`: `number`; `name`: `string`; `phase`: `"ON_CARD_SCORED"` \| `"ON_HAND_PLAYED"`; `relicId`: `string`; `xMult`: `number`; \} \| \{ `factor`: `number`; `kind`: `"X_MULT"`; `source`: `string`; \} \| \{ `evidence`: `string`; `kind`: `"ZERO_RULE"`; `label`: `string`; `ruleId`: `string`; \} \| \{ `chips`: `number`; `kind`: `"TOTAL"`; `mult`: `number`; `score`: `number`; \} \| \{ `after`: `number`; `before`: `number`; `crossed`: `boolean`; `kind`: `"BLIND_PROGRESS"`; `target`: `number`; \}

One step of a hand's scoring, in playback order.

## Type Declaration

### running

> **running**: [`TimelineRunning`](../interfaces/TimelineRunning.md)

### text

> **text**: `string`
