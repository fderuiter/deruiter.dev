[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/arcade/daily](../README.md) / ArcadeDailyProgress

# Interface: ArcadeDailyProgress

Everything the Arcade Daily keeps in this browser.

## Properties

### bests

> `readonly` **bests**: `Readonly`\<`Partial`\<`Record`\<[`ArcadeDailyGameId`](../type-aliases/ArcadeDailyGameId.md), `Readonly`\<`Record`\<`string`, [`ArcadeDailyResult`](ArcadeDailyResult.md)\>\>\>\>\>

Best result per game per UTC date.

***

### longest

> `readonly` **longest**: `number`

The longest streak ever reached, in days.

***

### played

> `readonly` **played**: readonly `string`[]

UTC dates with at least one daily played, oldest first, no repeats.

***

### version

> `readonly` **version**: `1`
