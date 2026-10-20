[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/arcade/form-factor](../README.md) / classifyFormFactor

# Function: classifyFormFactor()

> **classifyFormFactor**(`input`, `previous?`): [`FormFactor`](../type-aliases/FormFactor.md)

Classify a cabinet viewport.

With `previous`, the result keeps the previous view until the size is past
a breakpoint by `FORM_FACTOR_HYSTERESIS`, so a resize that wobbles on the
line does not swap views back and forth. Tablet and desktop differ only by
pointer, so there is no size margin between them.

## Parameters

### input

[`FormFactorInput`](../interfaces/FormFactorInput.md)

The cabinet viewport size and pointer.

### previous?

[`FormFactor`](../type-aliases/FormFactor.md)

The view the cabinet shows now, if any.

## Returns

[`FormFactor`](../type-aliases/FormFactor.md)

The view to show.
