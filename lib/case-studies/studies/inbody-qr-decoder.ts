import { compileCaseStudy } from "../compiler";
import type { CaseStudyData } from "../types";

export const caseStudy: CaseStudyData = compileCaseStudy({
    id: "canonical-8",
    slug: "inbody-qr-decoder",
    title: "InBody QR Decoder: What’s in That QR Code?",
    primary_language: "Python",
    github_url: "https://github.com/fderuiter/inbody-qr-decoder",
    published: true,
    simulated_telemetry: false,
    tags: "Python, Poetry, Reverse Engineering, Biomedical Data, Monorepo Architecture, Data Parsing, QR Decoder",
    editorial_content:
      "A set of **Python** tools for decoding **InBody** body-composition QR codes. The project explores the binary format, maps its fields, and exposes the results through a library and CLI.",
    architectural_narrative: `<h3>The problem</h3>
<p>An InBody result contains a QR code, which raises a reasonable question: what is actually in it? This project examines the encoded binary data, maps positions to measurements, and turns those findings into Python tools.</p>
<p><strong>The approach:</strong> The Python packages separate binary decoding, field discovery, API access, and command-line use. Mutation-based experiments help identify what each field represents.</p>
<p><strong>Reported project measurements:</strong> Sub-millisecond payload decoding; 100% reconstruction fidelity across 30+ body composition biometrics; automated differential mutation testing suite.</p>

<h3>How it works</h3>
<p><strong>Differential Mutation Oracle:</strong> Automated test harness that systematically mutates fixed-width byte slices to programmatically discover biomarker boundaries and scale factors.</p>
<p><strong>Fixed-Width Positional Matrix Deserializer:</strong> High-speed byte slice parser converting ASCII place-value representations into calibrated floating-point biometrics.</p>
<p><strong>Segment Normalizer &amp; Biomarker Deriver:</strong> Normalizes percent-encoded delimiters and computes derived clinical indicators (Appendicular Skeletal Muscle Mass, Skeletal Muscle Index).</p>

<h3>How the pieces connect</h3>
<pre><code class="language-mermaid">
flowchart TD
    A[InBody Result Sheet QR Code] --> B[Raw IBData Query String]
    B --> C[Percent-Encoding Normalizer]
    C --> D[Multi-Segment Delimiter Lexer]
    D --> E1[Segment 4: Body Composition Matrix]
    D --> E2[Segment 5: Visceral Fat & BMR Matrix]
    E1 & E2 --> F[Positional Place-Value Deserializer]
    F --> G[Derived Biomarker Engine: ASM, SMI, ECW/TBW]
    G --> H[Structured JSON / Dataframe Export]
</code></pre>

<h3>Implementation notes</h3>

<h4>Positional Place-Value Deserializer (<code>inbody-decoder/src/decoder.py</code>)</h4>
<pre><code class="language-python">
# Fixed-width positional place-value matrix deserializer
def decode_digits(raw_slice: str, scale_factor: float = 0.1, precision: int = 2, meas_blob: str = "") -> float:
    """Fixed-width positional matrix deserializer for place-value byte windows in meas_blob."""
    clean_digits = raw_slice.strip()
    accumulated_value = sum(
        (ord(char) - ord('0')) * (10 ** idx)
        for idx, char in enumerate(reversed(clean_digits))
    )
    return round(accumulated_value * scale_factor, precision)
</code></pre>

<h4>Differential Mutation Testing Oracle (<code>inbody-cli/mapping.py</code>)</h4>
<pre><code class="language-python">
# Programmatic field discovery via differential mutation
def probe_byte_slice(payload: str, start: int, end: int, delta: int = 1) -> str:
    """Injects controlled integer perturbations to isolate biometric offsets."""
    chars = list(payload)
    val = int("".join(chars[start:end])) + delta
    chars[start:end] = f"{val:0{end - start}d}"
    return "".join(chars)
</code></pre>

<h3>Tradeoffs and lessons</h3>
<ul>
  <li><strong>Percent-Encoding Collision Bug:</strong> Resolved a critical bug where URL percent-encoding (<code>%21</code>) of literal <code>!</code> delimiters caused byte-slice alignment shifts, inducing a $10\\times$ error on Leg Lean Mass.</li>
  <li><strong>Zero-Dependency Core:</strong> Built the core decoder using pure Python standard library primitives to allow embeddability in constrained IoT and mobile environments.</li>
</ul>`,
    created_at: new Date("2026-02-22T00:00:00Z"),
    updated_at: new Date("2026-08-18T00:00:00Z"),
  });
