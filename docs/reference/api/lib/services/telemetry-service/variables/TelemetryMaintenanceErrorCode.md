[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/services/telemetry-service](../README.md) / TelemetryMaintenanceErrorCode

# Variable: TelemetryMaintenanceErrorCode

> `const` **TelemetryMaintenanceErrorCode**: `ZodEnum`\<\{ `ACKNOWLEDGEMENT_FAILED`: `"ACKNOWLEDGEMENT_FAILED"`; `PERSISTENCE_FAILED`: `"PERSISTENCE_FAILED"`; `QUEUE_UNAVAILABLE`: `"QUEUE_UNAVAILABLE"`; `RETENTION_FAILED`: `"RETENTION_FAILED"`; \}\>

Error codes returned by the telemetry maintenance operations (ADR 0028).

`QUEUE_UNAVAILABLE` means the Redis buffer could not be read or moved, and
`PERSISTENCE_FAILED` that the batch did not reach Postgres; in both cases
the events stay queued for the next run. `ACKNOWLEDGEMENT_FAILED` means the
batch was written but not removed from the processing queue, so the next
run replays it idempotently. `RETENTION_FAILED` means the rollup
transaction rolled back.
