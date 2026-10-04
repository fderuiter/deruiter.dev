[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/oss-credits/internal/build](../README.md) / buildCreditsDataset

# Function: buildCreditsDataset()

> **buildCreditsDataset**(`input`): [`CreditsDataset`](../../../types/interfaces/CreditsDataset.md)

Build the credits dataset from a parsed lockfile and the committed registry
facts. Pure: it never touches the filesystem or the network. When a package
is installed at several versions, each version is listed.

## Parameters

### input

#### annotations

`Record`\<`string`, [`DirectAnnotation`](../../../types/interfaces/DirectAnnotation.md)\>

#### facts

[`FactsStore`](../../../types/interfaces/FactsStore.md)

#### lockfile

[`LockfileShape`](../../../types/interfaces/LockfileShape.md)

#### root

[`RootPackageShape`](../../../types/interfaces/RootPackageShape.md)

## Returns

[`CreditsDataset`](../../../types/interfaces/CreditsDataset.md)
