[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/dx/setup/environment](../README.md) / SetupProfile

# Interface: SetupProfile

One environment profile and the keys it needs.

## Properties

### allowsDatabaseMutation

> **allowsDatabaseMutation**: `boolean`

Whether this profile may mutate a database during setup.

***

### description

> **description**: `string`

***

### id

> **id**: `"local-minimal"` \| `"hosted-development"` \| `"deployment"`

***

### label

> **label**: `string`

***

### optional

> **optional**: readonly `string`[]

Keys reported when unset, without blocking.

***

### required

> **required**: readonly `string`[]

Keys that must hold a real value for the profile to be ready.
