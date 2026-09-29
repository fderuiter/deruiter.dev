import React from "react";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  cleanup,
} from "@testing-library/react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { ProjectImageUploader } from "@/components/admin/ProjectImageUploader";
import { CaseStudyBentoCard } from "@/components/ui/CaseStudyBentoCard";
import { BaseCaseStudy } from "@/types/domain";

// Mock BentoLayoutContext and TerminologyProvider
vi.mock("@/components/providers/BentoLayoutContext", () => ({
  useBentoLayout: () => ({
    heightOverrides: {},
    registerHeightOverride: vi.fn(),
    clearHeightOverride: vi.fn(),
    setTransitioning: vi.fn(),
  }),
}));

vi.mock("@/components/providers/TerminologyProvider", () => ({
  useTerminology: () => ({
    mode: "standard",
    toggleMode: vi.fn(),
  }),
}));

vi.mock("next/image", () => ({
  default: ({ src, alt }: React.ComponentProps<"img">) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} />
  ),
}));

const mockProjects = [
  {
    slug: "laser-loon",
    title: "Laser Loon",
    hero_image_url: "/api/media/project-laser-loon-test.png",
  },
  {
    slug: "schemaflow",
    title: "SchemaFlow",
    hero_image_url: null,
  },
];

describe("ProjectImageUploader Component", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    global.URL.createObjectURL = vi.fn(
      () => "blob:http://localhost/test-preview"
    );
    global.URL.revokeObjectURL = vi.fn();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders target project selector and initial active asset preview", () => {
    render(
      <ProjectImageUploader
        initialProjects={mockProjects}
        defaultSlug="laser-loon"
      />
    );

    expect(screen.getByLabelText(/Target Project Slug/i)).toBeDefined();
    expect(screen.getByText(/Active Persisted Asset/i)).toBeDefined();
    expect(
      screen.getByText(/\/api\/media\/project-laser-loon-test\.png/i)
    ).toBeDefined();
  });

  it("validates file size and rejects files over 5MB", async () => {
    render(
      <ProjectImageUploader
        initialProjects={mockProjects}
        defaultSlug="laser-loon"
      />
    );

    const fileInput = screen.getByTestId("project-image-input");
    const oversizedFile = new File(
      [new ArrayBuffer(6 * 1024 * 1024)],
      "large.png",
      {
        type: "image/png",
      }
    );

    fireEvent.change(fileInput, { target: { files: [oversizedFile] } });

    await waitFor(() => {
      expect(
        screen.getByTestId("project-image-upload-error").textContent
      ).toMatch(/exceeds maximum allowed limit of 5MB/i);
    });
  });

  it("validates file format and rejects unsupported types", async () => {
    render(
      <ProjectImageUploader
        initialProjects={mockProjects}
        defaultSlug="laser-loon"
      />
    );

    const fileInput = screen.getByTestId("project-image-input");
    const invalidFile = new File(["test content"], "document.pdf", {
      type: "application/pdf",
    });

    fireEvent.change(fileInput, { target: { files: [invalidFile] } });

    await waitFor(() => {
      expect(
        screen.getByTestId("project-image-upload-error").textContent
      ).toMatch(/Invalid file format/i);
    });
  });

  it("handles successful file selection, upload execution, and success state", async () => {
    const onUploadSuccess = vi.fn();
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          slug: "laser-loon",
          hero_image_url: "/api/media/project-laser-loon-new.png",
          key: "project-laser-loon-new.png",
        },
      }),
    });

    render(
      <ProjectImageUploader
        initialProjects={mockProjects}
        defaultSlug="laser-loon"
        onUploadSuccess={onUploadSuccess}
      />
    );

    const fileInput = screen.getByTestId("project-image-input");
    const validFile = new File(["valid image"], "hero.png", {
      type: "image/png",
    });

    fireEvent.change(fileInput, { target: { files: [validFile] } });

    await waitFor(() => {
      expect(screen.getByText("hero.png")).toBeDefined();
    });

    const uploadButton = screen.getByRole("button", {
      name: /Confirm & Upload Project Image/i,
    });
    fireEvent.click(uploadButton);

    await waitFor(() => {
      expect(
        screen.getByText(/Image uploaded & persisted successfully/i)
      ).toBeDefined();
      expect(onUploadSuccess).toHaveBeenCalledWith(
        "laser-loon",
        "/api/media/project-laser-loon-new.png"
      );
    });
  });

  it("handles upload cancellation using AbortController and displays cancelled state", async () => {
    global.fetch = vi.fn().mockImplementation((_url, options) => {
      return new Promise((_resolve, reject) => {
        if (options?.signal) {
          options.signal.addEventListener("abort", () => {
            const err = new Error("The user aborted a request.");
            err.name = "AbortError";
            reject(err);
          });
        }
      });
    });

    render(
      <ProjectImageUploader
        initialProjects={mockProjects}
        defaultSlug="laser-loon"
      />
    );

    const fileInput = screen.getByTestId("project-image-input");
    const validFile = new File(["valid image"], "hero.png", {
      type: "image/png",
    });

    fireEvent.change(fileInput, { target: { files: [validFile] } });

    const uploadButton = screen.getByRole("button", {
      name: /Confirm & Upload Project Image/i,
    });
    fireEvent.click(uploadButton);

    await waitFor(() => {
      expect(screen.getByRole("progressbar")).toBeDefined();
    });

    const cancelButton = screen.getByRole("button", { name: /Cancel Upload/i });
    fireEvent.click(cancelButton);

    await waitFor(() => {
      expect(
        screen.getByText(/Upload cancelled. Prior asset preserved/i)
      ).toBeDefined();
    });
    expect(global.URL.revokeObjectURL).toHaveBeenCalledWith(
      "blob:http://localhost/test-preview"
    );
  });

  it("renders recoverable error state with Retry Upload button on server error", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: "Server processing error" }),
    });

    render(
      <ProjectImageUploader
        initialProjects={mockProjects}
        defaultSlug="laser-loon"
      />
    );

    const fileInput = screen.getByTestId("project-image-input");
    const validFile = new File(["valid image"], "hero.png", {
      type: "image/png",
    });

    fireEvent.change(fileInput, { target: { files: [validFile] } });

    const uploadButton = screen.getByRole("button", {
      name: /Confirm & Upload Project Image/i,
    });
    fireEvent.click(uploadButton);

    await waitFor(() => {
      expect(
        screen.getByTestId("project-image-upload-error").textContent
      ).toMatch(/Server processing error/i);
      expect(
        screen.getByRole("button", { name: /Retry Upload/i })
      ).toBeDefined();
    });
  });

  it("revokes object URL on file change, file removal, and component unmount", () => {
    const { unmount } = render(
      <ProjectImageUploader
        initialProjects={mockProjects}
        defaultSlug="laser-loon"
      />
    );

    const fileInput = screen.getByTestId("project-image-input");
    const file1 = new File(["image 1"], "img1.png", { type: "image/png" });
    const file2 = new File(["image 2"], "img2.png", { type: "image/png" });

    fireEvent.change(fileInput, { target: { files: [file1] } });
    expect(global.URL.createObjectURL).toHaveBeenCalledTimes(1);

    // Change file
    fireEvent.change(fileInput, { target: { files: [file2] } });
    expect(global.URL.revokeObjectURL).toHaveBeenCalledWith(
      "blob:http://localhost/test-preview"
    );

    // Unmount
    unmount();
    expect(global.URL.revokeObjectURL).toHaveBeenCalled();
  });
});

describe("Public Project Experience Image Rendering", () => {
  it("renders project hero image banner on CaseStudyBentoCard when hero_image_url is present", () => {
    const studyWithImage: BaseCaseStudy & { githubStats: null } = {
      id: "cs_1",
      slug: "laser-loon",
      title: "Laser Loon",
      primary_language: "TypeScript",
      github_url: "https://github.com/test/laser-loon",
      published: true,
      simulated_telemetry: false,
      tags: "game, canvas",
      editorial_content: "Editorial narrative summary",
      architectural_narrative: "Architectural deep dive",
      hero_image_url: "/api/media/project-laser-loon-hero.png",
      created_at: new Date(),
      updated_at: new Date(),
      githubStats: null,
    };

    render(<CaseStudyBentoCard study={studyWithImage} />);

    const img = screen.getByAltText(/Validated project media for Laser Loon/i);
    expect(img).toBeDefined();
    expect(img.getAttribute("src")).toBe(
      "/api/media/project-laser-loon-hero.png"
    );
  });
});
