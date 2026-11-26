import React from "react";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
  cleanup,
} from "@testing-library/react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { ProjectImageUploader } from "@/components/admin/ProjectImageUploader";

vi.mock("next/image", () => ({
  default: ({ src, alt }: React.ComponentProps<"img">) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} />
  ),
}));

const projects = [
  {
    slug: "laser-loon",
    title: "Laser Loon",
    hero_image_url: "/api/media/project-laser-loon-old.png",
  },
  { slug: "schemaflow", title: "SchemaFlow", hero_image_url: null },
];

interface PendingRequest {
  url: string;
  method: string;
  signal: AbortSignal | undefined;
  resolve: (heroImageUrl: string) => void;
  /** Settles an aborted request's rejection, which the test releases on demand. */
  releaseAbort: () => void;
}

/** A fetch stand-in whose responses and abort rejections settle only when the test says so. */
function installControlledFetch() {
  const requests: PendingRequest[] = [];
  global.fetch = vi
    .fn()
    .mockImplementation((url: string, options?: RequestInit) => {
      return new Promise((resolve, reject) => {
        let aborted = false;
        const request: PendingRequest = {
          url: String(url),
          method: options?.method ?? "GET",
          signal: options?.signal ?? undefined,
          resolve: (heroImageUrl) =>
            resolve({
              ok: true,
              status: 200,
              json: async () => ({ hero_image_url: heroImageUrl }),
            }),
          releaseAbort: () => {
            if (!aborted) return;
            const err = new Error("The user aborted a request.");
            err.name = "AbortError";
            reject(err);
          },
        };
        options?.signal?.addEventListener("abort", () => {
          aborted = true;
        });
        requests.push(request);
      });
    });
  return requests;
}

function chooseFile(name = "hero.png") {
  const input = screen.getByTestId("project-image-input");
  fireEvent.change(input, {
    target: { files: [new File(["img"], name, { type: "image/png" })] },
  });
}

function clickUpload() {
  fireEvent.click(
    screen.getByRole("button", { name: /Confirm & Upload Project Image/i })
  );
}

describe("ProjectImageUploader keeps each operation bound to its own request (#3808)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    global.URL.createObjectURL = vi.fn(() => "blob:http://localhost/preview");
    global.URL.revokeObjectURL = vi.fn();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("a response for the previous project does not show success on the newly selected one", async () => {
    const requests = installControlledFetch();
    const onUploadSuccess = vi.fn();
    render(
      <ProjectImageUploader
        initialProjects={projects}
        defaultSlug="laser-loon"
        onUploadSuccess={onUploadSuccess}
      />
    );

    chooseFile();
    clickUpload();
    await waitFor(() => expect(requests).toHaveLength(1));
    expect(requests[0]!.url).toContain("/api/admin/projects/laser-loon/image");

    fireEvent.change(screen.getByLabelText(/Target Project Slug/i), {
      target: { value: "schemaflow" },
    });

    await act(async () => {
      requests[0]!.resolve("/api/media/project-laser-loon-new.png");
    });

    // The server stored the image for laser-loon, so the parent hears about laser-loon.
    await waitFor(() =>
      expect(onUploadSuccess).toHaveBeenCalledWith(
        "laser-loon",
        "/api/media/project-laser-loon-new.png"
      )
    );
    // SchemaFlow's view stays idle: no success banner, no progress bar.
    expect(screen.queryByTestId("project-image-upload-success")).toBeNull();
    expect(screen.queryByRole("progressbar")).toBeNull();

    // Switching back shows the image the old request stored.
    fireEvent.change(screen.getByLabelText(/Target Project Slug/i), {
      target: { value: "laser-loon" },
    });
    expect(
      screen.getByText("/api/media/project-laser-loon-new.png")
    ).toBeDefined();
  });

  it("a cancelled request settling late cannot clear the controller or status of a newer upload", async () => {
    const requests = installControlledFetch();
    render(
      <ProjectImageUploader
        initialProjects={projects}
        defaultSlug="laser-loon"
      />
    );

    chooseFile();
    clickUpload();
    await waitFor(() => expect(requests).toHaveLength(1));

    fireEvent.click(screen.getByRole("button", { name: /Cancel Upload/i }));
    expect(requests[0]!.signal?.aborted).toBe(true);
    expect(screen.getByTestId("project-image-upload-cancelled")).toBeDefined();

    // Retry starts a second request while the first one's rejection is still pending.
    fireEvent.click(screen.getByRole("button", { name: /^Retry$/i }));
    await waitFor(() => expect(requests).toHaveLength(2));
    expect(screen.getByRole("progressbar")).toBeDefined();

    await act(async () => {
      requests[0]!.releaseAbort();
    });

    // The old request's catch and finally leave the new upload alone.
    expect(screen.getByRole("progressbar")).toBeDefined();
    expect(screen.queryByTestId("project-image-upload-cancelled")).toBeNull();

    // The new upload can still be cancelled, which proves its controller survived.
    fireEvent.click(screen.getByRole("button", { name: /Cancel Upload/i }));
    expect(requests[1]!.signal?.aborted).toBe(true);
  });

  it("disables Clear while an upload is in flight, so the two mutations cannot overlap", async () => {
    const requests = installControlledFetch();
    render(
      <ProjectImageUploader
        initialProjects={projects}
        defaultSlug="laser-loon"
      />
    );

    const clear = screen.getByRole("button", { name: /Clear/i });
    expect((clear as HTMLButtonElement).disabled).toBe(false);

    chooseFile();
    clickUpload();
    await waitFor(() => expect(requests).toHaveLength(1));

    expect(
      (screen.getByRole("button", { name: /Clear/i }) as HTMLButtonElement)
        .disabled
    ).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: /Clear/i }));
    expect(requests.filter((r) => r.method === "DELETE")).toHaveLength(0);
  });

  it("a clear response for the previous project does not reset the newly selected one", async () => {
    const requests = installControlledFetch();
    render(
      <ProjectImageUploader
        initialProjects={projects}
        defaultSlug="laser-loon"
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /Clear/i }));
    await waitFor(() => expect(requests).toHaveLength(1));
    expect(requests[0]!.method).toBe("DELETE");
    expect(requests[0]!.url).toContain("/api/admin/projects/laser-loon/image");

    fireEvent.change(screen.getByLabelText(/Target Project Slug/i), {
      target: { value: "schemaflow" },
    });
    chooseFile("schema.png");
    expect(screen.getByText("schema.png")).toBeDefined();

    await act(async () => {
      requests[0]!.resolve("");
    });

    // The file picked for SchemaFlow survives; laser-loon's image is cleared.
    expect(screen.getByText("schema.png")).toBeDefined();
    fireEvent.change(screen.getByLabelText(/Target Project Slug/i), {
      target: { value: "laser-loon" },
    });
    expect(
      screen.queryByText("/api/media/project-laser-loon-old.png")
    ).toBeNull();
  });

  it("aborts the in-flight upload when the uploader unmounts", async () => {
    const requests = installControlledFetch();
    const { unmount } = render(
      <ProjectImageUploader
        initialProjects={projects}
        defaultSlug="laser-loon"
      />
    );

    chooseFile();
    clickUpload();
    await waitFor(() => expect(requests).toHaveLength(1));

    unmount();
    expect(requests[0]!.signal?.aborted).toBe(true);
    expect(global.URL.revokeObjectURL).toHaveBeenCalledWith(
      "blob:http://localhost/preview"
    );
  });
});
