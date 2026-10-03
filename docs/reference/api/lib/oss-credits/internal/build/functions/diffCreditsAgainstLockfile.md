[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/oss-credits/internal/build](../README.md) / diffCreditsAgainstLockfile

# Function: diffCreditsAgainstLockfile()

> **diffCreditsAgainstLockfile**(`dataset`, `lockfile`): [`CreditsDrift`](../../../types/interfaces/CreditsDrift.md)

Compare a committed dataset with the lockfile. Only name, version, license
and scope are compared, so the check needs no installed node_modules.

## Parameters

### dataset

[`CreditsDataset`](../../../types/interfaces/CreditsDataset.md)

### lockfile

[`LockfileShape`](../../../types/interfaces/LockfileShape.md)

## Returns

[`CreditsDrift`](../../../types/interfaces/CreditsDrift.md)
