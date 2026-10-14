[**fderuiter-portfolio**](../../../README.md)

***

[fderuiter-portfolio](../../../modules.md) / [lib/meme-audio](../README.md) / unlockMemeAudio

# Function: unlockMemeAudio()

> **unlockMemeAudio**(): `void`

Resumes the sound engine's AudioContext if the browser left it suspended.
Call it from a tap or click handler: iPadOS Safari lets audio start only
from a gesture it accepts, and a touch pointerdown is not one, so the click
or pointerup of the first tap is where a suspended context wakes. It opens
no context while sound is muted or bypassed.

## Returns

`void`
