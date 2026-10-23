[**fderuiter-portfolio**](../../../../../../README.md)

***

[fderuiter-portfolio](../../../../../../modules.md) / [lib/study-data/internal/export/package](../README.md) / zipStudyDataPackage

# Function: zipStudyDataPackage()

> **zipStudyDataPackage**(`pkg`): `Promise`\<`Uint8Array`\<`ArrayBufferLike`\>\>

Zips a built package. Entries are stored in the package's file order with
the fixed timestamp and DEFLATE level 6, so the same package always zips
to the same bytes.

## Parameters

### pkg

[`StudyDataPackage`](../interfaces/StudyDataPackage.md)

The result of [buildStudyDataPackage](buildStudyDataPackage.md).

## Returns

`Promise`\<`Uint8Array`\<`ArrayBufferLike`\>\>

The archive bytes.
