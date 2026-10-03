[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/crf/library-upgrade](../README.md) / detectLibraryUpgrades

# Function: detectLibraryUpgrades()

> **detectLibraryUpgrades**(`study`, `entries`): [`LibraryUpgradeAvailability`](../interfaces/LibraryUpgradeAvailability.md)[]

Reports, without changing anything, which library blocks in a study have a
newer library version. Detection never applies an update.

## Parameters

### study

[`StudyProtocol`](../../types/interfaces/StudyProtocol.md)

### entries

[`PersonalLibraryEntry`](../../personal-library/interfaces/PersonalLibraryEntry.md)[]

## Returns

[`LibraryUpgradeAvailability`](../interfaces/LibraryUpgradeAvailability.md)[]
