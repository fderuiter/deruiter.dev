[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/arcade/tutorial](../README.md) / TutorialScript

# Interface: TutorialScript

A game's tutorial.

## Properties

### gameId

> `readonly` **gameId**: `string`

The game's registry slug.

***

### minutes

> `readonly` **minutes**: `number`

About how long it takes, in minutes, for the offer's wording.

***

### steps

> `readonly` **steps**: readonly [`TutorialStep`](TutorialStep.md)[]

***

### version

> `readonly` **version**: `number`

Bump when the script changes enough to be worth offering again: a
player who finished an older version is offered the new one once.
