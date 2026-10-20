[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/arcade/input/actions](../README.md) / ActionMap

# Interface: ActionMap\<A\>

A game's actions, made by `defineActions`.

## Type Parameters

### A

`A` *extends* `string` = `string`

## Properties

### actions

> `readonly` **actions**: `Readonly`\<`Record`\<`A`, [`ActionDefinition`](../type-aliases/ActionDefinition.md)\>\>

***

### groups

> `readonly` **groups**: `Readonly`\<`Record`\<`string`, [`ActionGroup`](ActionGroup.md)\>\>

***

### names

> `readonly` **names**: readonly `A`[]

Action names in the order they were defined.
