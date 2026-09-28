/**
 * User-agent mobile viewport detection helper.
 * Inspects user-agent headers to determine whether incoming request originates
 * from a mobile browser or touch handheld device.
 */
export function isMobileUserAgent(ua: string): boolean {
  if (!ua) return false;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|mobile|CriOS/i.test(
    ua
  );
}
