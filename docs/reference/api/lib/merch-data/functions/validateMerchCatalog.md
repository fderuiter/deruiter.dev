[**fderuiter-portfolio**](../../../README.md)

***

[fderuiter-portfolio](../../../modules.md) / [lib/merch-data](../README.md) / validateMerchCatalog

# Function: validateMerchCatalog()

> **validateMerchCatalog**(`products?`, `status?`, `shopUrl?`): `string`[]

Problems that would break the store, as readable messages. Empty means the
catalog is sound for the given status.

## Parameters

### products?

readonly [`MerchProductItem`](../interfaces/MerchProductItem.md)[] = `MERCH_PRODUCTS`

### status?

[`MerchStoreStatus`](../type-aliases/MerchStoreStatus.md) = `MERCH_STORE_STATUS`

### shopUrl?

`string` \| `null`

## Returns

`string`[]
