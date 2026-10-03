[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/dx/setup/types](../README.md) / EnvironmentStatus

# Interface: EnvironmentStatus

Captures what the environment stage established, separately per concern.

## Properties

### backupPath?

> `optional` **backupPath?**: `string`

Backup made before a destructive replacement, relative to the workspace.

***

### kept

> **kept**: `string`[]

Keys whose existing value was kept rather than replaced.

***

### missingOptional

> **missingOptional**: `string`[]

***

### missingRequired

> **missingRequired**: `string`[]

***

### optionalReady

> **optionalReady**: `boolean`

Every optional key the profile lists has a real value.

***

### requiredReady

> **requiredReady**: `boolean`

Every key the profile requires has a real (non-placeholder) value.

***

### schemaErrors

> **schemaErrors**: `string`[]

Key names and messages only; never values.

***

### schemaValid

> **schemaValid**: `boolean`

Every present value passes the `lib/env.ts` schema.

***

### templateCreated

> **templateCreated**: `boolean`

`.env.local` did not exist and was created from `.env.example` this run.

***

### userSkipped

> **userSkipped**: `string`[]

Keys the user chose to leave unset this run.

***

### written

> **written**: `string`[]

Keys written to `.env.local` this run (names only).
