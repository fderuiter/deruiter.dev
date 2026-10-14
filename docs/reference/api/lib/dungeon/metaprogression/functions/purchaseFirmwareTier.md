[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/dungeon/metaprogression](../README.md) / purchaseFirmwareTier

# Function: purchaseFirmwareTier()

> **purchaseFirmwareTier**(`profile`, `id`): [`CyberdeckProfile`](../../types/interfaces/CyberdeckProfile.md) \| `null`

Buys the next tier of a firmware track with banked crypto.

## Parameters

### profile

[`CyberdeckProfile`](../../types/interfaces/CyberdeckProfile.md)

The profile before the purchase.

### id

`"maxRamTier"` \| `"scanSpeedTier"` \| `"exploitRadiusTier"` \| `"startChipsTier"`

The track to raise.

## Returns

[`CyberdeckProfile`](../../types/interfaces/CyberdeckProfile.md) \| `null`

The profile with the tier raised and its cost spent, or null when
the track is maxed or the profile cannot afford it. The input is not changed.
