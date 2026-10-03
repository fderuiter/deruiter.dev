[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/study-director-world/types](../README.md) / TeamHoursHint

# Interface: TeamHoursHint

When a team member's day ends, derived from their workload. A hint for
NPC schedules (#1688) to read; the floor's set dressing uses the same
rule, so the lamps left on and the empty break room agree with who stays.

## Properties

### leavesAt

> **leavesAt**: `number`

Minutes after midnight they go home.

***

### lunchAtDesk

> **lunchAtDesk**: `boolean`

True when they eat lunch at their desk instead of the break room.

***

### memberId

> **memberId**: `string`

***

### staysLate

> **staysLate**: `boolean`

True when they leave after the office day ends.
