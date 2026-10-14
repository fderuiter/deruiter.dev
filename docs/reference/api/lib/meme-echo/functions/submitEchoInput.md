[**fderuiter-portfolio**](../../../README.md)

***

[fderuiter-portfolio](../../../modules.md) / [lib/meme-echo](../README.md) / submitEchoInput

# Function: submitEchoInput()

> **submitEchoInput**(`round`, `pad`): [`EchoInputResult`](../interfaces/EchoInputResult.md)

Applies one pad press. Input is taken only in the `input` phase; a pad
outside 0 to 7 counts as a wrong pad. Repeating the whole sequence adds
one to the streak and one pad to the sequence, and returns the round to
`showing` so the vault plays the longer sequence.

## Parameters

### round

[`EchoRound`](../interfaces/EchoRound.md)

### pad

`number`

## Returns

[`EchoInputResult`](../interfaces/EchoInputResult.md)
