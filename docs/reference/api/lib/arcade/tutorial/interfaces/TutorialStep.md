[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/arcade/tutorial](../README.md) / TutorialStep

# Interface: TutorialStep

One step of a tutorial.

## Properties

### body

> `readonly` **body**: `string`

One or two sentences: what to do and why it matters.

***

### chapter

> `readonly` **chapter**: `string`

The chapter the step belongs to, shown above its title.

***

### id

> `readonly` **id**: `string`

Stable key, unique in the script; games read it to stage a step.

***

### keys?

> `readonly` `optional` **keys?**: `string`

The keyboard and mouse control, such as "W A S D".

***

### practice?

> `readonly` `optional` **practice?**: [`TutorialPractice`](TutorialPractice.md)

Present on a practice step.

***

### target?

> `readonly` `optional` **target?**: `string`

The control the step points at: the value of a `data-tutorial-target`
attribute inside the cabinet. A step without one, or whose target is not
on screen, docks its card instead.

***

### title

> `readonly` **title**: `string`

A few words.

***

### touch?

> `readonly` `optional` **touch?**: `string`

The touch control, shown in place of `keys` on a touch cabinet.
