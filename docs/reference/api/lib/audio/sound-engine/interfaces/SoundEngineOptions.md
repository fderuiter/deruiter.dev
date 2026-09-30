[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/audio/sound-engine](../README.md) / SoundEngineOptions

# Interface: SoundEngineOptions

## Properties

### audioContext?

> `optional` **audioContext?**: `AudioContext` \| `null`

Custom AudioContext constructor or instance (useful for dependency injection in testing)

***

### initialMuted?

> `optional` **initialMuted?**: `boolean`

Initial mute state. If omitted, loads from storage or defaults to true

***

### initialVolume?

> `optional` **initialVolume?**: `number`

Initial volume level (0.0 to 1.0). If omitted, loads from storage or defaults to 0.3

***

### storage?

> `optional` **storage?**: `Storage` \| `null`

Custom storage provider (defaults to localStorage through lib/safe-storage when available)
