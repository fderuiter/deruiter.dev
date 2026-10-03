[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/protocol-drift/internal/engine](../README.md) / createProtocolDriftEngine

# Function: createProtocolDriftEngine()

> **createProtocolDriftEngine**(`options?`): [`ProtocolDriftEngine`](../interfaces/ProtocolDriftEngine.md)

Creates a deterministic Protocol Drift engine. Pass a seed (default 48291)
or options with a seed and scenario ("full" by default; "tracer" is the
Site A tracer bullet from #1091). The engine starts in BRIEF.

## Parameters

### options?

`number` \| [`ProtocolDriftEngineOptions`](../interfaces/ProtocolDriftEngineOptions.md)

## Returns

[`ProtocolDriftEngine`](../interfaces/ProtocolDriftEngine.md)
