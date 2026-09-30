[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/neuro/mesh-worker](../README.md) / MeshWorkerTarget

# Interface: MeshWorkerTarget

Message target used to receive generated geometry and its transferable buffers.

## Extends

- `EventTarget`

## Methods

### addEventListener()

> **addEventListener**(`type`, `callback`, `options?`): `void`

The **`addEventListener()`** method of the EventTarget interface sets up a function that will be called whenever the specified event is delivered to the target.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/EventTarget/addEventListener)

#### Parameters

##### type

`string`

##### callback

`EventListenerOrEventListenerObject` \| `null`

##### options?

`boolean` \| `AddEventListenerOptions`

#### Returns

`void`

#### Inherited from

`EventTarget.addEventListener`

***

### dispatchEvent()

> **dispatchEvent**(`event`): `boolean`

The **`dispatchEvent()`** method of the EventTarget sends an Event to the object, (synchronously) invoking the affected event listeners in the appropriate order.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/EventTarget/dispatchEvent)

#### Parameters

##### event

`Event`

#### Returns

`boolean`

#### Inherited from

`EventTarget.dispatchEvent`

***

### postMessage()

> **postMessage**(`message`, `transfer`): `void`

#### Parameters

##### message

[`MeshWorkerResponse`](../../types/interfaces/MeshWorkerResponse.md)

##### transfer

`Transferable`[]

#### Returns

`void`

***

### removeEventListener()

> **removeEventListener**(`type`, `callback`, `options?`): `void`

The **`removeEventListener()`** method of the EventTarget interface removes an event listener previously registered with EventTarget.addEventListener() from the target.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/EventTarget/removeEventListener)

#### Parameters

##### type

`string`

##### callback

`EventListenerOrEventListenerObject` \| `null`

##### options?

`boolean` \| `EventListenerOptions`

#### Returns

`void`

#### Inherited from

`EventTarget.removeEventListener`
