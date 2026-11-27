import React from "react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, fireEvent, cleanup } from "@testing-library/react";
import {
  DefensiveFlex,
  TruncatedText,
  ModalContainer,
} from "@/components/ui/LayoutPrimitives";

describe("Shared Defensive Layout Primitives", () => {
  afterEach(() => {
    cleanup();
  });

  describe("DefensiveFlex Component", () => {
    it("renders defensive flex container with default min-w-0 max-w-full overflow-hidden rules", () => {
      const { container } = render(
        <DefensiveFlex data-testid="defensive-flex">
          <div>Item 1</div>
          <div>Item 2</div>
        </DefensiveFlex>
      );

      const flexEl = container.querySelector('[data-testid="defensive-flex"]');
      expect(flexEl).not.toBeNull();
      expect(flexEl?.className).toContain("flex");
      expect(flexEl?.className).toContain("min-w-0");
      expect(flexEl?.className).toContain("max-w-full");
      expect(flexEl?.className).toContain("overflow-hidden");
    });

    it("applies flex direction, alignment, justification, gap, and wrap options", () => {
      const { container } = render(
        <DefensiveFlex
          data-testid="styled-flex"
          direction="col"
          align="center"
          justify="between"
          wrap="wrap"
          gap="4"
          useContainerQuery
        >
          <div>Child</div>
        </DefensiveFlex>
      );

      const flexEl = container.querySelector('[data-testid="styled-flex"]');
      expect(flexEl?.className).toContain("flex-col");
      expect(flexEl?.className).toContain("items-center");
      expect(flexEl?.className).toContain("justify-between");
      expect(flexEl?.className).toContain("flex-wrap");
      expect(flexEl?.className).toContain("gap-4");
      expect(flexEl?.className).toContain("@container");
    });

    it("supports polymorphic HTML element rendering via 'as' prop", () => {
      const { container } = render(
        <DefensiveFlex as="section" data-testid="section-flex">
          <span>Section content</span>
        </DefensiveFlex>
      );

      const flexEl = container.querySelector('[data-testid="section-flex"]');
      expect(flexEl?.tagName.toLowerCase()).toBe("section");
    });
  });

  describe("TruncatedText Component", () => {
    it("applies defensive single-line truncation rules by default", () => {
      const { container } = render(
        <TruncatedText data-testid="truncated-text">
          Extremely long text content that should truncate
        </TruncatedText>
      );

      const textEl = container.querySelector('[data-testid="truncated-text"]');
      expect(textEl?.className).toContain("min-w-0");
      expect(textEl?.className).toContain("truncate");
    });

    it("applies multi-line clamp class when clamp is a number > 1", () => {
      const { container } = render(
        <TruncatedText data-testid="clamped-text" clamp={3}>
          Multi-line content
        </TruncatedText>
      );

      const textEl = container.querySelector('[data-testid="clamped-text"]');
      expect(textEl?.className).toContain("line-clamp-3");
      expect(textEl?.className).toContain("min-w-0");
    });

    it("applies break-words formatting when breakWords is true", () => {
      const { container } = render(
        <TruncatedText data-testid="break-text" breakWords clamp={false}>
          Supercalifragilisticexpialidocious
        </TruncatedText>
      );

      const textEl = container.querySelector('[data-testid="break-text"]');
      expect(textEl?.className).toContain("break-words");
      expect(textEl?.className).toContain("text-token-break");
    });

    it("supports polymorphic heading tag and title attribute", () => {
      const { container } = render(
        <TruncatedText as="h2" title="Full Title" data-testid="heading-text">
          Truncated Heading
        </TruncatedText>
      );

      const headingEl = container.querySelector('[data-testid="heading-text"]');
      expect(headingEl?.tagName.toLowerCase()).toBe("h2");
      expect(headingEl?.getAttribute("title")).toBe("Full Title");
    });
  });

  describe("ModalContainer Component", () => {
    it("renders accessible modal dialog with focus trap attributes when open", () => {
      const { container } = render(
        <ModalContainer
          isOpen={true}
          onClose={vi.fn()}
          titleId="test-modal-title"
          ariaDescribedBy="test-modal-desc"
        >
          <h2 id="test-modal-title">Test Modal Title</h2>
          <p id="test-modal-desc">Modal description content.</p>
          <button type="button">Action</button>
        </ModalContainer>
      );

      const dialogEl = container.querySelector('[role="dialog"]');
      expect(dialogEl).not.toBeNull();
      expect(dialogEl?.getAttribute("aria-modal")).toBe("true");
      expect(dialogEl?.getAttribute("aria-labelledby")).toBe(
        "test-modal-title"
      );
      expect(dialogEl?.getAttribute("aria-describedby")).toBe(
        "test-modal-desc"
      );
    });

    it("enforces max height and overflow scroll constraints on the content container", () => {
      const { container } = render(
        <ModalContainer isOpen={true} onClose={vi.fn()}>
          <div>Modal Inner Content</div>
        </ModalContainer>
      );

      const innerBox = container.querySelector(".max-h-\\[85vh\\]");
      expect(innerBox).not.toBeNull();
      expect(innerBox?.className).toContain("overflow-y-auto");
      expect(innerBox?.className).toContain("flex-col");
      expect(innerBox?.className).toContain("min-w-0");
    });

    it("triggers onClose when clicking the backdrop overlay", () => {
      const handleClose = vi.fn();
      const { container } = render(
        <ModalContainer
          isOpen={true}
          onClose={handleClose}
          closeOnBackdropClick={true}
        >
          <div>Modal Content</div>
        </ModalContainer>
      );

      const backdrop = container.querySelector(
        '[role="dialog"]'
      ) as HTMLElement;
      expect(backdrop).not.toBeNull();
      fireEvent.click(backdrop);

      expect(handleClose).toHaveBeenCalledTimes(1);
    });

    it("triggers onClose when pressing the Escape key", () => {
      const handleClose = vi.fn();
      render(
        <ModalContainer
          isOpen={true}
          onClose={handleClose}
          closeOnEscape={true}
        >
          <div>Modal Content</div>
        </ModalContainer>
      );

      fireEvent.keyDown(window, { key: "Escape" });
      expect(handleClose).toHaveBeenCalledTimes(1);
    });

    it("returns null when isOpen is false", () => {
      const { container } = render(
        <ModalContainer isOpen={false} onClose={vi.fn()}>
          <div>Modal Content</div>
        </ModalContainer>
      );

      expect(container.querySelector('[role="dialog"]')).toBeNull();
    });
  });
});
