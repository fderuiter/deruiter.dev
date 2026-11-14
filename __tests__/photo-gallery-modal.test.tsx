/* eslint-disable @typescript-eslint/no-explicit-any, @next/next/no-img-element */
// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { PhotoGalleryModal } from "@/components/PhotoGalleryModal";
import { BioSpotlight } from "@/components/BioSpotlight";
import { GlobalPhotoGallery } from "@/components/GlobalPhotoGallery";

// Mock next/image to render standard img tag
vi.mock("next/image", () => ({
  default: ({
    src,
    alt,
    fill: _fill,
    priority: _priority,
    ...rest
  }: {
    src: string;
    alt: string;
    fill?: boolean;
    priority?: boolean;
    [key: string]: unknown;
  }) => <img src={src} alt={alt} {...rest} />,
}));

// Mock framer-motion to prevent transition freezes in jsdom tests
vi.mock("framer-motion", async (importOriginal) => {
  const actual = await importOriginal<typeof import("framer-motion")>();
  const Component = ({
    children,
    className,
    style,
    onClick,
    ...props
  }: any) => {
    const {
      initial: _initial,
      animate: _animate,
      exit: _exit,
      transition: _transition,
      ...rest
    } = props;
    return (
      <div className={className} style={style} onClick={onClick} {...rest}>
        {children}
      </div>
    );
  };
  return {
    ...actual,
    motion: new Proxy(
      {},
      {
        get: () => Component,
      }
    ),
    AnimatePresence: ({ children }: any) => <>{children}</>,
  };
});

describe("PhotoGalleryModal Component", () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    if (root) {
      await act(async () => {
        root?.unmount();
      });
      root = null;
    }
    if (container && container.parentNode) {
      container.parentNode.removeChild(container);
      container = null;
    }
  });

  it("renders null when isOpen is false", async () => {
    await act(async () => {
      root?.render(<PhotoGalleryModal isOpen={false} onClose={() => {}} />);
    });

    expect(container?.querySelector('[role="dialog"]')).toBeNull();
  });

  it("renders dialog with accessible title and category tabs when open", async () => {
    await act(async () => {
      root?.render(<PhotoGalleryModal isOpen={true} onClose={() => {}} />);
    });

    const dialog = container?.querySelector('[role="dialog"]');
    expect(dialog).not.toBeNull();
    expect(dialog?.getAttribute("aria-modal")).toBe("true");

    const title = container?.querySelector("#photo-gallery-title");
    expect(title?.textContent).toContain("Behind the Code · Visual Archive");

    const filterGroup = container?.querySelector(
      '[role="group"][aria-label="Filter photos by category"]'
    );
    expect(filterGroup).not.toBeNull();

    const filterButtons = filterGroup?.querySelectorAll("button[aria-pressed]");
    expect(filterButtons?.length).toBe(5);
    expect(filterButtons?.[0].getAttribute("aria-pressed")).toBe("true");
    expect(filterButtons?.[1].getAttribute("aria-pressed")).toBe("false");

    expect(container?.textContent).toContain("All Photos");
    expect(container?.textContent).toContain("Duck's Growth");
    expect(container?.textContent).toContain("Mud Run & Skiing");

    // Switching category updates aria-pressed states
    await act(async () => {
      filterButtons?.[1].dispatchEvent(
        new MouseEvent("click", { bubbles: true })
      );
    });
    expect(filterButtons?.[0].getAttribute("aria-pressed")).toBe("false");
    expect(filterButtons?.[1].getAttribute("aria-pressed")).toBe("true");
  });

  it("allows selecting a photo to view in lightbox mode and navigating with keys", async () => {
    const handleClose = vi.fn();
    await act(async () => {
      root?.render(<PhotoGalleryModal isOpen={true} onClose={handleClose} />);
    });

    // Click on the first thumbnail
    const firstThumb = container?.querySelector(
      'button[aria-label^="View photo:"]'
    ) as HTMLButtonElement | null;
    expect(firstThumb).not.toBeNull();

    await act(async () => {
      firstThumb?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    // Lightbox modal should now have an active photo with back button and focus moved to it
    const backBtn = container?.querySelector(
      'button[aria-label="Back to all photos"]'
    ) as HTMLButtonElement | null;
    expect(backBtn).not.toBeNull();
    expect(document.activeElement).toBe(backBtn);

    // ArrowRight should advance photo
    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight" }));
    });

    // Escape should close photo view first and restore focus to clicked thumbnail
    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    });
    expect(
      container?.querySelector('button[aria-label="Back to all photos"]')
    ).toBeNull();
    const restoredFirstThumb = container?.querySelector(
      'button[aria-label^="View photo:"]'
    );
    expect(document.activeElement).toBe(restoredFirstThumb);
    expect(restoredFirstThumb?.getAttribute("data-photo-id")).toBe(
      firstThumb?.getAttribute("data-photo-id")
    );

    // Second Escape should close the modal
    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    });
    expect(handleClose).toHaveBeenCalled();
  });

  it("restores focus to clicked thumbnail when clicking the back button", async () => {
    await act(async () => {
      root?.render(<PhotoGalleryModal isOpen={true} onClose={() => {}} />);
    });

    const thumbnails = container?.querySelectorAll(
      'button[aria-label^="View photo:"]'
    );
    const targetThumb = thumbnails?.[1] as HTMLButtonElement | undefined;
    expect(targetThumb).toBeDefined();

    await act(async () => {
      targetThumb?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    const backBtn = container?.querySelector(
      'button[aria-label="Back to all photos"]'
    ) as HTMLButtonElement | null;
    expect(backBtn).not.toBeNull();
    expect(document.activeElement).toBe(backBtn);

    await act(async () => {
      backBtn?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(
      container?.querySelector('button[aria-label="Back to all photos"]')
    ).toBeNull();
    const restoredTargetThumb = container?.querySelectorAll(
      'button[aria-label^="View photo:"]'
    )[1];
    expect(document.activeElement).toBe(restoredTargetThumb);
    expect(restoredTargetThumb?.getAttribute("data-photo-id")).toBe(
      targetThumb?.getAttribute("data-photo-id")
    );
  });

  it("shifts focus to first available thumbnail when active photo is not in filtered category", async () => {
    await act(async () => {
      root?.render(<PhotoGalleryModal isOpen={true} onClose={() => {}} />);
    });

    // Click first thumbnail in 'all' category (Duck's growth photo)
    const firstThumb = container?.querySelector(
      'button[aria-label^="View photo:"]'
    ) as HTMLButtonElement | null;
    expect(firstThumb).not.toBeNull();

    await act(async () => {
      firstThumb?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    // Now switch category to 'sports' while in lightbox
    const sportsFilterBtn = Array.from(
      container?.querySelectorAll('div[role="group"] button') ?? []
    ).find((btn) => btn.textContent?.includes("Mud Run & Skiing"));
    expect(sportsFilterBtn).toBeDefined();

    await act(async () => {
      sportsFilterBtn?.dispatchEvent(
        new MouseEvent("click", { bubbles: true })
      );
    });

    // Focus should shift to the first available thumbnail in 'sports'
    const sportsThumbnails = container?.querySelectorAll(
      'button[aria-label^="View photo:"]'
    );
    expect(sportsThumbnails?.length).toBeGreaterThan(0);
    expect(document.activeElement).toBe(sportsThumbnails?.[0]);
  });

  it("initializes focus on lightbox when opened with initialPhotoId without restoring thumbnail focus on close", async () => {
    await act(async () => {
      root?.render(
        <PhotoGalleryModal
          isOpen={true}
          onClose={() => {}}
          initialPhotoId="theodore-wirth-mud-run"
        />
      );
    });

    const backBtn = container?.querySelector(
      'button[aria-label="Back to all photos"]'
    ) as HTMLButtonElement | null;
    expect(backBtn).not.toBeNull();
    expect(document.activeElement).toBe(backBtn);

    // Close lightbox
    await act(async () => {
      backBtn?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(
      container?.querySelector('button[aria-label="Back to all photos"]')
    ).toBeNull();
    // Thumbnail focus restoration should not be attempted since initialPhotoId opened directly to lightbox
    const allThumbs = Array.from(
      container?.querySelectorAll('button[aria-label^="View photo:"]') ?? []
    );
    expect(
      allThumbs.includes(document.activeElement as HTMLButtonElement)
    ).toBe(false);
  });
});

describe("BioSpotlight Component", () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    if (root) {
      await act(async () => {
        root?.unmount();
      });
      root = null;
    }
    if (container && container.parentNode) {
      container.parentNode.removeChild(container);
      container = null;
    }
  });

  it("renders the growth progression tracker and responds to milestone clicks", async () => {
    await act(async () => {
      root?.render(<BioSpotlight />);
    });

    expect(container?.textContent).toContain(
      "From 8-Week Fluff to 80-lb Marshmallow"
    );

    // Milestones are independent toggle buttons with explicit pressed state.
    const milestoneGroup = container?.querySelector(
      '[role="group"][aria-label="Photo growth milestones"]'
    );
    const milestoneButtons = milestoneGroup?.querySelectorAll(
      "button[aria-pressed]"
    );
    expect(milestoneButtons?.length).toBe(6);
    expect(milestoneButtons?.[0].getAttribute("aria-pressed")).toBe("true");

    // Click on step 2 (Mirror Check)
    if (milestoneButtons && milestoneButtons[1]) {
      await act(async () => {
        milestoneButtons[1].dispatchEvent(
          new MouseEvent("click", { bubbles: true })
        );
      });
      expect(container?.textContent).toContain("First Week Home");
      expect(milestoneButtons[1].getAttribute("aria-pressed")).toBe("true");
    }
  });
});

describe("GlobalPhotoGallery Component", () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    if (root) {
      await act(async () => {
        root?.unmount();
      });
      root = null;
    }
    if (container && container.parentNode) {
      container.parentNode.removeChild(container);
      container = null;
    }
  });

  it("renders initially closed and opens upon receiving open-photo-gallery event", async () => {
    await act(async () => {
      root?.render(<GlobalPhotoGallery />);
    });

    expect(container?.querySelector('[role="dialog"]')).toBeNull();

    await act(async () => {
      window.dispatchEvent(
        new CustomEvent("open-photo-gallery", {
          detail: { photoId: "theodore-wirth-mud-run" },
        })
      );
    });

    const dialog = container?.querySelector('[role="dialog"]');
    expect(dialog).not.toBeNull();
  });
});
