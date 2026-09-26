[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/trial-and-error/internal/run](../README.md) / RunAction

# Type Alias: RunAction

> **RunAction** = `Exclude`\<[`TableAction`](../../table/type-aliases/TableAction.md), \{ `type`: `"RESET"`; \}\> \| \{ `type`: `"NEXT_BLIND"`; \} \| \{ `type`: `"CASH_OUT"`; \} \| \{ `type`: `"REROLL"`; \} \| \{ `slot`: `number`; `type`: `"BUY"`; \} \| \{ `slot`: `number`; `type`: `"BUY_PACK"`; \} \| \{ `cardId`: `string`; `type`: `"PICK_PACK_CARD"`; \} \| \{ `type`: `"SKIP_PACK"`; \} \| \{ `relicId`: `string`; `type`: `"SELL_RELIC"`; \} \| \{ `type`: `"CONTINUE_ENDLESS"`; \} \| \{ `type`: `"END_RUN"`; \} \| \{ `seed?`: `string`; `type`: `"RESTART_RUN"`; \}

Player intents the run reducer accepts. Every Card Table action except
RESET passes through to the current Blind; a lost Blind ends the run, so
the only way back is RESTART_RUN.

## Union Members

`Exclude`\<[`TableAction`](../../table/type-aliases/TableAction.md), \{ `type`: `"RESET"`; \}\>

***

### Type Literal

\{ `type`: `"NEXT_BLIND"`; \}

***

### Type Literal

\{ `type`: `"CASH_OUT"`; \}

Collects the cleared Blind's payout and opens the shop.

***

### Type Literal

\{ `type`: `"REROLL"`; \}

Redraws the shop's single slots for the escalating reroll price.

***

### Type Literal

\{ `slot`: `number`; `type`: `"BUY"`; \}

Buys the item in a single slot.

***

### Type Literal

\{ `slot`: `number`; `type`: `"BUY_PACK"`; \}

Buys and opens the booster pack in a pack slot.

***

### Type Literal

\{ `cardId`: `string`; `type`: `"PICK_PACK_CARD"`; \}

Keeps one card of the pack being opened.

***

### Type Literal

\{ `type`: `"SKIP_PACK"`; \}

Leaves the pack being opened; its remaining picks are forfeit.

***

### Type Literal

\{ `relicId`: `string`; `type`: `"SELL_RELIC"`; \}

Sells a relic for half its price, rounded down.

***

### Type Literal

\{ `type`: `"CONTINUE_ENDLESS"`; \}

After the campaign is won, goes on into post-marketing rounds (#1088).

***

### Type Literal

\{ `type`: `"END_RUN"`; \}

After the campaign is won, submits the package and ends the run.

***

### Type Literal

\{ `seed?`: `string`; `type`: `"RESTART_RUN"`; \}

A new run: with `seed`, a new seed; without, a replay of this one.
