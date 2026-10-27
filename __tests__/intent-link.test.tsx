import fs from "fs";
import path from "path";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

const linkProps = vi.hoisted(() => ({ last: {} as Record<string, unknown> }));

vi.mock("next/link", () => ({
  default: ({
    prefetch,
    href,
    children,
    ...rest
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & {
    prefetch?: boolean | null;
    href: string;
  }) => {
    linkProps.last = { prefetch };
    return (
      <a href={href} {...rest}>
        {children}
      </a>
    );
  },
}));

import { IntentLink } from "@/components/ui/IntentLink";

describe("IntentLink (#3065)", () => {
  afterEach(cleanup);

  it("does not prefetch until the visitor shows intent", () => {
    render(<IntentLink href="/arcade">Arcade</IntentLink>);
    expect(linkProps.last.prefetch).toBe(false);
  });

  it.each([
    ["hover", fireEvent.mouseEnter],
    ["focus", fireEvent.focus],
    ["touch", fireEvent.touchStart],
  ])("restores default prefetching on %s", (_name, fire) => {
    render(<IntentLink href="/blog">Blog</IntentLink>);
    fire(screen.getByRole("link", { name: "Blog" }));
    expect(linkProps.last.prefetch).toBeNull();
  });

  it("keeps the caller's handler and explicit prefetch", () => {
    const onMouseEnter = vi.fn();
    render(
      <IntentLink href="/" prefetch onMouseEnter={onMouseEnter}>
        Home
      </IntentLink>
    );
    expect(linkProps.last.prefetch).toBe(true);
    fireEvent.mouseEnter(screen.getByRole("link", { name: "Home" }));
    expect(onMouseEnter).toHaveBeenCalledTimes(1);
    expect(linkProps.last.prefetch).toBe(true);
  });

  it("is the only module that imports next/link directly", () => {
    const root = process.cwd();
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(full);
        } else if (/\.tsx?$/.test(entry.name)) {
          const source = fs.readFileSync(full, "utf-8");
          if (/from "next\/link"/.test(source)) {
            offenders.push(path.relative(root, full));
          }
        }
      }
    };
    walk(path.join(root, "app"));
    walk(path.join(root, "components"));
    expect(offenders).toEqual([
      path.join("components", "ui", "IntentLink.tsx"),
    ]);
  });
});
