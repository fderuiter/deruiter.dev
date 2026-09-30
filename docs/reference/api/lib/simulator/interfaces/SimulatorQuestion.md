[**fderuiter-portfolio**](../../../README.md)

***

[fderuiter-portfolio](../../../modules.md) / [lib/simulator](../README.md) / SimulatorQuestion

# Interface: SimulatorQuestion

A single question in the decision tree.

## Properties

### badge

> **badge**: `string`

Stage label shown above the heading.

***

### id

> **id**: [`SimulatorQuestionId`](../type-aliases/SimulatorQuestionId.md)

Stable step identifier, also written to the `step` hash parameter.

***

### options

> **options**: [`SimulatorOption`](SimulatorOption.md)[]

The two answers, in display order. Their index is what the hash stores.

***

### subtitle

> **subtitle**: `string`

The scenario the question poses.

***

### title

> **title**: `string`

Visible heading of the question card.
