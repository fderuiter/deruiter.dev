[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/arcade/tutorial](../README.md) / validateTutorialScript

# Function: validateTutorialScript()

> **validateTutorialScript**(`script`): `string`[]

The problems with a script, for its unit test: no steps, a step id used
twice, empty text, or a practice with no signal.

## Parameters

### script

[`TutorialScript`](../interfaces/TutorialScript.md)

The script to check.

## Returns

`string`[]

One message per problem; empty when the script is sound.
