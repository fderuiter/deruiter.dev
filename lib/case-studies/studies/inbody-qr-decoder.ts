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
<p>An InBody result contains a QR code, which raises a reasonable question: what is in it? This project examines the encoded binary data, maps positions to measurements, and turns those findings into Python tools.</p>
<p><strong>The approach:</strong> The Python packages separate binary decoding, field discovery, API access, and command-line use. Mutation-based experiments help identify what each field represents.</p>
<p><strong>Reported project measurements:</strong> Sub-millisecond payload decoding; 100% reconstruction fidelity across 30+ body composition biometrics; automated differential mutation testing suite.</p>

<h3>How it works</h3>
<p>The Differential Mutation Oracle is a test harness that mutates fixed-width byte slices one at a time and watches the output, which is how it finds each biomarker's boundaries and scale factor.</p>
<p>A byte-slice parser converts the ASCII place-value fields into calibrated floating-point measurements.</p>
<p>A normalizer decodes percent-encoded delimiters, and a deriver computes indicators such as Appendicular Skeletal Muscle Mass and Skeletal Muscle Index.</p>

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
  <li>URL percent-encoding turned literal <code>!</code> delimiters into <code>%21</code>, which shifted the byte slices and produced a $10\\times$ error in Leg Lean Mass until the delimiters were normalized.</li>
  <li>The core decoder uses only the Python standard library, so it can be embedded in constrained IoT and mobile environments.</li>
</ul>`,
    created_at: new Date("2026-02-22T00:00:00Z"),
    updated_at: new Date("2026-08-18T00:00:00Z"),
  });
