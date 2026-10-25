[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/clinical-platform/types](../README.md) / KriDefinition

# Interface: KriDefinition

A key risk indicator (#2631): a governed registry metric evaluated per
site, with the thresholds at which it turns amber and red and why.

## Properties

### amber

> `readonly` **amber**: `number`

Value at which the KRI turns amber, in the metric's unit.

***

### direction

> `readonly` **direction**: `"high"` \| `"low"`

`high` when a high value is the risk, `low` when a low value is.

***

### id

> `readonly` **id**: `string`

KRI id, for example `kri-entry-lag`.

***

### metricId

> `readonly` **metricId**: `string`

The registry metric the KRI evaluates per site.

***

### minimum

> `readonly` **minimum**: `object`

The count metric and value below which the site has too little data to
assess, for example 3 enrolled subjects.

#### metricId

> `readonly` **metricId**: `string`

#### value

> `readonly` **value**: `number`

***

### name

> `readonly` **name**: `string`

***

### reason

> `readonly` **reason**: `string`

Why these thresholds.

***

### red

> `readonly` **red**: `number`

Value at which the KRI turns red, in the metric's unit.
