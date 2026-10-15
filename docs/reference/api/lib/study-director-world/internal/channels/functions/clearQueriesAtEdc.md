[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/study-director-world/internal/channels](../README.md) / clearQueriesAtEdc

# Function: clearQueriesAtEdc()

> **clearQueriesAtEdc**(`world`): [`WorldResult`](../../../types/type-aliases/WorldResult.md)\<\{ `cleared`: `number`; `lines`: [`DialogueLine`](../../../types/interfaces/DialogueLine.md)[]; \}\>

Works the query queue at the EDC for forty-five minutes (#2192): answers
or closes the open queries the dashboard shows, the biggest backlog first,
takes a little load off the data manager and adds a little integrity for
each query answered. Only queries a site has entered can be worked, so a
site that hides its problems keeps them. The lock delay and the morning's
routine work also ease as the backlog falls. Refuses when the EDC shows
nothing to work.

## Parameters

### world

[`WorldState`](../../../types/interfaces/WorldState.md)

## Returns

[`WorldResult`](../../../types/type-aliases/WorldResult.md)\<\{ `cleared`: `number`; `lines`: [`DialogueLine`](../../../types/interfaces/DialogueLine.md)[]; \}\>
