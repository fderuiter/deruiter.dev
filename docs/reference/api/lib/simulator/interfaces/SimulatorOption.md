[**fderuiter-portfolio**](../../../README.md)

***

[fderuiter-portfolio](../../../modules.md) / [lib/simulator](../README.md) / SimulatorOption

# Interface: SimulatorOption

One selectable answer in a simulator question.

## Properties

### description

> **description**: `string`

The technical trade-off the option commits to.

***

### nextStep

> **nextStep**: [`SimulatorStepId`](../type-aliases/SimulatorStepId.md)

The step reached after choosing the option.

***

### points

> **points**: [`AxisPoints`](../type-aliases/AxisPoints.md)

Points added to each axis when the option is chosen.

***

### text

> **text**: `string`

Short option label shown as the button's accessible name.
