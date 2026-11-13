import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import React from "react";
import { CaseStudyHeroActions } from "@/components/CaseStudyHeroActions";

describe("CaseStudyHeroActions URL & platform hostname security", () => {
  afterEach(() => {
    cleanup();
  });

  it.each([
    {
      url: "https://www.kaggle.com/code/fredderuiter/fred-predicting-heart-disease",
      type: "kaggle" as const,
      label: "www.kaggle.com with type=kaggle",
    },
    {
      url: "https://www.kaggle.com/code/fredderuiter/fred-predicting-heart-disease",
      type: undefined,
      label: "www.kaggle.com without externalPlatformType",
    },
    {
      url: "https://kaggle.com/competitions/titanic",
      type: null,
      label: "apex kaggle.com with type=null",
    },
    {
      url: "https://WWW.KAGGLE.COM/code/test",
      type: "kaggle" as const,
      label: "mixed-case WWW.KAGGLE.COM",
    },
  ])(
    "renders Explore on Kaggle for valid Kaggle URL ($label)",
    ({ url, type }) => {
      render(
        <CaseStudyHeroActions
          slug="cardiac-risk-modeling"
          externalPlatformUrl={url}
          externalPlatformType={type}
        />
      );

      const link = screen.getByRole("link", { name: /explore on kaggle/i });
      expect(link.getAttribute("href")).toBe(url);
      expect(link.getAttribute("target")).toBe("_blank");
      expect(link.getAttribute("rel")).toBe("noopener noreferrer");
      expect(screen.queryByText(/view on kaggle/i)).toBeNull();
    }
  );

  it("downgrades mismatched externalPlatformType=kaggle on foreign hosts to External Resource", () => {
    for (const url of [
      "https://equipose.org",
      "https://evil.invalid/notebook",
    ]) {
      cleanup();
      render(
        <CaseStudyHeroActions
          slug="mismatched-kaggle"
          externalPlatformUrl={url}
          externalPlatformType="kaggle"
        />
      );

      const link = screen.getByRole("link", { name: /external resource/i });
      expect(link.getAttribute("href")).toBe(url);
      expect(link.getAttribute("target")).toBe("_blank");
      expect(link.getAttribute("rel")).toBe("noopener noreferrer");
      expect(screen.queryByText(/explore on kaggle/i)).toBeNull();
      expect(screen.queryByText(/view on kaggle/i)).toBeNull();
    }
  });

  it("allows View on PYPI only for trusted PyPI hosts and falls back to External Resource for foreign hosts", () => {
    render(
      <CaseStudyHeroActions
        slug="pypi-valid"
        externalPlatformUrl="https://pypi.org/project/example/"
        externalPlatformType="pypi"
      />
    );
    const validLink = screen.getByRole("link", { name: /view on pypi/i });
    expect(validLink.getAttribute("href")).toBe(
      "https://pypi.org/project/example/"
    );

    cleanup();
    render(
      <CaseStudyHeroActions
        slug="pypi-foreign"
        externalPlatformUrl="https://evil.invalid/pkg"
        externalPlatformType="pypi"
      />
    );
    const foreignLink = screen.getByRole("link", {
      name: /external resource/i,
    });
    expect(foreignLink.getAttribute("href")).toBe("https://evil.invalid/pkg");
    expect(screen.queryByText(/view on pypi/i)).toBeNull();
  });

  it.each([
    "https://kaggle.com.evil.invalid/x",
    "https://www.kaggle.com.evil.invalid/x",
    "https://evil-kaggle.com/x",
    "https://sub.kaggle.com/x",
  ])(
    "never grants Kaggle branding to lookalike or subdomain host %s",
    (lookalikeUrl) => {
      for (const platformType of ["kaggle", null] as const) {
        cleanup();
        render(
          <CaseStudyHeroActions
            slug="lookalike-host"
            externalPlatformUrl={lookalikeUrl}
            externalPlatformType={platformType}
          />
        );

        const link = screen.getByRole("link", { name: /external resource/i });
        expect(link.getAttribute("href")).toBe(lookalikeUrl);
        expect(screen.queryByText(/explore on kaggle/i)).toBeNull();
        expect(screen.queryByText(/view on kaggle/i)).toBeNull();
      }
    }
  );

  it.each([
    "https://evil.invalid/kaggle.com",
    "https://evil.invalid/?ref=https://www.kaggle.com",
    "https://evil.invalid/#kaggle.com",
  ])(
    "never grants Kaggle branding when kaggle.com only appears in path, query, or fragment (%s)",
    (urlWithMention) => {
      for (const platformType of ["kaggle", undefined] as const) {
        cleanup();
        render(
          <CaseStudyHeroActions
            slug="mention-in-url"
            externalPlatformUrl={urlWithMention}
            externalPlatformType={platformType}
          />
        );

        const link = screen.getByRole("link", { name: /external resource/i });
        expect(link.getAttribute("href")).toBe(urlWithMention);
        expect(screen.queryByText(/explore on kaggle/i)).toBeNull();
        expect(screen.queryByText(/view on kaggle/i)).toBeNull();
      }
    }
  );

  it.each([
    "https://kaggle.com@evil.invalid/x",
    "https://user:pass@www.kaggle.com/code/x",
    "https://user@equipose.org",
  ])(
    "rejects and omits external platform link when URL contains userinfo (%s)",
    (userinfoUrl) => {
      render(
        <CaseStudyHeroActions
          slug="userinfo-url"
          externalPlatformUrl={userinfoUrl}
          externalPlatformType="kaggle"
        />
      );

      expect(screen.queryAllByRole("link")).toEqual([]);
    }
  );

  it.each([
    "javascript:alert(1)",
    "JavaScript:alert(1)",
    "data:text/html,<script>alert(1)</script>",
    "vbscript:msgbox(1)",
    "file:///etc/passwd",
    "http://www.kaggle.com/code/x",
    "http://equipose.org",
    "",
    "   ",
    "not-a-url",
    "://bad",
    null,
    undefined,
  ])(
    "rejects dangerous schemes and invalid or missing URLs (%s) while preserving other actions",
    (badUrl) => {
      render(
        <CaseStudyHeroActions
          slug="bad-platform-url"
          githubUrl="https://github.com/fderuiter/example"
          externalPlatformUrl={badUrl}
          externalPlatformType="kaggle"
          interactiveUrl="/simulator"
          interactiveLabel="Launch Studio"
        />
      );

      const links = screen.getAllByRole("link");
      expect(links).toHaveLength(2);
      expect(
        screen.getByRole("link", { name: /fderuiter\/example/i })
      ).toBeDefined();
      expect(
        screen.getByRole("link", { name: /launch studio/i })
      ).toBeDefined();
      expect(screen.queryByText(/explore on kaggle/i)).toBeNull();
      expect(screen.queryByText(/view on kaggle/i)).toBeNull();
      expect(screen.queryByText(/external resource/i)).toBeNull();
    }
  );
});
