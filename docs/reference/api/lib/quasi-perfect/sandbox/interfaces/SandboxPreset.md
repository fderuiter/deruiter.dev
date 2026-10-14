[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/quasi-perfect/sandbox](../README.md) / SandboxPreset

# Interface: SandboxPreset

One ready-made Sandbox goal with RAM targets to chase (#2059).

## Properties

### description

> **description**: `string`

***

### goal

> **goal**: [`ASTNode`](../../types/interfaces/ASTNode.md)

***

### goldRamBudget

> **goldRamBudget**: `number`

Gold: prove the goal spending at most this much simulated RAM, in GB.

***

### hypotheses

> **hypotheses**: [`ASTNode`](../../types/interfaces/ASTNode.md)[]

***

### id

> **id**: `string`

Stable key for saved progress; never rename an existing one.

***

### name

> **name**: `string`

***

### referenceProof

> **referenceProof**: readonly [`TacticId`](../../types/type-aliases/TacticId.md)[]

A proof that meets the gold budget, one tactic per step, each applied to
the root goal. The Sandbox tests play it through the tactic engine.

***

### silverRamBudget

> **silverRamBudget**: `number`

Silver: prove the goal spending at most this much simulated RAM, in GB.
