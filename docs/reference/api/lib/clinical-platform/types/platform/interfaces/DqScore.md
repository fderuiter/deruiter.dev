[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/clinical-platform/types/platform](../README.md) / DqScore

# Interface: DqScore

A score over a set of rules: a product, a dimension or the whole run (#2636).

## Properties

### key

> `readonly` **key**: `string`

Product id, dimension, or `overall`.

***

### label

> `readonly` **label**: `string`

***

### passing

> `readonly` **passing**: `number`

Of those, the rules that passed or warned.

***

### rules

> `readonly` **rules**: `number`

Rules that checked something.

***

### score

> `readonly` **score**: `number` \| `null`

Mean pass rate of those rules, from 0 to 1, or `null` when there are none.
