[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/services/telemetry-service](../README.md) / TelemetryMaintenanceErrorCode

# Type Alias: TelemetryMaintenanceErrorCode

> **TelemetryMaintenanceErrorCode** = `z.infer`\<*typeof* [`TelemetryMaintenanceErrorCode`](../variables/TelemetryMaintenanceErrorCode.md)\>

Error codes returned by the telemetry maintenance operations (ADR 0028).

`QUEUE_UNAVAILABLE` means the Redis buffer could not be read or moved, and
`PERSISTENCE_FAILED` that the batch did not reach Postgres; in both cases
the events stay queued for the next run. `ACKNOWLEDGEMENT_FAILED` means the
batch was written but not removed from the processing queue, so the next
run replays it idempotently. `RETENTION_FAILED` means the rollup
transaction rolled back.
