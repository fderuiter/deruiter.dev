"use client";

import React, { useState } from "react";
import Link from "next/link";

type IntentLinkProps = React.ComponentProps<typeof Link>;

/**
 * `next/link` that prefetches when a visitor shows intent to follow it
 * (pointer hover, keyboard focus or touch) instead of when it scrolls into
 * view.
 *
 * Viewport prefetching made a scrolled page fetch 70 to 105 routes it was
 * never going to open, through the navbar, the footer columns and the card
 * grids, and every one of those fetches is a CDN request and an ISR read
 * against the Hobby plan's monthly allowance (#3065). This is the
 * hover-triggered pattern from Next's prefetching guide: `prefetch={false}`
 * until intent, then `null` to restore the default. An explicit `prefetch`
 * prop from the caller always wins.
 */
export function IntentLink({
  prefetch,
  onMouseEnter,
  onFocus,
  onTouchStart,
  ...props
}: IntentLinkProps) {
  const [hasIntent, setHasIntent] = useState(false);

  return (
    <Link
      {...props}
      prefetch={prefetch !== undefined ? prefetch : hasIntent ? null : false}
      onMouseEnter={(event) => {
        setHasIntent(true);
        onMouseEnter?.(event);
      }}
      onFocus={(event) => {
        setHasIntent(true);
        onFocus?.(event);
      }}
      onTouchStart={(event) => {
        setHasIntent(true);
        onTouchStart?.(event);
      }}
    />
  );
}
