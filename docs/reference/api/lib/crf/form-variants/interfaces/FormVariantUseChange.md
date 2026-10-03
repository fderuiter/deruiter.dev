[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/crf/form-variants](../README.md) / FormVariantUseChange

# Interface: FormVariantUseChange

Previewed effect of a variant transaction on one current use.

## Properties

### createsArmAssignment

> **createsArmAssignment**: `boolean`

True when keeping this outcome requires writing a new arm-specific
assignment for the visit, because the arm used to follow the visit
default and the default is changing differently from the arm.

***

### outcome

> **outcome**: [`FormUseOutcome`](../type-aliases/FormUseOutcome.md)

***

### use

> **use**: [`FormUse`](FormUse.md)
