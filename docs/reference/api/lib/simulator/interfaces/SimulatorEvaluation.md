[**fderuiter-portfolio**](../../../README.md)

***

[fderuiter-portfolio](../../../modules.md) / [lib/simulator](../README.md) / SimulatorEvaluation

# Interface: SimulatorEvaluation

The scored result of a completed path.

## Properties

### archetype

> **archetype**: [`Archetype`](Archetype.md)

The archetype the path maps to.

***

### leadAxis

> **leadAxis**: [`SimulatorAxis`](../type-aliases/SimulatorAxis.md)

The axis with the highest stat, ties broken in [SIMULATOR\_AXES](../variables/SIMULATOR_AXES.md) order.

***

### stats

> **stats**: [`AxisPoints`](../type-aliases/AxisPoints.md)

Each axis as a whole-number share (0 to 100) of its maximum over the tree.

***

### totals

> **totals**: [`AxisPoints`](../type-aliases/AxisPoints.md)

Raw points accumulated on each axis.
