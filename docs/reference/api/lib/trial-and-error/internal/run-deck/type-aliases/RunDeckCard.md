[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/trial-and-error/internal/run-deck](../README.md) / RunDeckCard

# Type Alias: RunDeckCard

> **RunDeckCard** = \{ `entry`: [`ShellEntry`](ShellEntry.md); `id`: `string`; `kind`: `"SHELL"`; \} \| \{ `cardId`: `string`; `id`: `string`; `kind`: `"COPY"`; \}

One card the run added to its deck.

## Union Members

### Type Literal

\{ `entry`: [`ShellEntry`](ShellEntry.md); `id`: `string`; `kind`: `"SHELL"`; \}

A bought shell, or a copy of one: dealt by every later Blind.

***

### Type Literal

\{ `cardId`: `string`; `id`: `string`; `kind`: `"COPY"`; \}

A copy of an authored output: dealt by every later Blind whose own deck
holds `cardId`, beside the original.
