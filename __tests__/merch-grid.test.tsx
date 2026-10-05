// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { AvailableMerch, MerchGrid } from "@/components/merch/MerchGrid";
import { MerchView } from "@/components/merch/MerchView";
import { MERCH_PRODUCTS, type MerchProductItem } from "@/lib/merch-data";

vi.mock("@/components/providers/AudioProvider", () => ({
  useAudio: () => ({ playHover: vi.fn(), playSuccess: vi.fn() }),
}));

const liveProducts: MerchProductItem[] = MERCH_PRODUCTS.map((p) => ({
  ...p,
  url: `https://www.redbubble.com/i/${p.id}/1`,
}));

describe("MerchGrid", () => {
  afterEach(cleanup);

  it("shows every planned product with a plain coming-soon status and no links", () => {
    const { container } = render(
      <MerchGrid products={MERCH_PRODUCTS} status="coming-soon" />
    );
    expect(screen.getAllByRole("listitem")).toHaveLength(MERCH_PRODUCTS.length);
    expect(screen.getAllByText("Coming soon")).toHaveLength(
      MERCH_PRODUCTS.length
    );
    expect(container.querySelectorAll("a")).toHaveLength(0);
    expect(container.querySelectorAll("button")).toHaveLength(0);
  });

  it("does not link out even when urls are present but the store is not live", () => {
    const { container } = render(
      <MerchGrid products={liveProducts} status="coming-soon" />
    );
    expect(container.querySelectorAll("a")).toHaveLength(0);
  });

  it("renders safe, labelled outbound order links once live", () => {
    const { container } = render(
      <MerchGrid products={liveProducts} status="live" />
    );
    const links = container.querySelectorAll("a");
    expect(links).toHaveLength(liveProducts.length);
    for (const a of links) {
      expect(a.getAttribute("target")).toBe("_blank");
      expect(a.getAttribute("rel")).toBe("noopener noreferrer");
      expect(a.textContent).toContain("Order on Redbubble");
      expect(a.textContent).toContain("opens in new window");
    }
  });

  it("reserves a fixed aspect ratio and sizes artwork to avoid layout shift", () => {
    const { container } = render(
      <MerchGrid products={MERCH_PRODUCTS} status="coming-soon" />
    );
    const frames = container.querySelectorAll("[data-mockup]");
    expect(frames).toHaveLength(MERCH_PRODUCTS.length);
    for (const frame of frames) {
      expect(frame.className).toContain("aspect-[4/3]");
    }
    for (const img of container.querySelectorAll("img")) {
      expect(img.getAttribute("width")).toBe("1920");
      expect(img.getAttribute("height")).toBe("1080");
      expect(img.getAttribute("alt")).toBeTruthy();
    }
  });

  it("adapts with container queries and defends against overflow", () => {
    const { container } = render(
      <MerchGrid products={MERCH_PRODUCTS} status="coming-soon" />
    );
    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper.className).toContain("@container");
    expect(wrapper.className).toContain("min-w-0");
    const list = container.querySelector("ul")!;
    expect(list.className).toContain("grid-cols-1");
    expect(list.className).toContain("@md:grid-cols-2");
    for (const item of container.querySelectorAll("li")) {
      expect(item.className).toContain("min-w-0");
    }
  });
});

describe("MerchView", () => {
  afterEach(cleanup);

  it("tells visitors the shop is not open and states the at-cost promise", () => {
    render(<MerchView />);
    const h1 = screen.getByRole("heading", { level: 1 });
    expect(h1.textContent).toMatch(/coming soon/i);
    expect(
      screen.getByText(/nothing in it can be ordered today/i)
    ).toBeTruthy();
    expect(
      screen.getByRole("heading", { name: /at-cost promise/i })
    ).toBeTruthy();
    expect(screen.getByText(/no artist markup/i)).toBeTruthy();
    expect(screen.getByText(/CC0/)).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/CC BY/);
  });
});

describe("AvailableMerch", () => {
  afterEach(cleanup);

  it("renders a safe, labelled outbound link to the Flags for Good flag", () => {
    const { container } = render(<AvailableMerch />);
    const links = container.querySelectorAll("a");
    expect(links).toHaveLength(1);
    const a = links[0];
    expect(a.getAttribute("href")).toBe(
      "https://flagsforgood.com/products/laser-loon-minnesota-flag"
    );
    expect(a.getAttribute("target")).toBe("_blank");
    expect(a.getAttribute("rel")).toBe("noopener noreferrer");
    expect(a.textContent).toContain("Buy on Flags for Good");
    expect(a.textContent).toContain("opens in new window");
  });

  it("shows the flag as available while the Redbubble lineup stays coming soon", () => {
    render(<MerchView />);
    expect(
      screen.getByRole("heading", { name: /available now/i })
    ).toBeTruthy();
    expect(screen.getAllByText("Coming soon")).toHaveLength(
      MERCH_PRODUCTS.length
    );
  });
});
