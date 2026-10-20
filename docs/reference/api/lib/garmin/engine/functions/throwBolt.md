[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/garmin/engine](../README.md) / throwBolt

# Function: throwBolt()

> **throwBolt**(`state`): [`GameEngineState`](../interfaces/GameEngineState.md)

Throws a heat bolt forward from the runner's hand. Only a Heat Map runner
can throw, at most [BOLT\_COOLDOWN\_MS](../../powerups/variables/BOLT_COOLDOWN_MS.md) apart and with no more than
two bolts on the face; otherwise the state is returned unchanged.

## Parameters

### state

[`GameEngineState`](../interfaces/GameEngineState.md)

## Returns

[`GameEngineState`](../interfaces/GameEngineState.md)
