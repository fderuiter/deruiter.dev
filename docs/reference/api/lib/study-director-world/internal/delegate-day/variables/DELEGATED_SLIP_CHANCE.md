[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/study-director-world/internal/delegate-day](../README.md) / DELEGATED\_SLIP\_CHANCE

# Variable: DELEGATED\_SLIP\_CHANCE

> `const` **DELEGATED\_SLIP\_CHANCE**: `Record`\<[`Urgency`](../../../../study-director/types/type-aliases/Urgency.md), `number`\>

The chance the team lets a message slide when the player delegates the
day (#2092): it then applies its `ifIgnored` fallout. Urgent mail gets
escalated more often, so it slips less.
