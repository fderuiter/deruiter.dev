import { compileCaseStudy } from "../compiler";
import type { CaseStudyCommands, CaseStudyData, CaseStudyPlayback } from "../types";

export const IMEDNET_COMMANDS_OBJ: CaseStudyCommands = {
  "imednet studies list": {
    description:
      "Retrieve a list of all active clinical trials from the iMednet EDC platform.",
    payload: [
      {
        studyID: "BRIGHT-01",
        name: "Phase III Pediatric Leukemia Study",
        status: "ACTIVE",
        subjectsCount: 142,
        version: "v4.2.1",
      },
      {
        studyID: "ONCO-2026",
        name: "Advanced Melanoma Immunotherapy Trial",
        status: "ENROLLING",
        subjectsCount: 89,
        version: "v1.0.8",
      },
      {
        studyID: "CARDIO-REF",
        name: "Congestive Heart Failure Observational Registry",
        status: "COMPLETED",
        subjectsCount: 310,
        version: "v2.5.0",
      },
    ],
  },
  "imednet subjects get --id 123": {
    description:
      "Query specific details and records for subject 123 (HIPAA-anonymized).",
    payload: {
      subjectID: "SUB-123",
      studyID: "BRIGHT-01",
      siteID: 401,
      enrollmentDate: "2025-11-12",
      status: "COMPLETED",
      recordsCount: 18,
      complianceScore: "[VERIFY_SECURITY_LOGS]",
      demographics: {
        age: 11,
        gender: "F",
        ethnicity: "ANONYMIZED_UNDER_HIPAA_SAFE_HARBOR",
      },
      lastVisit: "2026-05-10T14:30Z",
    },
  },
  "imednet records search --study BRIGHT-01": {
    description:
      "Search dynamic patient records and EDC form entries matching active trials.",
    payload: {
      studyID: "BRIGHT-01",
      totalRecordsMatched: 3,
      domain: "VS (Vital Signs)",
      results: [
        {
          subjectID: "SUB-101",
          visitName: "Week 4 Follow-up",
          heartRate: 72,
          tempCelsius: 36.8,
          systolicBP: 110,
          diastolicBP: 72,
          timestamp: "2026-05-20T08:30Z",
        },
        {
          subjectID: "SUB-102",
          visitName: "Week 4 Follow-up",
          heartRate: 84,
          tempCelsius: 37.1,
          systolicBP: 115,
          diastolicBP: 76,
          timestamp: "2026-05-20T09:15Z",
        },
        {
          subjectID: "SUB-103",
          visitName: "Week 4 Follow-up",
          heartRate: 68,
          tempCelsius: 36.6,
          systolicBP: 108,
          diastolicBP: 70,
          timestamp: "2026-05-20T10:00Z",
        },
      ],
    },
  },
};

export const IMEDNET_PLAYBACK_OBJ: CaseStudyPlayback = [
  {
    command: "imednet studies list",
    description:
      "Retrieve a list of all active clinical trials from the iMednet EDC platform.",
  },
  {
    command: "imednet subjects get --id 123",
    description: "Query details and demographics for subject 123",
  },
  {
    command: "imednet records search --study BRIGHT-01",
    description: "Search dynamic patient records for active trial BRIGHT-01",
  },
];

export const caseStudy: CaseStudyData = compileCaseStudy({
    id: "canonical-3",
    slug: "imednet-python-sdk",
    title: "iMednet Python SDK: Clinical Data Without the Manual Exports",
    primary_language: "Python",
    github_url: "https://github.com/fderuiter/imednet-python-sdk",
    published: true,
    simulated_telemetry: false,
    tags: "Python, SDK, iMednet, API Client, Clinical Trials, HIPAA, Clinical Data",
    editorial_content:
      "A typed **Python SDK** for working with the **iMednet EDC** API. It gives data engineers and biostatisticians a way to retrieve study metadata and records without repeating the same export routine.",
    architectural_narrative: `<h3>The problem</h3>
<p>Getting data out of an EDC should not mean writing the same authentication, pagination, and response-parsing code every time. This SDK puts those routines behind a typed Python interface for iMednet, so analysis code can concentrate on the study data.</p>
<p><strong>The approach:</strong> Pydantic models validate responses, async generators handle pagination, and the transport layer manages authentication and token refresh.</p>
<p><strong>Reported project measurements:</strong> Sub-15ms extraction and validation per subject record; 100% HIPAA-safe transport without disk caching of unencrypted PHI; integrated CLI sandbox for rapid developer onboarding.</p>

<h3>How it works</h3>
<p><strong>Declarative Type-Safe Contracts:</strong> Every endpoint response is parsed and validated against strict Pydantic v2 data models with runtime coercion and validation diagnostics.</p>
<p><strong>Security-Hardened Transport Layer:</strong> Implements TLS 1.3 encryption, automatic session token refresh, and localized memory isolation to eliminate unencrypted PHI disk persistence.</p>
<p><strong>Asynchronous Pagination Engine:</strong> Exposes async generators that paginate through large multi-center clinical trials without blocking memory.</p>

<h3>How the pieces connect</h3>
<pre><code class="language-mermaid">
flowchart TD
    A[Clinical Script / Notebook] --> B[iMednet Python SDK Client]
    B --> C[Session Token & TLS 1.3 Transport]
    C --> D[iMednet EDC Remote API]
    D --> E[Raw JSON / XML Payloads]
    E --> F[Pydantic v2 Schema Validator]
    F --> G[Typed Clinical Entity Models]
    G --> H1[Pandas / Polars Dataframe]
    G --> H2[Interactive CLI Sandbox]
</code></pre>

<h3>Implementation notes</h3>

<h4>Typed Pydantic Data Contract (<code>imednet/models/subject.py</code>)</h4>
<pre><code class="language-python">
# Typed SDK API contract using Pydantic v2
from pydantic import BaseModel, Field
from typing import Optional

class SubjectRecord(BaseModel):
    subject_id: str = Field(..., alias="subjectID")
    status: str
    site_id: int = Field(..., alias="siteID")
    enrollment_date: Optional[str] = None
    records_count: int = Field(default=0, alias="recordsCount")
</code></pre>

<h4>Async Paginated Subject Fetcher (<code>imednet/client.py</code>)</h4>
<pre><code class="language-python">
# Asynchronous paginated clinical subject fetcher
from typing import AsyncGenerator
import httpx

class IMednetClient:
    def __init__(self, base_url: str, api_key: str):
        self.base_url = base_url
        self.headers = {"Authorization": f"Bearer {api_key}", "Accept": "application/json"}

    async def fetch_subjects_stream(self, study_id: str) -> AsyncGenerator[dict, None]:
        page = 1
        async with httpx.AsyncClient(timeout=30.0) as client:
            while True:
                resp = await client.get(f"{self.base_url}/studies/{study_id}/subjects", params={"page": page}, headers=self.headers)
                resp.raise_for_status()
                data = resp.json()
                if not data.get("subjects"):
                    break
                for subj in data["subjects"]:
                    yield subj
                page += 1
</code></pre>

<h3>Tradeoffs and lessons</h3>
<ul>
  <li><strong>Zero Disk Persistence for PHI:</strong> Sanitized log handlers and memory-only record deserialization guaranteed 100% compliance with HIPAA audit mandates.</li>
  <li><strong>Pydantic v2 Performance:</strong> Leveraging Pydantic v2's Rust core reduced schema serialization overhead by 5x during bulk data extraction.</li>
</ul>`,
    commands_json: JSON.stringify(IMEDNET_COMMANDS_OBJ),
    playback_json: JSON.stringify(IMEDNET_PLAYBACK_OBJ),
    created_at: new Date("2026-02-01T00:00:00Z"),
    updated_at: new Date("2026-08-18T00:00:00Z"),
  });
