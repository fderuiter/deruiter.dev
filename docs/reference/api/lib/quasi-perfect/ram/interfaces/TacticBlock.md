[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/quasi-perfect/ram](../README.md) / TacticBlock

# Interface: TacticBlock

Why a tactic cannot be played right now.

## Properties

### message

> **message**: `string`

Terminal line explaining the refusal, built from the same numbers.

***

### reason

> **reason**: `"exhausted"` \| `"insufficient"`

"exhausted" at 0 GB, "insufficient" when the tactic costs more than is left.
