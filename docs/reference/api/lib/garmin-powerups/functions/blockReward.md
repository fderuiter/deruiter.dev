[**fderuiter-portfolio**](../../../README.md)

***

[fderuiter-portfolio](../../../modules.md) / [lib/garmin-powerups](../README.md) / blockReward

# Function: blockReward()

> **blockReward**(`contents`, `power`): `"kudos"` \| [`PickupKind`](../type-aliases/PickupKind.md)

What a Sync Block gives when bumped. A power block gives a Protein Shake
to a Base runner and a Heat Map to a stronger one; a cape block gives a
Protein Shake to a Base runner and a Compression Cape to a stronger one. A
suit block always gives the Tri Suit. A Runner's High block always gives a
Runner's High, and a buddy block always hatches a Running Buddy (#2024).

## Parameters

### contents

`"suit"` \| `"cape"` \| `"kudos"` \| `"power"` \| `"high"` \| `"buddy"` \| `"medal"` \| `"wind"`

### power

[`PowerTier`](../type-aliases/PowerTier.md) \| `undefined`

## Returns

`"kudos"` \| [`PickupKind`](../type-aliases/PickupKind.md)
