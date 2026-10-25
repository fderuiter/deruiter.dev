[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/clinical-platform/types/platform](../README.md) / DataClassification

# Type Alias: DataClassification

> **DataClassification** = `"public"` \| `"internal"` \| `"confidential"` \| `"restricted"`

Data classification, from least to most protected. `restricted` is the
class for values only named roles may read, such as a randomised arm that
blinded staff must not see. Whether a product holds personal health data
is recorded separately, on `DataProduct.personalHealthData`.
