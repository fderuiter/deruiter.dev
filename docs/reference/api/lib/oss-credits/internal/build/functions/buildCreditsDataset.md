[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/oss-credits/internal/build](../README.md) / buildCreditsDataset

# Function: buildCreditsDataset()

> **buildCreditsDataset**(`input`): [`CreditsDataset`](../../../types/interfaces/CreditsDataset.md)

Build the credits dataset from a parsed lockfile. Pure: callers supply the
installed metadata reader so the module never touches the filesystem.
When a package is installed at several versions, each version is listed.

## Parameters

### input

#### annotations

`Record`\<`string`, [`DirectAnnotation`](../../../types/interfaces/DirectAnnotation.md)\>

#### lockfile

[`LockfileShape`](../../../types/interfaces/LockfileShape.md)

#### readMeta

(`lockPath`) => [`PackageMeta`](../../../types/interfaces/PackageMeta.md) \| `null`

#### root

[`RootPackageShape`](../../../types/interfaces/RootPackageShape.md)

## Returns

[`CreditsDataset`](../../../types/interfaces/CreditsDataset.md)
