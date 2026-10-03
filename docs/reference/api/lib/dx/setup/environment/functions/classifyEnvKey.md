[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/dx/setup/environment](../README.md) / classifyEnvKey

# Function: classifyEnvKey()

> **classifyEnvKey**(`key`): [`EnvKeyClassification`](../../types/interfaces/EnvKeyClassification.md)

Classifies a key. Unknown keys fail safe: anything whose name looks like
a credential is treated as a secret.

## Parameters

### key

`string`

## Returns

[`EnvKeyClassification`](../../types/interfaces/EnvKeyClassification.md)
