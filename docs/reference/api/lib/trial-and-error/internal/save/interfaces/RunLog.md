[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/trial-and-error/internal/save](../README.md) / RunLog

# Interface: RunLog

A run as the save keeps it: where it started and every move since.

## Properties

### actId

> **actId**: `string`

The plan's id: the act played on its own, or the campaign.

***

### actions

> **actions**: [`LoggedAction`](../type-aliases/LoggedAction.md)[]

***

### seed

> **seed**: `string`

***

### sponsorId?

> `optional` **sponsorId?**: `"VIRTUAL_BIOTECH"` \| `"ONCOLOGY_PHARMA"` \| `"CARDIO_MEGA_TRIAL"` \| `"RARE_DISEASE_BIOTECH"`

The run's sponsor (#950). Absent means Virtual Biotech.

***

### stake?

> `optional` **stake?**: `number`

The run's stake (#950). Absent means stake 1.
