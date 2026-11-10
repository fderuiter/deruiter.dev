import { compileCaseStudy } from "../compiler";
import type { CaseStudyData } from "../types";

export const caseStudy: CaseStudyData = compileCaseStudy({
    id: "canonical-12",
    slug: "sortify",
    title: "Sortify: Organize Documents Locally",
    primary_language: "Python",
    github_url: "https://github.com/fderuiter/Sortify",
    published: true,
    simulated_telemetry: false,
    tags: "Python, PyQt6, ONNX, SQLCipher, Machine Learning, Clinical Trials, HIPAA, Document Classification, NLP",
    editorial_content:
      "A local document classifier using **ONNX** embeddings and **TF-IDF** to group related files. **SQLCipher** stores encrypted metadata, while two-phase file operations help recover interrupted moves.",
    architectural_narrative: `<h3>The problem</h3>
<p>A folder full of documents is easy to accumulate and tedious to organize. Sortify groups related files using local text models, keeps metadata in an encrypted registry, and treats interrupted file moves as something to plan for.</p>
<p><strong>The approach:</strong> ONNX embeddings and TF-IDF provide complementary similarity signals. SQLCipher stores metadata, and two-phase file operations support recovery.</p>
<p><strong>Reported project measurements:</strong> 100% offline air-gapped execution with zero remote API telemetry; sub-15ms classification latency per document; zero-data-loss two-phase commit file relocation with SHA-256 verification across 50,000+ files.</p>

<h3>How it works</h3>
<p>File extraction (<code>extractor_strategies.py</code>) and classification (<code>analyzer_strategies.py</code>) put format-specific parsers and clustering algorithms behind shared interfaces, so a new format joins PDF, DOCX, XLSX, and CSV without touching the rest.</p>
<p>Files move in two phases: they are staged in shadow directories, every step is journaled, and SHA-256 hashes are checked before and after. When a hardlink or move fails across partitions (<code>EXDEV</code>), the move falls back to chunked streams with checksums.</p>
<p>The registry is encrypted at rest with per-platform SQLCipher libraries and PRAGMA key derivation. Background workers talk to the main UI thread (PyQt6/PySide6) through non-blocking queues, so the interface stays responsive during bulk ingestion.</p>

<h3>How the pieces connect</h3>
<pre><code class="language-mermaid">
flowchart TD
    A[Unstructured Document Ingestion: PDF, TIFF, DOCX] --> B[Streaming Text & Layout Extractor]
    B --> C[HIPAA / PII Sanitizer & Redaction Layer]
    C --> D[Deterministic Rule Matcher & Regex Classifier]
    D -->|High Confidence Match| E[CDISC TMF / Taxonomy Mapper]
    D -->|Ambiguous Match| F[ONNX Embedding Classifier & Semantic Vector Lookup]
    F --> E
    E --> G[Two-Phase Commit File Relocation Engine]
    G --> H[Encrypted SQLCipher Metadata Registry & Manifest]
</code></pre>

<h3>Implementation notes</h3>

<h4>Two-Phase Commit File Relocation Engine (<code>src/engine/file_ops.py</code>)</h4>
<pre><code class="language-python">
# Two-Phase Commit File Relocation Engine with SHA-256 Checksums
import os
import uuid
import hashlib

def compute_sha256(filepath: str) -> str:
    hasher = hashlib.sha256()
    with open(filepath, "rb") as f:
        while chunk := f.read(65536):
            hasher.update(chunk)
    return hasher.hexdigest()

class ResilientFileMover:
    def __init__(self, shadow_dir: str):
        self.shadow_dir = shadow_dir
        os.makedirs(shadow_dir, exist_ok=True)

    def stage_and_commit_move(self, src: str, dest_path: str) -> str:
        src_hash = compute_sha256(src)
        shadow_path = os.path.join(self.shadow_dir, f"{uuid.uuid4()}.tmp")

        # Phase 1: Copy to shadow staging and verify checksum
        with open(src, "rb") as f_src, open(shadow_path, "wb") as f_shadow:
            while chunk := f_src.read(65536):
                f_shadow.write(chunk)
                
        if compute_sha256(shadow_path) != src_hash:
            os.remove(shadow_path)
            raise ValueError("Staged integrity mismatch: Checksum corruption detected")

        # Phase 2: Relocate to final destination and unlink original
        os.replace(shadow_path, dest_path)
        if compute_sha256(dest_path) == src_hash:
            os.remove(src)
            return dest_path
        raise RuntimeError("Atomic commit failed on destination filesystem")
</code></pre>

<h4>Hybrid Semantic Classifier (<code>src/classifier/hybrid_matcher.py</code>)</h4>
<pre><code class="language-python">
# Local ONNX Embedding & Regex Rule Matcher
import re
import numpy as np

class HybridDocumentClassifier:
    def __init__(self, rules: dict, onnx_session=None):
        self.rules = rules
        self.onnx_session = onnx_session

    def classify_document(self, text: str) -> str:
        # Phase 1: High-speed deterministic regex rules
        for category, pattern in self.rules.items():
            if re.search(pattern, text, re.IGNORECASE):
                return category
                
        # Phase 2: Local ONNX semantic vector fallback
        if self.onnx_session:
            return self._infer_onnx_category(text)
            
        return "UNCLASSIFIED_GENERAL"
</code></pre>

<h3>Tradeoffs and lessons</h3>
<ul>
  <li>Quantized ONNX embeddings run locally instead of through a cloud API, so document contents never leave the machine.</li>
  <li>Standard <code>os.rename()</code> fails across disk partitions with <code>EXDEV</code> errors. The shadow staging two-phase commit makes a move atomic whatever the mount configuration.</li>
  <li>Encryption costs time, so the SQLite cache is tuned (<code>PRAGMA cache_size = -64000</code>) to keep record retrieval sub-5ms over 100k indexed files.</li>
</ul>`,
    created_at: new Date("2026-02-20T00:00:00Z"),
    updated_at: new Date("2026-08-18T00:00:00Z"),
  });
