[**fderuiter-portfolio**](../../../README.md)

***

[fderuiter-portfolio](../../../modules.md) / [lib/workspace-command-registry](../README.md) / WorkspaceCommandRegistry

# Class: WorkspaceCommandRegistry

## Constructors

### Constructor

> **new WorkspaceCommandRegistry**(): `WorkspaceCommandRegistry`

#### Returns

`WorkspaceCommandRegistry`

## Methods

### clearActions()

> **clearActions**(): `void`

Clears all registered workspace actions.

#### Returns

`void`

***

### executeAction()

> **executeAction**(`id`, `args?`): `Promise`\<`boolean`\>

Executes a registered workspace action asynchronously on the main thread.

If the handler is missing or dead, logs a warning diagnostic without
throwing uncaught exceptions.

#### Parameters

##### id

`string`

##### args?

`Record`\<`string`, `unknown`\>

#### Returns

`Promise`\<`boolean`\>

***

### getAction()

> **getAction**(`id`): [`WorkspaceActionPayload`](../../event-bus/interfaces/WorkspaceActionPayload.md) \| `undefined`

Retrieves a single registered workspace action by ID.

#### Parameters

##### id

`string`

#### Returns

[`WorkspaceActionPayload`](../../event-bus/interfaces/WorkspaceActionPayload.md) \| `undefined`

***

### getActions()

> **getActions**(): [`WorkspaceActionPayload`](../../event-bus/interfaces/WorkspaceActionPayload.md)[]

Retrieves all currently registered workspace actions.
Returns a stable cached array reference for useSyncExternalStore.

#### Returns

[`WorkspaceActionPayload`](../../event-bus/interfaces/WorkspaceActionPayload.md)[]

***

### registerAction()

> **registerAction**(`action`): `void`

Registers a contextual workspace action.

#### Parameters

##### action

[`WorkspaceActionPayload`](../../event-bus/interfaces/WorkspaceActionPayload.md)

#### Returns

`void`

***

### subscribe()

> **subscribe**(`listener`): () => `void`

Subscribes to changes in the command registry.

#### Parameters

##### listener

[`WorkspaceRegistryListener`](../type-aliases/WorkspaceRegistryListener.md)

#### Returns

() => `void`

***

### unregisterAction()

> **unregisterAction**(`id`): `void`

Unregisters a workspace action by ID.

#### Parameters

##### id

`string`

#### Returns

`void`
