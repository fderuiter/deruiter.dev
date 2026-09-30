[**fderuiter-portfolio**](../../../README.md)

***

[fderuiter-portfolio](../../../modules.md) / [lib/simulator](../README.md) / resolveArchetype

# Function: resolveArchetype()

> **resolveArchetype**(`totals`): [`Archetype`](../interfaces/Archetype.md)

Maps axis totals to an archetype. The bias is systems unless UI/UX craft
scored strictly higher; the stance is resilience unless velocity scored
strictly higher. Ties therefore resolve to systems and resilience, so the
result never depends on answer order.

## Parameters

### totals

[`AxisPoints`](../type-aliases/AxisPoints.md)

Raw per-axis totals.

## Returns

[`Archetype`](../interfaces/Archetype.md)

The matching archetype.
