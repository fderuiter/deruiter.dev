[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/trial-and-error/internal/run-rules](../README.md) / startingInventory

# Function: startingInventory()

> **startingInventory**(`plan`, `sponsorId`): [`Inventory`](../../table/interfaces/Inventory.md) \| `undefined`

What a sponsor starts the run with: its relic, taken from the plan's shop
data, its budget and its hand levels. Undefined for a sponsor with no
starting kit, so the first table is dealt exactly as without one. A
starting relic no shop in the plan stocks is left out.

## Parameters

### plan

`Plan`

### sponsorId

`"VIRTUAL_BIOTECH"` \| `"ONCOLOGY_PHARMA"` \| `"CARDIO_MEGA_TRIAL"` \| `"RARE_DISEASE_BIOTECH"`

## Returns

[`Inventory`](../../table/interfaces/Inventory.md) \| `undefined`
