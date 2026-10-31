import { compileCaseStudy } from "../compiler";
import type { CaseStudyData } from "../types";

export const caseStudy: CaseStudyData = compileCaseStudy({
    id: "canonical-7",
    slug: "laser-loon",
    title: "Laser Loon: Minnesota, With Eye Lasers",
    primary_language: "Graphic Design",
    github_url: "https://github.com/fderuiter/laser-loon",
    interactive_url: "/work/laser-loon",
    interactive_label: "View Laser Loon Showcase",
    published: true,
    simulated_telemetry: false,
    tags: "Graphic Design, Vector Illustration, Iconography, Open Asset Distribution, Cultural Branding",
    editorial_content:
      "My submission to Minnesota’s state flag redesign: a common loon with uncommon eye contact. The artwork is available in print and web formats, so the lasers can travel.",
    architectural_narrative: `<h3>The problem</h3>
<p>For Minnesota’s state flag redesign, I submitted a common loon with red eye lasers. Submission F277 became Laser Loon. This project collects the artwork in formats people can use on screens, in print, and on whatever else needs a laser-eyed bird.</p>
<p><strong>The approach:</strong> The bird silhouette and laser layers remain editable as vectors. The download set includes source, print, and web formats.</p>
<p><strong>Reported project measurements:</strong> Sub-5KB optimized SVG payload; 300 DPI lossless raster masters; full CMYK/RGB print-pipeline interoperability.</p>

<h3>How it works</h3>
<p><strong>Anatomical Accuracy &amp; Stylization:</strong> Stark black-and-white field blocking capturing the distinctive bill curve, crested crown, and patterned plumage for micro-favicon and billboard scales.</p>
<p><strong>Focal Convergence &amp; Glow Dynamics:</strong> Hard-edge vector rays with layered radial glows engineered along the sightline for high contrast on light and dark backgrounds.</p>
<p><strong>Multi-Tier Asset Packaging:</strong> Dual-track packaging separating source editing vectors (<code>.ai</code>, <code>.eps</code>) from web-optimized assets (<code>.svg</code>, <code>.png</code>).</p>

<h3>How the pieces connect</h3>
<pre><code class="language-mermaid">
flowchart TD
    A[Master Vector Source: Laser_loon.ai] --> B[Asset Packaging & Build Pipeline]
    B --> C1[Scalable Web Vector: Laser_loon.svg]
    B --> C2[Commercial Print Vector: Laser_loon.eps / .pdf]
    B --> C3[Master Layered Raster: Laser_loon.psd]
    B --> C4[Lossless Web Alpha: Laser_loon.png / .jpg]
    C1 --> D1[In-App Portfolio Showcase: /work/laser-loon]
    C2 --> D2[Screen Printing & Physical Merchandising]
    C3 & C4 --> D3[Creative Commons CC0 Public Domain Distribution]
</code></pre>

<h3>Implementation notes</h3>

<h4>Production Asset Distribution Matrix</h4>
<table class="w-full text-xs font-mono border-collapse my-4">
  <thead>
    <tr class="border-b border-zinc-800 text-amber-400 text-left">
      <th class="py-2 px-3">File Format</th>
      <th class="py-2 px-3">Classification</th>
      <th class="py-2 px-3">Target Application</th>
      <th class="py-2 px-3">Key Attributes</th>
    </tr>
  </thead>
  <tbody class="divide-y divide-zinc-900 text-zinc-300">
    <tr>
      <td class="py-2 px-3 font-bold text-white">Laser_loon.ai</td>
      <td class="py-2 px-3">Master Vector</td>
      <td class="py-2 px-3">Source Editing</td>
      <td class="py-2 px-3">Layered vectors, global swatches, full scalability</td>
    </tr>
    <tr>
      <td class="py-2 px-3 font-bold text-white">Laser_loon.svg</td>
      <td class="py-2 px-3">Scalable Web Vector</td>
      <td class="py-2 px-3">Web UI, Icons</td>
      <td class="py-2 px-3">Minimized DOM footprint, responsive rendering</td>
    </tr>
    <tr>
      <td class="py-2 px-3 font-bold text-white">Laser_loon.eps</td>
      <td class="py-2 px-3">Print Vector</td>
      <td class="py-2 px-3">Commercial Print</td>
      <td class="py-2 px-3">Spot color separation, CMYK print compatibility</td>
    </tr>
    <tr>
      <td class="py-2 px-3 font-bold text-white">Laser_loon.pdf</td>
      <td class="py-2 px-3">Vector Document</td>
      <td class="py-2 px-3">Universal Proofing</td>
      <td class="py-2 px-3">High-res vector embeds, universal document exchange</td>
    </tr>
    <tr>
      <td class="py-2 px-3 font-bold text-white">Laser_loon.png</td>
      <td class="py-2 px-3">Transparent Raster</td>
      <td class="py-2 px-3">Social Media / Web UI</td>
      <td class="py-2 px-3">300 DPI lossless alpha transparency</td>
    </tr>
  </tbody>
</table>

<h3>Tradeoffs and lessons</h3>
<ul>
  <li><strong>Creative Commons CC0 Distribution:</strong> A public domain dedication accelerated grassroots community propagation and third-party merchandising without legal friction.</li>
  <li><strong>Color Gamut Clamping:</strong> Designed distinct color profiles for digital sRGB displays versus physical CMYK spot-color inks to prevent dull laser tones during commercial textile printing.</li>
</ul>`,
    created_at: new Date("2026-03-05T00:00:00Z"),
    updated_at: new Date("2026-08-18T00:00:00Z"),
  });
