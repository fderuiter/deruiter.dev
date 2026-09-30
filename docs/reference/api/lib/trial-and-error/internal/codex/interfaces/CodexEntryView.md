[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/trial-and-error/internal/codex](../README.md) / CodexEntryView

# Interface: CodexEntryView

One Codex entry as the Codex view shows it.

## Properties

### category

> **category**: `"RELIC"` \| `"GUIDANCE"` \| `"SEAL"` \| `"BOSS"` \| `"CRISIS"` \| `"HAND"` \| `"SPONSOR"`

***

### description

> **description**: `string`

What the entry does.

***

### discovery

> **discovery**: \{ `firstSeen`: \{ `actId`: `string`; `origin?`: \{ `kind`: `"RANDOM"`; \} \| \{ `kind`: `"SEEDED"`; \} \| \{ `date`: `string`; `kind`: `"DAILY"`; \}; `seed`: `string`; \}; `via`: `"BOSS"` \| `"CRISIS"` \| `"SPONSOR"` \| `"SHOP"` \| `"PACK"` \| `"TRAY"` \| `"RACK"` \| `"REWARD"` \| `"PLAYED"`; \} \| `null`

The first-seen run and how, once discovered; null while undiscovered.

***

### flavor

> **flavor**: `string` \| `null`

Flavor text, when the entry has any.

***

### id

> **id**: `string`

***

### name

> **name**: `string`

***

### teaser

> **teaser**: `string`

What an undiscovered entry's silhouette says about it.
