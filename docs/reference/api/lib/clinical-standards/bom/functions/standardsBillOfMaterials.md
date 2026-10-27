[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/clinical-standards/bom](../README.md) / standardsBillOfMaterials

# Function: standardsBillOfMaterials()

> **standardsBillOfMaterials**(`published?`): [`StandardsBom`](../interfaces/StandardsBom.md)

The bill of materials: every pinned standard, terminology package and tool
with the newest version published and how the pin stands against it.

## Parameters

### published?

[`PublishedVersions`](../interfaces/PublishedVersions.md) = `PUBLISHED`

The newest published versions; defaults to the
  committed `standards-latest.json`.

## Returns

[`StandardsBom`](../interfaces/StandardsBom.md)

The entries, in the profile's order.
