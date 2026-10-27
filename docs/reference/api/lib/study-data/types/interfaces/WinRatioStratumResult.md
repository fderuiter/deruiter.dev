[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/study-data/types](../README.md) / WinRatioStratumResult

# Interface: WinRatioStratumResult

Pair counts and point estimates within one stratum.

## Properties

### controlCount

> `readonly` **controlCount**: `number`

Control subjects in the stratum.

***

### losses

> `readonly` **losses**: `number`

Pairs won by the control member.

***

### pairs

> `readonly` **pairs**: `number`

Treatment-control pairs.

***

### stratum

> `readonly` **stratum**: `string`

The stratum label, `""` when unstratified.

***

### ties

> `readonly` **ties**: `number`

Pairs tied on every component.

***

### treatmentCount

> `readonly` **treatmentCount**: `number`

Treatment subjects in the stratum.

***

### weight

> `readonly` **weight**: `number`

The stratum's weight in the combined estimates.

***

### wins

> `readonly` **wins**: `number`

Pairs won by the treatment member.
