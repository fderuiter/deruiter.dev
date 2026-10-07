[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/crf/personal-library](../README.md) / instantiateFormLibraryEntry

# Function: instantiateFormLibraryEntry()

> **instantiateFormLibraryEntry**(`entry`, `options?`, `now?`): [`InstantiatedFormLibraryEntry`](../interfaces/InstantiatedFormLibraryEntry.md)

Produces an independent copy of a form library entry, ready to insert into a study.

Allocates fresh engine IDs for form, sections, fields, and rules, and remaps
CDASH variable names when duplicates exist in the target study.

## Parameters

### entry

[`PersonalLibraryEntry`](../interfaces/PersonalLibraryEntry.md)

### options?

[`InstantiateLibraryEntryOptions`](../interfaces/InstantiateLibraryEntryOptions.md)

### now?

`Date`

## Returns

[`InstantiatedFormLibraryEntry`](../interfaces/InstantiatedFormLibraryEntry.md)
