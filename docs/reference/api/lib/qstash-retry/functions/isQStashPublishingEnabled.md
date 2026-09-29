[**fderuiter-portfolio**](../../../README.md)

***

[fderuiter-portfolio](../../../modules.md) / [lib/qstash-retry](../README.md) / isQStashPublishingEnabled

# Function: isQStashPublishingEnabled()

> **isQStashPublishingEnabled**(): `boolean`

Whether QStash may publish. Needs a token, and only the production
deployment publishes: the QStash variables are shared with preview
deployments (#622), which must not enqueue jobs against production state.

## Returns

`boolean`
