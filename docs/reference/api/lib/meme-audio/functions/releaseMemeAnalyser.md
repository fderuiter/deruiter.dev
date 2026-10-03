[**fderuiter-portfolio**](../../../README.md)

***

[fderuiter-portfolio](../../../modules.md) / [lib/meme-audio](../README.md) / releaseMemeAnalyser

# Function: releaseMemeAnalyser()

> **releaseMemeAnalyser**(): `void`

Takes the scope's analyser out of the sound engine's path, for when the
Meme Vault unmounts. Sounds already in flight finish through it; later
sounds go straight to the speakers.

## Returns

`void`
