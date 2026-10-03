[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/study-director-world/internal/dressing](../README.md) / workHours

# Function: workHours()

> **workHours**(`workload`): `Omit`\<[`TeamHoursHint`](../../../types/interfaces/TeamHoursHint.md), `"memberId"`\>

The single rule for when someone goes home and where they eat lunch. NPC
schedules (#1688) and the floor's set dressing (#1691) both read it, so
the lamps left on agree with who is still at their desk.

## Parameters

### workload

`number`

## Returns

`Omit`\<[`TeamHoursHint`](../../../types/interfaces/TeamHoursHint.md), `"memberId"`\>
