[**fderuiter-portfolio**](../../../README.md)

***

[fderuiter-portfolio](../../../modules.md) / [lib/meme-audio](../README.md) / connectMemeAnalyser

# Function: connectMemeAnalyser()

> **connectMemeAnalyser**(): `AnalyserNode` \| `null`

Creates the Meme Vault scope's AnalyserNode on first use and routes the
sound engine's output through it, returning the node (or null when sound is
off or Web Audio is unavailable). Call it from a press handler, before
[playMemeSound](playMemeSound.md): it does nothing while sound is muted or bypassed, so
no AudioContext opens before the visitor has interacted and turned sound
on. Other pages that play meme sounds never call it and keep direct output.

## Returns

`AnalyserNode` \| `null`
