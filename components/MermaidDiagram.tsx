"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { MermaidConfig } from "mermaid";

interface MermaidDiagramProps {
  source: string;
}

type RenderState = "loading" | "ready" | "error";
type MermaidModule = typeof import("mermaid");

const MERMAID_CONFIG = {
  startOnLoad: false,
  securityLevel: "antiscript",
  theme: "base",
  fontFamily: "var(--font-geist-mono), ui-monospace, SFMono-Regular, monospace",
  themeVariables: {
    background: "#13151a",
    primaryColor: "#181b22",
    primaryTextColor: "#f4f4f6",
    primaryBorderColor: "#64748b",
    lineColor: "#94a3b8",
    secondaryColor: "#171a20",
    tertiaryColor: "#0d0e11",
    clusterBkg: "#13151a",
    clusterBorder: "#475569",
  },
  flowchart: {
    htmlLabels: false,
    useMaxWidth: false,
  },
} satisfies MermaidConfig;

let mermaidModulePromise: Promise<MermaidModule> | undefined;
let configuredMermaid: MermaidModule["default"] | undefined;
let mermaidRenderQueue: Promise<void> = Promise.resolve();
let mermaidRenderInvocation = 0;

async function getMermaid() {
  mermaidModulePromise ??= import("mermaid");
  const mermaidPackage = await mermaidModulePromise;

  if (configuredMermaid !== mermaidPackage.default) {
    mermaidPackage.default.initialize(MERMAID_CONFIG);
    configuredMermaid = mermaidPackage.default;
  }

  return mermaidPackage.default;
}

function renderMermaid(
  mermaid: MermaidModule["default"],
  id: string,
  source: string,
  container: Element
) {
  const render = mermaidRenderQueue.then(() =>
    mermaid.render(id, source, container)
  );

  mermaidRenderQueue = render.then(
    () => undefined,
    () => undefined
  );

  return render;
}

/**
 * Renders trusted narrative Mermaid source in an isolated SVG host.
 * The renderer is lazy-loaded so case studies without diagrams keep the library
 * out of their client bundle.
 */
export function MermaidDiagram({ source }: MermaidDiagramProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const descriptionId = useId();
  const diagramId = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const [renderState, setRenderState] = useState<RenderState>("loading");

  useEffect(() => {
    const host = hostRef.current;
    if (!host) {
      return;
    }

    let cancelled = false;
    host.replaceChildren();
    setRenderState("loading");

    const renderDiagram = async () => {
      try {
        const mermaid = await getMermaid();
        const { svg } = await renderMermaid(
          mermaid,
          `case-study-mermaid-${diagramId}-${++mermaidRenderInvocation}`,
          source.trim(),
          host
        );

        if (cancelled) {
          return;
        }

        if (!svg.includes("<svg")) {
          throw new Error("Mermaid did not produce an SVG diagram.");
        }

        host.innerHTML = svg;
        setRenderState("ready");
      } catch {
        if (!cancelled) {
          host.replaceChildren();
          setRenderState("error");
        }
      }
    };

    void renderDiagram();

    return () => {
      cancelled = true;
      host.replaceChildren();
    };
  }, [diagramId, source]);

  if (renderState === "error") {
    return (
      <figure
        className="my-8 rounded-xl border border-amber-500/40 bg-amber-500/5 p-4 text-sm text-amber-100"
        data-mermaid-diagram
        data-mermaid-error
      >
        <figcaption className="font-mono text-xs uppercase tracking-[0.16em] text-amber-300">
          Architecture diagram unavailable
        </figcaption>
        <p className="mt-2">
          This diagram could not be rendered from its stored definition.
        </p>
        <details className="mt-3">
          <summary className="cursor-pointer font-medium">
            View diagram source
          </summary>
          <pre className="mt-3 overflow-x-auto rounded border border-amber-500/20 bg-[#0d0e11] p-3 text-xs text-amber-50">
            <code>{source}</code>
          </pre>
        </details>
      </figure>
    );
  }

  return (
    <figure className="my-8" data-mermaid-diagram>
      <figcaption className="mb-2 font-mono text-xs uppercase tracking-[0.16em] text-muted">
        Architecture diagram
      </figcaption>
      <div
        aria-busy={renderState === "loading"}
        aria-describedby={descriptionId}
        aria-label="Architecture diagram"
        className="overflow-x-auto rounded-xl border border-zinc-800 bg-[#13151a] p-3 sm:p-5"
        role="img"
        tabIndex={0}
      >
        <span className="sr-only" id={descriptionId}>
          Mermaid source alternative: {source}
        </span>
        <div aria-hidden="true" className="min-w-max" ref={hostRef} />
      </div>
    </figure>
  );
}
