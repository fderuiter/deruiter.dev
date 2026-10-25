import React from "react";
import { isPhoneGated } from "@/lib/arcade";

// PHONE_QUERY (ADR 0061) as Tailwind classes: phones in either orientation,
// and touch panes narrower than 744px. Tablets and narrow desktop windows do
// not match. The classes are decided in CSS, so the server HTML is already
// right for the device: no hydration flash and no layout shift (#2368).
// Tailwind reads class names from source, so each stays a literal.

/** Shown on phones only, inline. */
export const PHONE_ONLY_INLINE =
  "hidden [@media(pointer:coarse)_and_((max-width:743px)_or_(max-height:500px))]:inline-flex";
/** Shown on phones only, as a block. */
export const PHONE_ONLY_BLOCK =
  "hidden [@media(pointer:coarse)_and_((max-width:743px)_or_(max-height:500px))]:block";
/** Hidden on phones. */
export const HIDDEN_ON_PHONE =
  "[@media(pointer:coarse)_and_((max-width:743px)_or_(max-height:500px))]:hidden";
/** Moves an item ahead of its siblings on phones, keeping their order. */
export const FIRST_ON_PHONE =
  "[@media(pointer:coarse)_and_((max-width:743px)_or_(max-height:500px))]:order-first";

/**
 * The phone badge for a game, read from the registry: "Plays on phone" when
 * its phone view is ready, "Best on a bigger screen" while it is gated. It
 * shows on phones only.
 */
export function PhoneReadinessBadge({ slug }: { slug: string }) {
  const gated = isPhoneGated(slug);
  return (
    <span
      data-phone-readiness={gated ? "gated" : "ready"}
      className={`${PHONE_ONLY_INLINE} items-center rounded-full border px-2.5 py-0.5 font-mono text-[10px] font-bold tracking-wider uppercase ${
        gated
          ? "border-zinc-700 text-zinc-300"
          : "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
      }`}
    >
      {gated ? "Best on a bigger screen" : "Plays on phone"}
    </span>
  );
}
