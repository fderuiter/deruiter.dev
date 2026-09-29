/**
 * Room labels for the roguelike campaign (#1322).
 */

/**
 * Labels a campaign room by its position, as "ROOM 01 :: AIRGAP ENCLAVE".
 * Room badges were written for a longer tier campaign, so they numbered the
 * same rooms "TIER 03" and "ROOM 02"; the position is what the player sees.
 *
 * @param badge - The room's own badge, such as "TIER 03 :: AIRGAP ENCLAVE".
 * @param index - The room's zero-based position in the campaign.
 * @returns The badge renumbered by position.
 */
export function formatCampaignRoomBadge(badge: string, index: number): string {
  const parts = badge.split("::");
  const name = (parts.length > 1 ? parts.slice(1).join("::") : badge).trim();
  const number = String(index + 1).padStart(2, "0");
  return `ROOM ${number} :: ${name}`;
}
