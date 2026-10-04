[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/oss-credits/internal/facts](../README.md) / listLockedPackages

# Function: listLockedPackages()

> **listLockedPackages**(`lockfile`): [`LockedPackage`](../../../types/interfaces/LockedPackage.md)[]

Every distinct name@version in the lockfile, shipped when any install of it
is shipped. The first resolved URL and integrity hash win; installs of one
version share both.

## Parameters

### lockfile

[`LockfileShape`](../../../types/interfaces/LockfileShape.md)

## Returns

[`LockedPackage`](../../../types/interfaces/LockedPackage.md)[]
