[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/study-director-world/internal/site-maps](../README.md) / HiddenTrait

# Interface: HiddenTrait

A hidden trait and the checks that can bring it to light.

## Extends

- [`CoordinatorTrait`](../../../types/interfaces/CoordinatorTrait.md)

## Properties

### detail

> **detail**: `string`

#### Inherited from

[`CoordinatorTrait`](../../../types/interfaces/CoordinatorTrait.md).[`detail`](../../../types/interfaces/CoordinatorTrait.md#detail)

***

### fromVisit

> **fromVisit**: `number`

The earliest visit, counting from 1, on which it can be learned.

***

### id

> **id**: `string`

#### Inherited from

[`CoordinatorTrait`](../../../types/interfaces/CoordinatorTrait.md).[`id`](../../../types/interfaces/CoordinatorTrait.md#id)

***

### label

> **label**: `string`

#### Inherited from

[`CoordinatorTrait`](../../../types/interfaces/CoordinatorTrait.md).[`label`](../../../types/interfaces/CoordinatorTrait.md#label)

***

### revealedBy

> **revealedBy**: (`"drugAccountability"` \| `"consent"` \| `"eligibility"` \| `"temperatureLogs"` \| `"delegationLog"` \| `"sourceReview"` \| `"interviewCoordinator"` \| `"meetPi"`)[]

Checks that reveal it.
