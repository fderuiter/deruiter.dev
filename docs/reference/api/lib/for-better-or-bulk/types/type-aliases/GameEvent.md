[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/for-better-or-bulk/types](../README.md) / GameEvent

# Type Alias: GameEvent

> **GameEvent** = \{ `item`: [`ItemKind`](ItemKind.md); `player`: [`PlayerId`](PlayerId.md); `type`: `"picked-up"`; \} \| \{ `item`: [`ItemKind`](ItemKind.md); `player`: [`PlayerId`](PlayerId.md); `type`: `"put-down"`; \} \| \{ `item`: [`ItemKind`](ItemKind.md); `player`: [`PlayerId`](PlayerId.md); `type`: `"crafted"`; \} \| \{ `item`: [`ItemKind`](ItemKind.md); `station`: `string`; `type`: `"cooked"`; \} \| \{ `station`: `string`; `type`: `"burnt"`; \} \| \{ `category`: [`Category`](Category.md); `player`: [`PlayerId`](PlayerId.md); `target`: `string`; `type`: `"target-filled"`; \} \| \{ `category`: [`Category`](Category.md); `target`: `string`; `type`: `"simplified"`; \} \| \{ `blockedBy`: [`CapabilityId`](CapabilityId.md) \| `null`; `id`: [`InterruptionId`](InterruptionId.md); `player`: [`PlayerId`](PlayerId.md); `type`: `"interruption"`; \} \| \{ `type`: `"brothers-text"`; \} \| \{ `decision`: [`PresenceDecision`](../interfaces/PresenceDecision.md); `type`: `"presence-decided"`; \} \| \{ `type`: `"fred-returned"`; \} \| \{ `type`: `"shoes-retied"`; \} \| \{ `supply`: [`SupplyKind`](SupplyKind.md); `type`: `"supply-empty"`; \} \| \{ `early`: `boolean`; `type`: `"level-finished"`; \}

One-shot things that happened, for sounds, toasts and jokes.
