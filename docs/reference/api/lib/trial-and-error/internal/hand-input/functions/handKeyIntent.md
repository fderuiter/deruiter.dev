[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/trial-and-error/internal/hand-input](../README.md) / handKeyIntent

# Function: handKeyIntent()

> **handKeyIntent**(`input`, `context`): [`HandIntent`](../type-aliases/HandIntent.md) \| `null`

What a key pressed on a card in hand asks for, or null when the key is not
the Hand's and should keep its default behavior.

Arrows, Home and End rove focus. Alt with an arrow reorders, except during
playback. Every other key acts only on the card itself, without Meta, Ctrl
or Alt, and not during playback. With a seal picked up, Enter or Space
affixes it and Escape puts it back.

## Parameters

### input

[`HandKeyInput`](../interfaces/HandKeyInput.md)

### context

[`HandInputContext`](../interfaces/HandInputContext.md)

## Returns

[`HandIntent`](../type-aliases/HandIntent.md) \| `null`
