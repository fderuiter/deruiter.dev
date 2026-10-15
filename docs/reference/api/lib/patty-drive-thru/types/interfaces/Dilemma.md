[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/patty-drive-thru/types](../README.md) / Dilemma

# Interface: Dilemma

A dilemma as written: the prompt, two answers and the default.

## Properties

### defaultOptionId

> `readonly` **defaultOptionId**: `string`

The option taken when the timer runs out.

***

### id

> `readonly` **id**: [`DilemmaId`](../type-aliases/DilemmaId.md)

***

### options

> `readonly` **options**: readonly \[[`DilemmaOption`](DilemmaOption.md), [`DilemmaOption`](DilemmaOption.md)\]

***

### prompt

> `readonly` **prompt**: `string`

What the speaker says, one or two sentences. The speaker is shown as the
prompt's label, so the prompt never names them again.

***

### speaker

> `readonly` **speaker**: [`DilemmaSpeaker`](../type-aliases/DilemmaSpeaker.md)

***

### timeoutDiary

> `readonly` **timeoutDiary**: `string`

The diary line when the timer ran out, said in place of the option's.
