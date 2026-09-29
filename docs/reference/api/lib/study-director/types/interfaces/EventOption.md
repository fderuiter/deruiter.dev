[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/study-director/types](../README.md) / EventOption

# Interface: EventOption

## Properties

### attentionCost

> **attentionCost**: `number`

***

### debtIfUndocumented

> **debtIfUndocumented**: `number`

***

### effects

> **effects**: [`Effects`](Effects.md)

***

### finding?

> `optional` **finding?**: [`InspectionFinding`](InspectionFinding.md)

What an inspector asks about this choice. If the player documented it
the question closes; if not, it becomes an observation.

***

### flags?

> `optional` **flags?**: `string`[]

Flags set when this option is chosen.

***

### id

> **id**: `string`

***

### label

> **label**: `string`

***

### schedule?

> `optional` **schedule?**: `object`[]

Follow-up events scheduled this many days out.

#### eventId

> **eventId**: `string`

#### inDays

> **inDays**: `number`
