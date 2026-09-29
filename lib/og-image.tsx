import fs from "node:fs";
import path from "node:path";
import { ImageResponse } from "next/og";

export const OG_IMAGE_SIZE = {
  width: 1200,
  height: 630,
};

export const OG_IMAGE_CONTENT_TYPE = "image/png";

/**
 * Upper bound for a rendered card. WhatsApp drops link previews around
 * 300 KB, so cards stay under 250 KB with headroom (ADR 0053).
 */
export const OG_IMAGE_MAX_BYTES = 250 * 1024;

const OG_FONT_DIRECTORY = ["assets", "og-fonts"] as const;
const OG_FONT_SOURCES = [
  { name: "Lexend", file: "lexend-latin-400-normal.woff", weight: 400 },
  { name: "Lexend", file: "lexend-latin-700-normal.woff", weight: 700 },
  { name: "Geist Mono", file: "geist-mono-latin-400-normal.woff", weight: 400 },
  { name: "Geist Mono", file: "geist-mono-latin-700-normal.woff", weight: 700 },
] as const;

interface OgFont {
  name: string;
  data: ArrayBuffer;
  weight: 400 | 700;
  style: "normal";
}

let fontCache: OgFont[] | null = null;
let laserLoonPreviewCache: string | null = null;

function readAsset(...segments: string[]): Buffer {
  return fs.readFileSync(path.join(process.cwd(), ...segments));
}

/**
 * Brand font buffers for Satori (Lexend body, Geist Mono telemetry), read
 * once per server process and kept in memory. If the files cannot be read the
 * card falls back to the system sans-serif rather than failing the request,
 * and the next call tries again.
 */
export function getOgFonts(): OgFont[] {
  if (fontCache) return fontCache;
  try {
    fontCache = OG_FONT_SOURCES.map((source) => ({
      name: source.name,
      data: new Uint8Array(readAsset(...OG_FONT_DIRECTORY, source.file)).buffer,
      weight: source.weight,
      style: "normal" as const,
    }));
    return fontCache;
  } catch {
    return [];
  }
}

/** Web-safe Laser Loon artwork as a data URI, cached in memory; null if unreadable. */
function getLaserLoonPreview(): string | null {
  if (laserLoonPreviewCache) return laserLoonPreviewCache;
  try {
    laserLoonPreviewCache = `data:image/png;base64,${readAsset("public", "og", "laser-loon-preview.png").toString("base64")}`;
    return laserLoonPreviewCache;
  } catch {
    return null;
  }
}

/** Byte length of a rendered card, for budget checks. Clones so the response stays readable. */
export async function getOgImageByteLength(
  response: Response
): Promise<number> {
  return (await response.clone().arrayBuffer()).byteLength;
}

const SANS = "Lexend, sans-serif";
const MONO = "Geist Mono, monospace";

/** Facts shown as technical dossier chips on case study and blog cards. */
export interface DossierChips {
  readingTime?: string;
  publishedAt?: string;
  language?: string;
  verified?: boolean;
}

export type SocialPreset =
  | "SYSTEMS_ARCHITECTURE"
  | "CLINICAL_SYSTEMS"
  | "FORMAL_VERIFICATION"
  | "VECTOR_ARTWORK"
  | "EMBEDDED_SIMULATOR";

export const PRESET_CONFIGS: Record<
  SocialPreset,
  { category: string; badge: string; systemStatus: string; tags: string[] }
> = {
  SYSTEMS_ARCHITECTURE: {
    category: "SYSTEMS ARCHITECTURE",
    badge: "SYS-ARCH",
    systemStatus: "SYSTEMS ONLINE // READY",
    tags: [
      "React 19",
      "Next.js 16",
      "TypeScript",
      "Pretext Engine",
      "Neon Postgres",
    ],
  },
  CLINICAL_SYSTEMS: {
    category: "CLINICAL DATA SYSTEMS",
    badge: "CDISC 2.2",
    systemStatus: "CDISC COMPLIANT // GxP READY",
    tags: [
      "CDISC CDASH",
      "ODM-XML",
      "AST Edit Checks",
      "21 CFR Part 11",
      "EDC Simulator",
    ],
  },
  FORMAL_VERIFICATION: {
    category: "FORMAL METHODS & LOGIC",
    badge: "LEAN AST",
    systemStatus: "THEOREM PROVEN // Q.E.D.",
    tags: [
      "Deductive Logic",
      "Formal Proofs",
      "AST Verification",
      "Graph Theory",
      "Type Systems",
    ],
  },
  VECTOR_ARTWORK: {
    category: "GRAPHIC DESIGN & OPEN ASSETS",
    badge: "MN FLAG F277",
    systemStatus: "CREATIVE COMMONS // OPEN ASSETS",
    tags: [
      "Vector Asset Hub",
      "SVG / AI / EPS",
      "Laser Loon",
      "State Flag F277",
      "Creative Commons",
    ],
  },
  EMBEDDED_SIMULATOR: {
    category: "EMBEDDED SYSTEMS & HARDWARE",
    badge: "CONNECT IQ",
    systemStatus: "32KB HEAP // CPU BOUND",
    tags: [
      "Garmin Monkey C",
      "32KB RAM Profiling",
      "MIP Display",
      "Thermal Modeling",
      "Embedded OS",
    ],
  },
};

export interface SocialImageOptions {
  preset?: SocialPreset;
  category?: string;
  title: string;
  description?: string;
  badge?: string;
  tags?: string[];
  systemStatus?: string;
  /** Dossier chips; rendered for the SYSTEMS_ARCHITECTURE preset only. */
  dossier?: DossierChips;
}

const ARTIFACT_WIDTH = 340;

function ArtifactFrame({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: ARTIFACT_WIDTH,
        flexShrink: 0,
        marginLeft: "48px",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {children}
    </div>
  );
}

function LaserLoonArtwork({ src }: { src: string }) {
  return (
    <ArtifactFrame>
      {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text */}
      <img
        src={src}
        width={ARTIFACT_WIDTH}
        height={191}
        style={{
          borderRadius: "10px",
          border: "1.5px solid #1E293B",
        }}
      />
    </ArtifactFrame>
  );
}

/** Miniature 12-column form designer: a column ruler over rows of spanning fields. */
function FormDesignerMockup() {
  const rows: number[][] = [[12], [8, 4], [4, 4, 4], [3, 3, 3, 3]];
  return (
    <ArtifactFrame>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: "100%",
          padding: "14px",
          background: "#0F172A",
          border: "1.5px solid #1E293B",
          borderRadius: "12px",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            color: "#22D3EE",
            fontFamily: MONO,
            fontSize: 11,
            letterSpacing: "0.12em",
            marginBottom: "10px",
          }}
        >
          <div style={{ display: "flex" }}>FORM DESIGNER</div>
          <div style={{ display: "flex" }}>12 COL</div>
        </div>
        <div style={{ display: "flex", gap: "4px", marginBottom: "10px" }}>
          {Array.from({ length: 12 }, (_, index) => (
            <div
              key={index}
              style={{
                display: "flex",
                flex: 1,
                height: "6px",
                borderRadius: "2px",
                background: "rgba(6, 182, 212, 0.35)",
              }}
            />
          ))}
        </div>
        {rows.map((spans, rowIndex) => (
          <div
            key={rowIndex}
            style={{
              display: "flex",
              gap: "6px",
              marginBottom: rowIndex === rows.length - 1 ? 0 : "8px",
            }}
          >
            {spans.map((span, cellIndex) => (
              <div
                key={cellIndex}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "center",
                  flex: span,
                  height: "40px",
                  padding: "0 8px",
                  background: "#090D16",
                  border: "1px solid #334155",
                  borderRadius: "6px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    width: "60%",
                    height: "5px",
                    borderRadius: "2px",
                    background: "#64748B",
                    marginBottom: "5px",
                  }}
                />
                <div
                  style={{
                    display: "flex",
                    width: "100%",
                    height: "8px",
                    borderRadius: "2px",
                    background: "#1E293B",
                  }}
                />
              </div>
            ))}
          </div>
        ))}
      </div>
    </ArtifactFrame>
  );
}

/** 218x218 memory-in-pixel watch face: bezel, display, and a heap meter. */
function WatchFace() {
  const filled = 7;
  return (
    <ArtifactFrame>
      <div
        style={{
          display: "flex",
          width: 218,
          height: 218,
          borderRadius: "50%",
          border: "6px solid #334155",
          background: "#000000",
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "column",
        }}
      >
        <div
          style={{
            display: "flex",
            color: "#64748B",
            fontFamily: MONO,
            fontSize: 12,
            letterSpacing: "0.12em",
          }}
        >
          MIP 218x218
        </div>
        <div
          style={{
            display: "flex",
            color: "#F8FAFC",
            fontFamily: MONO,
            fontWeight: 700,
            fontSize: 44,
            margin: "6px 0",
          }}
        >
          32KB
        </div>
        <div style={{ display: "flex", gap: "3px" }}>
          {Array.from({ length: 10 }, (_, index) => (
            <div
              key={index}
              style={{
                display: "flex",
                width: "10px",
                height: "14px",
                background: index < filled ? "#10B981" : "#1E293B",
              }}
            />
          ))}
        </div>
        <div
          style={{
            display: "flex",
            color: "#10B981",
            fontFamily: MONO,
            fontSize: 11,
            letterSpacing: "0.12em",
            marginTop: "6px",
          }}
        >
          HEAP
        </div>
      </div>
    </ArtifactFrame>
  );
}

function DossierPanel({ dossier }: { dossier: DossierChips }) {
  const rows: Array<[string, string]> = [];
  if (dossier.readingTime) rows.push(["READING TIME", dossier.readingTime]);
  if (dossier.publishedAt) rows.push(["PUBLISHED", dossier.publishedAt]);
  if (dossier.language) rows.push(["LANGUAGE", dossier.language]);
  if (rows.length === 0 && !dossier.verified) return null;
  return (
    <ArtifactFrame>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: "100%",
          padding: "16px",
          background: "#0F172A",
          border: "1.5px solid #1E293B",
          borderRadius: "12px",
        }}
      >
        <div
          style={{
            display: "flex",
            color: "#22D3EE",
            fontFamily: MONO,
            fontSize: 11,
            letterSpacing: "0.14em",
            marginBottom: "12px",
          }}
        >
          TECHNICAL DOSSIER
        </div>
        {rows.map(([label, value]) => (
          <div
            key={label}
            style={{
              display: "flex",
              flexDirection: "column",
              marginBottom: "10px",
            }}
          >
            <div
              style={{
                display: "flex",
                color: "#64748B",
                fontFamily: MONO,
                fontSize: 10,
                letterSpacing: "0.12em",
              }}
            >
              {label}
            </div>
            <div
              style={{
                display: "flex",
                color: "#F8FAFC",
                fontFamily: MONO,
                fontSize: 16,
                fontWeight: 700,
              }}
            >
              {value}
            </div>
          </div>
        ))}
        {dossier.verified && (
          <div
            style={{
              display: "flex",
              alignSelf: "flex-start",
              padding: "4px 10px",
              borderRadius: "100px",
              border: "1px solid rgba(16, 185, 129, 0.5)",
              background: "rgba(16, 185, 129, 0.1)",
              color: "#10B981",
              fontFamily: MONO,
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.1em",
            }}
          >
            VERIFIED
          </div>
        )}
      </div>
    </ArtifactFrame>
  );
}

function renderArtifact(
  preset: SocialPreset | undefined,
  dossier: DossierChips | undefined
): React.ReactNode {
  switch (preset) {
    case "VECTOR_ARTWORK": {
      const src = getLaserLoonPreview();
      return src ? <LaserLoonArtwork src={src} /> : null;
    }
    case "CLINICAL_SYSTEMS":
      return <FormDesignerMockup />;
    case "EMBEDDED_SIMULATOR":
      return <WatchFace />;
    case "SYSTEMS_ARCHITECTURE":
      return dossier ? <DossierPanel dossier={dossier} /> : null;
    default:
      return null;
  }
}

/**
 * Generates an OpenGraph / Twitter Social Preview Card ImageResponse
 * featuring the Frederick de Ruiter systems architecture visual identity.
 */
export function createSocialImageResponse(
  options: SocialImageOptions
): ImageResponse {
  const presetConfig = options.preset
    ? PRESET_CONFIGS[options.preset]
    : undefined;

  const {
    category = presetConfig?.category || "SYSTEMS ARCHITECTURE",
    title,
    description = "A high-performance design engineering showcase combining DOM-free canvas layout physics, serverless Neon Postgres data streams, and robust clinical CDISC data engines.",
    badge = presetConfig?.badge,
    tags = presetConfig?.tags || [
      "React 19",
      "Canvas 2D",
      "TypeScript",
      "Pretext Engine",
      "Neon Postgres",
    ],
    systemStatus = presetConfig?.systemStatus || "SYSTEMS ONLINE // READY",
  } = options;

  const artifact = renderArtifact(options.preset, options.dossier);

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        background: "#090D16",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "60px 70px",
        position: "relative",
        fontFamily: SANS,
        overflow: "hidden",
      }}
    >
      {/* Ambient background glow orbs */}
      <div
        style={{
          position: "absolute",
          top: "-120px",
          right: "-120px",
          width: "520px",
          height: "520px",
          borderRadius: "50%",
          background: "rgba(6, 182, 212, 0.12)",
          filter: "blur(100px)",
          display: "flex",
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: "-100px",
          left: "-100px",
          width: "480px",
          height: "480px",
          borderRadius: "50%",
          background: "rgba(16, 185, 129, 0.10)",
          filter: "blur(100px)",
          display: "flex",
        }}
      />
      <div
        style={{
          position: "absolute",
          top: "40%",
          left: "45%",
          width: "350px",
          height: "350px",
          borderRadius: "50%",
          background: "rgba(59, 130, 246, 0.06)",
          filter: "blur(90px)",
          display: "flex",
        }}
      />

      {/* Top Header Bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          width: "100%",
        }}
      >
        {/* Brand Mark + Identity */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "16px",
          }}
        >
          {/* 'F' Monogram Icon Box */}
          <div
            style={{
              width: "48px",
              height: "48px",
              borderRadius: "12px",
              background: "#0F172A",
              border: "1.5px solid #1E293B",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              position: "relative",
            }}
          >
            <div
              style={{
                display: "flex",
                width: "28px",
                height: "28px",
                position: "relative",
              }}
            >
              {/* Stem */}
              <div
                style={{
                  position: "absolute",
                  left: "2px",
                  top: "2px",
                  width: "5px",
                  height: "24px",
                  background: "#F8FAFC",
                  borderRadius: "2px",
                }}
              />
              {/* Top Bar */}
              <div
                style={{
                  position: "absolute",
                  left: "10px",
                  top: "2px",
                  width: "14px",
                  height: "5px",
                  background: "linear-gradient(90deg, #06B6D4, #10B981)",
                  borderRadius: "2px",
                }}
              />
              {/* Mid Bar */}
              <div
                style={{
                  position: "absolute",
                  left: "10px",
                  top: "11px",
                  width: "9px",
                  height: "5px",
                  background: "linear-gradient(90deg, #06B6D4, #10B981)",
                  borderRadius: "2px",
                }}
              />
              {/* Telemetry Dot */}
              <div
                style={{
                  position: "absolute",
                  right: "1px",
                  top: "2px",
                  width: "5px",
                  height: "5px",
                  background: "#10B981",
                  borderRadius: "50%",
                }}
              />
            </div>
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div
              style={{
                color: "#F8FAFC",
                fontSize: 18,
                fontWeight: 700,
                letterSpacing: "0.08em",
              }}
            >
              FREDERICK DE RUITER
            </div>
            <div
              style={{
                color: "#06B6D4",
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: "0.2em",
                marginTop: "2px",
              }}
            >
              {category}
            </div>
          </div>
        </div>

        {/* Optional Category / Mode Badge */}
        {badge && (
          <div
            style={{
              padding: "8px 18px",
              background: "rgba(6, 182, 212, 0.08)",
              border: "1px solid rgba(6, 182, 212, 0.3)",
              borderRadius: "100px",
              color: "#22D3EE",
              fontFamily: MONO,
              fontSize: 13,
              fontWeight: 700,
              letterSpacing: "0.12em",
              display: "flex",
            }}
          >
            {badge}
          </div>
        )}
      </div>

      {/* Center Main Headline & Narrative, with the preset artifact beside it */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          margin: "auto 0",
          width: "100%",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            flex: 1,
            minWidth: 0,
            maxWidth: artifact ? "700px" : "1060px",
          }}
        >
          <div
            style={{
              color: "#FFFFFF",
              fontSize: artifact
                ? title.length > 34
                  ? 38
                  : 46
                : title.length > 40
                  ? 46
                  : 56,
              fontWeight: 700,
              lineHeight: 1.15,
              letterSpacing: "-0.035em",
              marginBottom: "16px",
            }}
          >
            {title}
          </div>
          {description && (
            <div
              style={{
                color: "#94A3B8",
                fontSize: artifact ? 18 : 21,
                lineHeight: 1.45,
                fontWeight: 400,
                maxWidth: artifact ? "700px" : "980px",
              }}
            >
              {description}
            </div>
          )}
        </div>
        {artifact}
      </div>

      {/* Bottom Footer Row: Tags & Telemetry */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          width: "100%",
        }}
      >
        {/* Tech Tag Pills */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
          }}
        >
          {tags.slice(0, 5).map((tag, idx) => (
            <div
              key={idx}
              style={{
                padding: "6px 14px",
                background: "rgba(15, 23, 42, 0.8)",
                border: "1px solid rgba(51, 65, 85, 0.8)",
                borderRadius: "6px",
                color: "#CBD5E1",
                fontFamily: MONO,
                fontSize: 13,
                fontWeight: 400,
                letterSpacing: "0.02em",
                display: "flex",
              }}
            >
              {tag}
            </div>
          ))}
        </div>

        {/* Telemetry Status Indicator */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            color: "#64748B",
            fontFamily: MONO,
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: "0.1em",
          }}
        >
          <div
            style={{
              width: "8px",
              height: "8px",
              borderRadius: "50%",
              background: "#10B981",
            }}
          />
          {systemStatus}
        </div>
      </div>
    </div>,
    {
      ...OG_IMAGE_SIZE,
      fonts: getOgFonts(),
      headers: {
        "Cache-Control":
          "public, max-age=31536000, s-maxage=31536000, stale-while-revalidate=86400",
      },
    }
  );
}
