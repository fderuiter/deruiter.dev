[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/for-better-or-bulk/types](../README.md) / Player

# Interface: Player

## Properties

### binHold

> `readonly` **binHold**: `number`

Seconds the work key has been held facing the bin with an item in hand.

***

### busyFor

> `readonly` **busyFor**: `number`

Seconds left frozen on a phone call or re-tying shoes.

***

### busyReason

> `readonly` **busyReason**: `string` \| `null`

***

### calm

> `readonly` **calm**: `boolean`

True once a break or the brothers have calmed Fred down.

***

### facingX

> `readonly` **facingX**: `number`

Unit vector of the last movement, snapped to four directions.

***

### facingY

> `readonly` **facingY**: `number`

***

### floorHold

> `readonly` **floorHold**: [`FloorHold`](FloorHold.md) \| `null`

A floor drop being held with E (see FloorHold), or null.

***

### holding

> `readonly` **holding**: [`Item`](Item.md) \| `null`

***

### id

> `readonly` **id**: [`PlayerId`](../type-aliases/PlayerId.md)

***

### presence

> `readonly` **presence**: [`PlayerPresence`](../type-aliases/PlayerPresence.md)

***

### x

> `readonly` **x**: `number`

***

### y

> `readonly` **y**: `number`
