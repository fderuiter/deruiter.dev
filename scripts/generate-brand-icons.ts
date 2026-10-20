import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const SVG_BRAND_MARK = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="100%" height="100%">
  <defs>
    <linearGradient id="fd-grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#06B6D4" />
      <stop offset="100%" stop-color="#10B981" />
    </linearGradient>
  </defs>

  <style>
    :root {
      --bg: #090D16;
      --border: #1E293B;
      --stem: #F8FAFC;
      --accent: url(#fd-grad);
    }
    @media (prefers-color-scheme: light) {
      :root {
        --bg: #0F172A;
        --border: #334155;
        --stem: #FFFFFF;
        --accent: url(#fd-grad);
      }
    }
    .bg-box { fill: #090D16; stroke: #1E293B; stroke-width: 1.5; rx: 7; }
    .glyph-stem { fill: #F8FAFC; }
    .glyph-bar { fill: url(#fd-grad); }
    .telemetry-dot { fill: #10B981; }
  </style>

  <!-- Container Tile -->
  <rect class="bg-box" fill="#090D16" stroke="#1E293B" stroke-width="1.5" rx="7" x="1" y="1" width="30" height="30" />

  <!-- Monogram Architecture 'F' -->
  <!-- Vertical backbone -->
  <rect class="glyph-stem" fill="#F8FAFC" x="7" y="7" width="4" height="18" rx="1.5" />
  
  <!-- Top Primary Bar -->
  <rect class="glyph-bar" fill="url(#fd-grad)" x="13" y="7" width="9" height="4" rx="1.5" />
  
  <!-- Middle Secondary Bar -->
  <rect class="glyph-bar" fill="url(#fd-grad)" x="13" y="14" width="6" height="3.5" rx="1.5" />

  <!-- Real-time Systems Telemetry Dot -->
  <circle class="telemetry-dot" fill="#10B981" cx="24.5" cy="7.5" r="2" />
</svg>
`;

/**
 * Creates a standard binary Windows ICO container enclosing PNG buffers.
 */
function createIco(
  images: Array<{ width: number; height: number; buffer: Buffer }>
): Buffer {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // Reserved
  header.writeUInt16LE(1, 2); // ICO Type (1)
  header.writeUInt16LE(images.length, 4); // Number of images

  let offset = 6 + images.length * 16;
  const entries: Buffer[] = [];

  for (const img of images) {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(img.width >= 256 ? 0 : img.width, 0);
    entry.writeUInt8(img.height >= 256 ? 0 : img.height, 1);
    entry.writeUInt8(0, 2); // Color palette (0 = no palette)
    entry.writeUInt8(0, 3); // Reserved
    entry.writeUInt16LE(1, 4); // Color planes
    entry.writeUInt16LE(32, 6); // Bits per pixel (32-bit RGBA)
    entry.writeUInt32LE(img.buffer.length, 8); // Size of image data
    entry.writeUInt32LE(offset, 12); // Data offset in file
    entries.push(entry);
    offset += img.buffer.length;
  }

  return Buffer.concat([
    header,
    ...entries,
    ...images.map((img) => img.buffer),
  ]);
}

export interface BrandIconGenerationOptions {
  sourceRoot?: string;
  outputRoot?: string;
}

function writeIfChanged(outputPath: string, contents: string | Buffer): void {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  if (
    fs.existsSync(outputPath) &&
    fs.readFileSync(outputPath).equals(Buffer.from(contents))
  ) {
    return;
  }
  fs.writeFileSync(outputPath, contents);
}

/**
 * Generates every brand icon from one SVG input. `outputRoot` lets validation
 * use a disposable directory instead of rewriting tracked public assets.
 */
export async function generateBrandIcons(
  options: BrandIconGenerationOptions | string = {}
) {
  const { sourceRoot = process.cwd(), outputRoot = sourceRoot } =
    typeof options === "string"
      ? { sourceRoot: options, outputRoot: options }
      : options;
  const sourcePublicFaviconSvgPath = path.resolve(
    sourceRoot,
    "public/favicon.svg"
  );
  const sourceAppIconSvgPath = path.resolve(sourceRoot, "app/icon.svg");
  const publicFaviconSvgPath = path.resolve(outputRoot, "public/favicon.svg");
  const appIconSvgPath = path.resolve(outputRoot, "app/icon.svg");

  let svgContent = SVG_BRAND_MARK.trim();
  if (fs.existsSync(sourcePublicFaviconSvgPath)) {
    const existing = fs
      .readFileSync(sourcePublicFaviconSvgPath, "utf-8")
      .trim();
    if (existing) svgContent = existing;
  } else if (fs.existsSync(sourceAppIconSvgPath)) {
    const existing = fs.readFileSync(sourceAppIconSvgPath, "utf-8").trim();
    if (existing) svgContent = existing;
  }

  const svgBuffer = Buffer.from(svgContent);

  // 1. Write SVG icons
  writeIfChanged(appIconSvgPath, svgContent + "\n");
  writeIfChanged(publicFaviconSvgPath, svgContent + "\n");
  console.log("✓ Generated app/icon.svg & public/favicon.svg");

  // 2. Generate multi-resolution ICO
  const icoSizes = [16, 32, 48];
  const icoImages: Array<{ width: number; height: number; buffer: Buffer }> =
    [];
  for (const size of icoSizes) {
    const buf = await sharp(svgBuffer).resize(size, size).png().toBuffer();
    icoImages.push({ width: size, height: size, buffer: buf });
  }
  const icoBuffer = createIco(icoImages);
  writeIfChanged(path.resolve(outputRoot, "app/favicon.ico"), icoBuffer);
  writeIfChanged(path.resolve(outputRoot, "public/favicon.ico"), icoBuffer);
  console.log(
    "✓ Generated app/favicon.ico & public/favicon.ico (16x16, 32x32, 48x48)"
  );

  // 3. Generate Apple Touch Icon (180x180)
  const appleTouchBuffer = await sharp(svgBuffer)
    .resize(180, 180)
    .png()
    .toBuffer();
  writeIfChanged(
    path.resolve(outputRoot, "public/apple-touch-icon.png"),
    appleTouchBuffer
  );
  console.log("✓ Generated public/apple-touch-icon.png (180x180)");

  // 4. Generate Web App Manifest Icons (192x192, 512x512)
  const icon192Buffer = await sharp(svgBuffer)
    .resize(192, 192)
    .png()
    .toBuffer();
  writeIfChanged(
    path.resolve(outputRoot, "public/icon-192.png"),
    icon192Buffer
  );
  console.log("✓ Generated public/icon-192.png (192x192)");

  const icon512Buffer = await sharp(svgBuffer)
    .resize(512, 512)
    .png()
    .toBuffer();
  writeIfChanged(
    path.resolve(outputRoot, "public/icon-512.png"),
    icon512Buffer
  );
  console.log("✓ Generated public/icon-512.png (512x512)");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const outputFlag = process.argv.indexOf("--output-root");
  const outputRoot =
    outputFlag === -1 ? undefined : process.argv[outputFlag + 1];
  generateBrandIcons(
    outputRoot ? { outputRoot: path.resolve(outputRoot) } : {}
  ).catch((err) => {
    console.error("Failed to generate brand icons:", err);
    process.exit(1);
  });
}
