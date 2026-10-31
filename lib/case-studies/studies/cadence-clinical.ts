import { compileCaseStudy } from "../compiler";
import type { CaseStudyData } from "../types";

export const caseStudy: CaseStudyData = compileCaseStudy({
    id: "canonical-2",
    slug: "cadence-clinical",
    title: "Cadence Clinical: From Protocol to Study Data",
    primary_language: "Python / Vue 3",
    github_url: "https://github.com/fderuiter/cadence-clinical",
    published: true,
    simulated_telemetry: false,
    tags: "clinical-trials, cdisc-usdm, hexagonal-architecture, gxp-compliance, distributed-systems, vue3-vite",
    editorial_content:
      "A clinical study has a lot of moving parts. **Cadence Clinical** connects protocol design with study records, using **Neo4j** for relationships and **PostgreSQL** for transactions, with audit trails and digital signatures.",
    architectural_narrative: `<h3>The problem</h3>
<p>A protocol describes how a study should run. The database has to keep up when that protocol changes. Cadence Clinical connects protocol relationships, day-to-day study records, and an audit history so those pieces can be reasoned about together.</p>
<p><strong>The approach:</strong> Neo4j represents protocol relationships; PostgreSQL handles record transactions. Ports and adapters separate the study logic from storage, with append-only audit records and RSA-PSS signatures.</p>
<p><strong>Reported project measurements:</strong> Sub-50ms API gateway latency; 100% GxP audit trail traceability; 65% faster cold test runner execution via <code>uv</code> monorepo workspaces.</p>

<h3>How it works</h3>
<p><strong>Hexagonal Architecture (Ports &amp; Adapters):</strong> Domain logic across microservices is strictly decoupled from framework concerns. Ports define explicit interfaces while adapters handle persistence and network integration.</p>
<p><strong>Dual Graph-Relational Data Core:</strong> Neo4j graph stores complex Schedule of Activities (SoA) and biomedical concept dependencies; PostgreSQL with SQLModel handles ACID-compliant clinical record transactions.</p>
<p><strong>Cryptographic 21 CFR Part 11 Audit Trails:</strong> Every subject data mutation is appended to an in-memory Merkle tree, yielding cryptographic state verification with RSA-PSS digital signatures.</p>

<h3>How the pieces connect</h3>
<pre><code class="language-mermaid">
flowchart TD
    subgraph ProtocolAuthoring [Protocol Designer Service]
        A[USDM Protocol Matrix] --> B[Neo4j Graph AST Engine]
        B --> C[Amendment Cascading Resolver]
    end

    subgraph ClinicalCore [Hexagonal Execution Core]
        C --> D[Execution Port Interface]
        D --> E[PostgreSQL Transactional Engine]
        E --> F[Transactional Outbox Relayer]
    end

    subgraph ComplianceAudit [Cryptographic 21 CFR Part 11]
        E --> G[Merkle Tree Audit Append-Only Log]
        G --> H[RSA-PSS Digital Signature Generator]
        H --> I[Tamper-Proof Audit Digest]
    end
</code></pre>

<h3>Implementation notes</h3>

<h4>Hexagonal Execution Repository Port (<code>apps/execution/domain/ports.py</code>)</h4>
<pre><code class="language-python">
# Hexagonal Repository Port enforcing strict domain isolation
from typing import Protocol, Optional
from datetime import datetime
from pydantic import BaseModel

class ClinicalObservation(BaseModel):
    observation_id: str
    subject_id: str
    tenant_id: str
    domain_code: str
    value: str
    timestamp: datetime
    merkle_hash: str

class ExecutionRepositoryPort(Protocol):
    """Enforces persistence-agnostic domain interfaces."""
    async def persist_observation(self, observation: ClinicalObservation) -> None: ...
</code></pre>

<h4>RSA-PSS Digital Signature Verifier (<code>packages/compliance/services/signature.py</code>)</h4>
<pre><code class="language-python">
# Cryptographic RSA-PSS 21 CFR Part 11 signature verifier
from cryptography.hazmat.primitives.asymmetric import padding, rsa
from cryptography.hazmat.primitives import hashes
from cryptography.exceptions import InvalidSignature

def verify_manifest_signature(public_key: rsa.RSAPublicKey, signature: bytes, payload: bytes) -> bool:
    try:
        public_key.verify(
            signature, payload,
            padding.PSS(mgf=padding.MGF1(hashes.SHA256()), salt_length=padding.PSS.MAX_LENGTH),
            hashes.SHA256()
        )
        return True
    except InvalidSignature:
        return False
</code></pre>

<h3>Tradeoffs and lessons</h3>
<ul>
  <li><strong>RSA-PSS vs. PKCS#1 v1.5:</strong> Transitioned all cryptographic signature verification to RSA-PSS to eliminate padding oracle side-channel vulnerabilities.</li>
  <li><strong>Graph-to-Relational Protocol Sync:</strong> Offloaded protocol amendment cascading to Neo4j graph traversals, preventing lockouts on high-volume relational subject records during active trials.</li>
</ul>`,
    created_at: new Date("2026-01-20T00:00:00Z"),
    updated_at: new Date("2026-08-18T00:00:00Z"),
  });
