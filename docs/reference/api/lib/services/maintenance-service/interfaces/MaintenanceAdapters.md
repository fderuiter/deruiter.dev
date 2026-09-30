[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/services/maintenance-service](../README.md) / MaintenanceAdapters

# Interface: MaintenanceAdapters

## Methods

### dispatchNewsletter()

> **dispatchNewsletter**(`now`): `Promise`\<[`MaintenancePhaseResult`](../type-aliases/MaintenancePhaseResult.md)\>

#### Parameters

##### now

`Date`

#### Returns

`Promise`\<[`MaintenancePhaseResult`](../type-aliases/MaintenancePhaseResult.md)\>

***

### processEmailRetry()

> **processEmailRetry**(`now`): `Promise`\<[`MaintenancePhaseResult`](../type-aliases/MaintenancePhaseResult.md)\>

#### Parameters

##### now

`Date`

#### Returns

`Promise`\<[`MaintenancePhaseResult`](../type-aliases/MaintenancePhaseResult.md)\>

***

### runRetention()

> **runRetention**(`now`): `Promise`\<[`MaintenancePhaseResult`](../type-aliases/MaintenancePhaseResult.md)\>

#### Parameters

##### now

`Date`

#### Returns

`Promise`\<[`MaintenancePhaseResult`](../type-aliases/MaintenancePhaseResult.md)\>

***

### syncTelemetry()

> **syncTelemetry**(`batchSize`): `Promise`\<[`MaintenancePhaseResult`](../type-aliases/MaintenancePhaseResult.md)\>

#### Parameters

##### batchSize

`number`

#### Returns

`Promise`\<[`MaintenancePhaseResult`](../type-aliases/MaintenancePhaseResult.md)\>
