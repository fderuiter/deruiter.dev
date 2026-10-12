[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/for-better-or-bulk/types](../README.md) / GameEvent

# Type Alias: GameEvent

> **GameEvent** = \{ `item`: [`ItemKind`](ItemKind.md); `player`: [`PlayerId`](PlayerId.md); `type`: `"picked-up"`; \} \| \{ `item`: [`ItemKind`](ItemKind.md); `player`: [`PlayerId`](PlayerId.md); `type`: `"put-down"`; \} \| \{ `item`: [`ItemKind`](ItemKind.md); `player`: [`PlayerId`](PlayerId.md); `type`: `"crafted"`; \} \| \{ `item`: [`ItemKind`](ItemKind.md); `station`: `string`; `type`: `"cooked"`; \} \| \{ `item`: [`ItemKind`](ItemKind.md); `station`: `string`; `type`: `"burnt"`; \} \| \{ `player`: [`PlayerId`](PlayerId.md); `supply`: [`SupplyKind`](SupplyKind.md); `type`: `"restocked"`; \} \| \{ `category`: [`Category`](Category.md); `player`: [`PlayerId`](PlayerId.md); `target`: `string`; `type`: `"target-filled"`; \} \| \{ `category`: [`Category`](Category.md); `target`: `string`; `type`: `"simplified"`; \} \| \{ `blockedBy`: [`CapabilityId`](CapabilityId.md) \| `null`; `id`: [`InterruptionId`](InterruptionId.md); `player`: [`PlayerId`](PlayerId.md); `type`: `"interruption"`; \} \| \{ `item`: [`ItemKind`](ItemKind.md); `player`: [`PlayerId`](PlayerId.md); `type`: `"thrown-out"`; \} \| \{ `player`: [`PlayerId`](PlayerId.md); `type`: `"floor-full"`; \} \| \{ `type`: `"brothers-text"`; \} \| \{ `decision`: [`PresenceDecision`](../interfaces/PresenceDecision.md); `type`: `"presence-decided"`; \} \| \{ `type`: `"fred-returned"`; \} \| \{ `type`: `"shoes-retied"`; \} \| \{ `supply`: [`SupplyKind`](SupplyKind.md); `type`: `"supply-empty"`; \} \| \{ `id`: [`SeededEventId`](SeededEventId.md); `type`: `"seeded-start"`; \} \| \{ `id`: [`SeededEventId`](SeededEventId.md); `type`: `"seeded-end"`; \} \| \{ `allSet`: `boolean`; `early`: `boolean`; `type`: `"level-finished"`; \}

One-shot things that happened, for sounds, toasts and jokes.

## Union Members

### Type Literal

\{ `item`: [`ItemKind`](ItemKind.md); `player`: [`PlayerId`](PlayerId.md); `type`: `"picked-up"`; \}

***

### Type Literal

\{ `item`: [`ItemKind`](ItemKind.md); `player`: [`PlayerId`](PlayerId.md); `type`: `"put-down"`; \}

***

### Type Literal

\{ `item`: [`ItemKind`](ItemKind.md); `player`: [`PlayerId`](PlayerId.md); `type`: `"crafted"`; \}

***

### Type Literal

\{ `item`: [`ItemKind`](ItemKind.md); `station`: `string`; `type`: `"cooked"`; \}

***

### Type Literal

\{ `item`: [`ItemKind`](ItemKind.md); `station`: `string`; `type`: `"burnt"`; \}

***

### Type Literal

\{ `player`: [`PlayerId`](PlayerId.md); `supply`: [`SupplyKind`](SupplyKind.md); `type`: `"restocked"`; \}

***

### Type Literal

\{ `category`: [`Category`](Category.md); `player`: [`PlayerId`](PlayerId.md); `target`: `string`; `type`: `"target-filled"`; \}

***

### Type Literal

\{ `category`: [`Category`](Category.md); `target`: `string`; `type`: `"simplified"`; \}

***

### Type Literal

\{ `blockedBy`: [`CapabilityId`](CapabilityId.md) \| `null`; `id`: [`InterruptionId`](InterruptionId.md); `player`: [`PlayerId`](PlayerId.md); `type`: `"interruption"`; \}

***

### Type Literal

\{ `item`: [`ItemKind`](ItemKind.md); `player`: [`PlayerId`](PlayerId.md); `type`: `"thrown-out"`; \}

***

### Type Literal

\{ `player`: [`PlayerId`](PlayerId.md); `type`: `"floor-full"`; \}

***

### Type Literal

\{ `type`: `"brothers-text"`; \}

***

### Type Literal

\{ `decision`: [`PresenceDecision`](../interfaces/PresenceDecision.md); `type`: `"presence-decided"`; \}

***

### Type Literal

\{ `type`: `"fred-returned"`; \}

***

### Type Literal

\{ `type`: `"shoes-retied"`; \}

***

### Type Literal

\{ `supply`: [`SupplyKind`](SupplyKind.md); `type`: `"supply-empty"`; \}

***

### Type Literal

\{ `id`: [`SeededEventId`](SeededEventId.md); `type`: `"seeded-start"`; \}

***

### Type Literal

\{ `id`: [`SeededEventId`](SeededEventId.md); `type`: `"seeded-end"`; \}

***

### Type Literal

\{ `allSet`: `boolean`; `early`: `boolean`; `type`: `"level-finished"`; \}

#### allSet

> `readonly` **allSet**: `boolean`

Every planned target was done before 4:00.

#### early

> `readonly` **early**: `boolean`

Done in time for the "Everything set by 3:00" challenge.

#### type

> `readonly` **type**: `"level-finished"`
