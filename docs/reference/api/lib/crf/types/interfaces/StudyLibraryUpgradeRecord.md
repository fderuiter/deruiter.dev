[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/crf/types](../README.md) / StudyLibraryUpgradeRecord

# Interface: StudyLibraryUpgradeRecord

Provenance of one applied personal-library upgrade (#681).

## Properties

### appliedAt

> **appliedAt**: `string`

***

### conflictCount

> **conflictCount**: `number`

***

### fromVersion

> **fromVersion**: `number`

***

### incomingChangeCount

> **incomingChangeCount**: `number`

***

### localCustomizationCount

> **localCustomizationCount**: `number`

***

### previousIdMap

> **previousIdMap**: `Record`\<`string`, `string`\>

Lineage maps before the upgrade, so the earlier state stays explainable.

***

### previousVariableMap

> **previousVariableMap**: `Record`\<`string`, `string`\>

***

### resolutions

> **resolutions**: `Record`\<`string`, `"current"` \| `"incoming"`\>

The author's choice for every conflict, by change id.

***

### toVersion

> **toVersion**: `number`
