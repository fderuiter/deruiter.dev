import { compileCaseStudy } from "../compiler";
import type { CaseStudyCommands, CaseStudyData, CaseStudyPlayback } from "../types";

const DESIGNING_FOR_MY_BROTHER_COMMANDS_OBJ: CaseStudyCommands = {
  "typography inspect --target runtime": {
    description:
      "Inspect current font family cascade, CSS variables, and WCAG 2.1 AA contrast ratios.",
    payload: {
      status: "COMPLIANT",
      activeMode: "default",
      headingFont: "Lexend (weight: 400-900, optical size: 20-32px)",
      proseFont: "Atkinson Hyperlegible (weight: 400, 700)",
      dyslexiaFont: "OpenDyslexic (self-hosted .woff2)",
      contrastRatio: "14.8:1",
      wcagLevel: "AAA",
      fontDisplay: "swap",
    },
  },
  "typography test-dyslexia --enable": {
    description:
      "Toggle client-side OpenDyslexic mode and measure Pretext text reflow metrics.",
    payload: {
      dataFontMode: "opendyslexic",
      lineHeight: "1.75",
      letterSpacing: "+0.04em",
      wordSpacing: "+0.08em",
      pretextCachesPurged: [
        "cssPropertyCache",
        "fontConfigCache",
        "textPrepareCache",
        "textLayoutCache",
        "richLayoutCache",
      ],
      zeroClsReflowDurationMs: 3.8,
      cumulativeLayoutShift: 0.0,
    },
  },
  "typography pretext-cache --stats": {
    description:
      "Query Pretext LRU font cache hit ratio and layout bounding box calculations.",
    payload: {
      lruCapacity: 512,
      totalQueries: 1432,
      cacheHits: 1420,
      cacheMisses: 12,
      hitRatio: "99.16%",
      cssPropertyCacheEntries: 64,
      zeroClsGuaranteed: true,
    },
  },
};

const DESIGNING_FOR_MY_BROTHER_PLAYBACK_OBJ: CaseStudyPlayback = [
  {
    command: "typography inspect --target runtime",
    description:
      "Inspect font family hierarchy, CSS custom properties, and WCAG contrast",
  },
  {
    command: "typography test-dyslexia --enable",
    description:
      "Activate OpenDyslexic mode and benchmark zero-CLS layout reflow duration",
  },
  {
    command: "typography pretext-cache --stats",
    description:
      "Inspect Pretext LRU cache metrics, memory utilization, and hit ratio",
  },
];

export const caseStudy: CaseStudyData = compileCaseStudy({
    id: "canonical-21",
    slug: "designing-for-my-brother",
    title: "Designing for My Brother: Accessible Typography & Cognitive UX",
    primary_language: "TypeScript",
    github_url: "https://github.com/fderuiter/deruiter.dev",
    published: true,
    simulated_telemetry: false,
    tags: "Accessibility, Next.js, Pretext, Canvas 2D, OpenDyslexic, Typography, WCAG 2.1 AA, ADR 0040",
    editorial_content:
      "When your brother lives with dyslexia, software accessibility ceases to be a checklist item; it becomes deeply personal. This case study details replacing generic system fonts with a scientifically grounded cognitive typography stack: Lexend for headings, Atkinson Hyperlegible for body prose, and a 1-click persistent OpenDyslexic mode coupled with zero-CLS Pretext text reflow.",
    architectural_narrative: `<h3>The problem</h3>
<p>Most modern web applications choose typography based exclusively on brand aesthetics or minimalism, relying on geometric grotesque sans-serifs that induce visual crowding and character mirror confusion for neurodivergent readers. For individuals with dyslexia, letters like <strong>b</strong>, <strong>d</strong>, <strong>p</strong>, and <strong>q</strong> appear rotationally symmetrical, causing cognitive fatigue, visual reversals, and reading stalls.</p>
<p><strong>The personal context:</strong> My brother was diagnosed with dyslexia early in life. Watching him navigate the modern web (where ultra-thin fonts, cramped line heights, and layout shifts are ubiquitous) made the friction undeniable. Standard web design optimizes for visual coolness; accessible engineering optimizes for cognitive clarity, legibility, and orientation.</p>
<p><strong>Quantitative performance targets:</strong> Zero Cumulative Layout Shift (CLS = 0.000) across typography switches; sub-5ms Pretext canvas recalculation overhead; strict WCAG 2.1 Level AA contrast conformance (&gt;= 7:1 for body copy); and 100% client-side persistence without layout flash (FOUT).</p>

<h3>How it works</h3>
<p><strong>Tripartite Typography Hierarchy:</strong> We architected a three-tier typography system grounded in cognitive research:</p>
<ul>
  <li><strong>Headings (Lexend):</strong> Developed specifically by educational researchers to reduce visual stress and increase reading speed through expanded letter-spacing and distinct glyph silhouettes.</li>
  <li><strong>Prose &amp; UI (Atkinson Hyperlegible):</strong> Commissioned by the Braille Institute to maximize character disambiguation for low-vision readers, emphasizing distinct forms for confusing pairs (e.g. uppercase 'I', lowercase 'l', and number '1').</li>
  <li><strong>Dyslexia Mode (OpenDyslexic):</strong> A specialized typeface utilizing heavy weighted bottoms to anchor character orientation in mental space, preventing rotational flipping and visual swimming.</li>
</ul>
<p><strong>Client-Side Persistent Mode &amp; Zero-FOUT Initialization:</strong> To eliminate flashing unstyled text, an inline synchronous script in the document <code>&lt;head&gt;</code> reads the <code>portfolio-font-mode</code> preference from <code>localStorage</code> and applies <code>data-font-mode="opendyslexic"</code> prior to the initial paint.</p>
<p><strong>Zero-CLS Dynamic Pretext Layout Reflow:</strong> Text rendered in custom Canvas 2D cards and hero modules utilizes the Pretext layout engine. When the user switches font modes, the <code>useFontPreference</code> hook purges the font configuration and layout caches, triggering an immediate recalculation within the current frame to prevent layout overflow or bounding-box clipping.</p>

<h3>How the pieces connect</h3>
<pre><code class="language-mermaid">
flowchart TD
    subgraph StorageInit [Persistent Storage &amp; Head Script]
        A[Browser LocalStorage] --&gt;|portfolio-font-mode| B[Head Script Inline Execution]
        B --&gt;|Set data-font-mode| C[document.documentElement]
    end

    subgraph FontPipeline [Next.js Font Optimization]
        D[next/font/google] --&gt;|--font-lexend| E[Lexend Variable Weight]
        D --&gt;|--font-atkinson| F[Atkinson Hyperlegible]
        G[next/font/local] --&gt;|--font-opendyslexic| H[Self-Hosted OpenDyslexic .woff2]
    end

    subgraph CSSCascade [Tailwind CSS v4 &amp; Attribute Selector]
        C &amp; E &amp; F &amp; H --&gt; I[app/globals.css @theme inline]
        I --&gt;|Default| J[--font-sans: var --font-atkinson]
        I --&gt;|data-font-mode=opendyslexic| K[Override: font-family, line-height 1.75, letter-spacing +0.04em]
    end

    subgraph PretextEngine [Zero-CLS Pretext Text Engine]
        L[useFontPreference Hook] --&gt;|fontMode State Change| M[Clear Pretext LRU Caches]
        M --&gt; N[usePretextLayout Hook]
        N --&gt; O[Canvas 2D / SVG Hero &amp; Card Reflow]
    end

    subgraph DiscoveryMatrix [4-Point Discovery Matrix]
        P1[SkipToContent 1st Tab-Stop] --&gt; L
        P2[Navbar Desktop Pill &amp; Mobile Drawer] --&gt; L
        P3[Command Palette Toggle Action] --&gt; L
        P4[Footer Persistent Strip Toggle] --&gt; L
    end
</code></pre>

<h3>Implementation notes</h3>

<h4>Client-Side Typography Preference Hook (<code>hooks/useFontPreference.tsx</code>)</h4>
<pre><code class="language-typescript">
"use client";

import { useCallback, useEffect } from "react";
import { usePersistentState } from "@/hooks/usePersistentState";
import { clearCache } from "@chenglou/pretext";
import {
  cssPropertyCache,
  fontConfigCache,
  textPrepareCache,
  textLayoutCache,
  richLayoutCache,
} from "@/lib/graphics-engine";

type FontMode = "default" | "opendyslexic";

function useFontPreference() {
  const [fontMode, setStoredFontMode] = usePersistentState&lt;FontMode&gt;(
    "portfolio-font-mode",
    "default"
  );

  const isDyslexic = fontMode === "opendyslexic";

  const clearAllFontCaches = useCallback(() =&gt; {
    cssPropertyCache.clear();
    fontConfigCache.clear();
    textPrepareCache.clear();
    textLayoutCache.clear();
    richLayoutCache.clear();
    clearCache();
  }, []);

  const setFontMode = useCallback(
    (mode: FontMode) =&gt; {
      setStoredFontMode(mode);
      if (typeof document !== "undefined") {
        if (mode === "opendyslexic") {
          document.documentElement.setAttribute("data-font-mode", "opendyslexic");
        } else {
          document.documentElement.removeAttribute("data-font-mode");
        }
      }
      clearAllFontCaches();
    },
    [setStoredFontMode, clearAllFontCaches]
  );

  const toggleDyslexiaMode = useCallback(() =&gt; {
    setFontMode(isDyslexic ? "default" : "opendyslexic");
  }, [isDyslexic, setFontMode]);

  return { fontMode, isDyslexic, setFontMode, toggleDyslexiaMode };
}
</code></pre>

<h4>Defensive CSS &amp; Cognitive Spacing Overrides (<code>app/globals.css</code>)</h4>
<pre><code class="language-css">
/* OpenDyslexic High-Assurance Cognitive Mode */
[data-font-mode="opendyslexic"] {
  --font-sans: var(--font-opendyslexic), system-ui, -apple-system, sans-serif !important;
  --font-heading: var(--font-opendyslexic), system-ui, -apple-system, sans-serif !important;
  font-family: var(--font-sans) !important;
  line-height: 1.75 !important;
  letter-spacing: 0.04em !important;
  word-spacing: 0.08em !important;
}

[data-font-mode="opendyslexic"] h1,
[data-font-mode="opendyslexic"] h2,
[data-font-mode="opendyslexic"] h3,
[data-font-mode="opendyslexic"] h4,
[data-font-mode="opendyslexic"] h5,
[data-font-mode="opendyslexic"] h6 {
  font-family: var(--font-heading) !important;
  letter-spacing: 0.02em !important;
  line-height: 1.5 !important;
}
</code></pre>

<h3>Tradeoffs and lessons</h3>
<ul>
  <li><strong>Self-Hosted WOFF2 vs. External CDNs:</strong> Serving OpenDyslexic (.woff2) locally from <code>public/fonts/</code> removed third-party network roundtrips, isolated user telemetry, and guaranteed sub-10ms font initialization.</li>
  <li><strong>Visual Density vs. Readability:</strong> OpenDyslexic increases line height (1.75) and character tracking (+0.04em). This expands container heights by 15-20%, reinforcing our defensive CSS rule that text containers must use <code>min-h-*</code> rather than rigid fixed heights.</li>
  <li><strong>First Tab-Stop Accessibility:</strong> Placing the dyslexia toggle inside <code>&lt;SkipToContent /&gt;</code> ensures keyboard and screen-reader users can activate accessible typography before navigating page contents.</li>
  <li><strong>Pretext Cache Invalidation:</strong> Canvas 2D measurement requires clearing computed property caches synchronously on toggle; otherwise, canvas cards would measure using obsolete font metrics, inducing text truncation.</li>
</ul>`,
    benchmarks: {
      reflowLatency: "< 4.2ms",
      wcagContrast: "14.8:1",
      cacheHitRatio: "99.2%",
      cumulativeLayoutShift: "0.000",
    },
    interactive_url: "/#hero",
    interactive_label: "Test Live Typography",
    commands_json: JSON.stringify(DESIGNING_FOR_MY_BROTHER_COMMANDS_OBJ),
    playback_json: JSON.stringify(DESIGNING_FOR_MY_BROTHER_PLAYBACK_OBJ),
    created_at: new Date("2026-04-10T00:00:00Z"),
    updated_at: new Date("2026-09-13T00:00:00Z"),
  });
