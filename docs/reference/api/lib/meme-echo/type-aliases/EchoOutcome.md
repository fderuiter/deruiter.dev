[**fderuiter-portfolio**](../../../README.md)

***

[fderuiter-portfolio](../../../modules.md) / [lib/meme-echo](../README.md) / EchoOutcome

# Type Alias: EchoOutcome

> **EchoOutcome** = `"ignored"` \| `"correct"` \| `"complete"` \| `"fail"`

What a pad press did. `ignored`: the round was not taking input.
`correct`: the right pad, with more of the sequence to go. `complete`: the
whole sequence repeated, so the streak grew and a longer sequence follows.
`fail`: the wrong pad, which ends the round.
