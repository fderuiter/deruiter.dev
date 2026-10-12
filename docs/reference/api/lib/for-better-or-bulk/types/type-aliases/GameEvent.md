[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/for-better-or-bulk/types](../README.md) / GameEvent

# Type Alias: GameEvent

> **GameEvent** = \{ `item`: [`ItemKind`](ItemKind.md); `player`: [`PlayerId`](PlayerId.md); `type`: `"picked-up"`; \} \| \{ `item`: [`ItemKind`](ItemKind.md); `player`: [`PlayerId`](PlayerId.md); `type`: `"put-down"`; \} \| \{ `item`: [`ItemKind`](ItemKind.md); `player`: [`PlayerId`](PlayerId.md); `type`: `"crafted"`; \} \| \{ `item`: [`ItemKind`](ItemKind.md); `station`: `string`; `type`: `"cooked"`; \} \| \{ `item`: [`ItemKind`](ItemKind.md); `station`: `string`; `type`: `"burnt"`; \} \| \{ `player`: [`PlayerId`](PlayerId.md); `supply`: [`SupplyKind`](SupplyKind.md); `type`: `"restocked"`; \} \| \{ `category`: [`Category`](Category.md); `player`: [`PlayerId`](PlayerId.md); `target`: `string`; `type`: `"target-filled"`; \} \| \{ `category`: [`Category`](Category.md); `target`: `string`; `type`: `"simplified"`; \} \| \{ `blockedBy`: [`CapabilityId`](CapabilityId.md) \| `null`; `id`: [`InterruptionId`](InterruptionId.md); `player`: [`PlayerId`](PlayerId.md); `type`: `"interruption"`; \} \| \{ `item`: [`ItemKind`](ItemKind.md); `player`: [`PlayerId`](PlayerId.md); `type`: `"thrown-out"`; \} \| \{ `player`: [`PlayerId`](PlayerId.md); `type`: `"floor-full"`; \} \| \{ `type`: `"brothers-text"`; \} \| \{ `decision`: [`PresenceDecision`](../interfaces/PresenceDecision.md); `type`: `"presence-decided"`; \} \| \{ `type`: `"fred-returned"`; \} \| \{ `type`: `"shoes-retied"`; \} \| \{ `supply`: [`SupplyKind`](SupplyKind.md); `type`: `"supply-empty"`; \} \| \{ `id`: [`SeededEventId`](SeededEventId.md); `type`: `"seeded-start"`; \} \| \{ `id`: [`SeededEventId`](SeededEventId.md); `type`: `"seeded-end"`; \} \| \{ `early`: `boolean`; `type`: `"level-finished"`; \}

One-shot things that happened, for sounds, toasts and jokes.
