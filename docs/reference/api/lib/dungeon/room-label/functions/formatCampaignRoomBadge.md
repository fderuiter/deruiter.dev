[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/dungeon/room-label](../README.md) / formatCampaignRoomBadge

# Function: formatCampaignRoomBadge()

> **formatCampaignRoomBadge**(`badge`, `index`): `string`

Labels a campaign room by its position, as "ROOM 01 :: AIRGAP ENCLAVE".
Room badges were written for a longer tier campaign, so they numbered the
same rooms "TIER 03" and "ROOM 02"; the position is what the player sees.

## Parameters

### badge

`string`

The room's own badge, such as "TIER 03 :: AIRGAP ENCLAVE".

### index

`number`

The room's zero-based position in the campaign.

## Returns

`string`

The badge renumbered by position.
