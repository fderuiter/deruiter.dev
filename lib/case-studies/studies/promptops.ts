import { compileCaseStudy } from "../compiler";
import type { CaseStudyCommands, CaseStudyData, CaseStudyPlayback } from "../types";

export const PROMPTOPS_COMMANDS_OBJ: CaseStudyCommands = {
  "promptops eval --suite clinical-triage --dataset ./evals/golden_v2.json": {
    description:
      "Executes automated regression test suite across 150 golden evaluation samples.",
    payload: {
      suite: "clinical-triage",
      samplesEvaluated: 150,
      exactMatchPassRate: "98.6%",
      llmJudgeScore: 4.92,
      schemaValidationPassRate: "100%",
      meanLatencyMs: 342,
      totalTokensConsumed: 48210,
      status: "EVAL_GATE_PASSED",
    },
  },
  "promptops semver bump --component triage_prompt --type minor": {
    description:
      "Bumps semantic version for prompt component and updates release lockfile.",
    payload: {
      component: "triage_prompt",
      previousVersion: "v1.3.4",
      newVersion: "v1.4.0",
      changeType: "MINOR_SYSTEM_PROMPT_OPTIMIZATION",
      lockfileUpdated: "./prompts/promptops.lock.json",
      checksum: "8f3b2a19c4d8e7",
    },
  },
  'promptops test --model gpt-4o --prompt-version v1.4.0 --input \'{"chief_complaint": "Chest pressure radiating to left arm", "onset_hours": 2}\'':
    {
      description:
        "Dispatches live prompt execution with typed input and verifies Zod schema conformance.",
      payload: {
        model: "gpt-4o",
        version: "v1.4.0",
        responseParsed: {
          acuityLevel: "EMERGENCY_LEVEL_1",
          differentialDiagnosis: [
            "Acute Coronary Syndrome",
            "Aortic Dissection",
          ],
          recommendedImmediateActions: [
            "12-lead ECG",
            "Continuous Cardiac Monitoring",
            "Sublingual Nitroglycerin",
          ],
          telemetryTrackingRequired: true,
        },
        schemaValid: true,
        latencyMs: 412,
      },
    },
  "promptops route --fallback-health-check": {
    description:
      "Probes health status and latency of configured multi-provider LLM endpoints.",
    payload: {
      providers: [
        {
          name: "Anthropic API",
          status: "HEALTHY",
          latencyMs: 148,
          activeRoute: "PRIMARY",
        },
        {
          name: "OpenAI API",
          status: "HEALTHY",
          latencyMs: 182,
          activeRoute: "FALLBACK",
        },
        {
          name: "Local Ollama",
          status: "HEALTHY",
          latencyMs: 42,
          activeRoute: "DEV_SANDBOX",
        },
      ],
    },
  },
};

export const PROMPTOPS_PLAYBACK_OBJ: CaseStudyPlayback = [
  {
    command:
      "promptops eval --suite clinical-triage --dataset ./evals/golden_v2.json",
    description:
      "Run automated eval test suite across golden evaluation dataset",
  },
  {
    command: "promptops semver bump --component triage_prompt --type minor",
    description: "Bump prompt semantic version and update release lockfile",
  },
  {
    command:
      'promptops test --model gpt-4o --prompt-version v1.4.0 --input \'{"chief_complaint": "Chest pressure radiating to left arm", "onset_hours": 2}\'',
    description:
      "Execute live prompt against model and validate Zod schema response",
  },
  {
    command: "promptops route --fallback-health-check",
    description:
      "Probe latency and availability across multi-provider LLM endpoints",
  },
];

export const caseStudy: CaseStudyData = compileCaseStudy({
    id: "canonical-20",
    slug: "promptops",
    title: "PromptOps: Test Prompts Like Other Code",
    primary_language: "TypeScript",
    github_url: "https://github.com/fderuiter/PromptOps",
    published: true,
    simulated_telemetry: false,
    tags: "TypeScript, LLM, Prompt Engineering, CI/CD, Semantic Versioning, Eval Pipeline, Zod, OpenAI, Anthropic, Multi-Provider",
    editorial_content:
      "A **TypeScript** toolkit for versioning prompts, validating output with **Zod**, and running regression evaluations in CI. A prompt change should come with a way to check what changed in the results.",
    architectural_narrative: `<h3>The problem</h3>
<p>Changing a prompt can fix one example and break another. PromptOps versions prompts, validates response shapes, and runs evaluation cases so changes have something more useful than a good first impression to go on.</p>
<p><strong>The approach:</strong> Versioned prompt definitions run against evaluation cases in CI. Zod checks response structure, while regression results help identify behavior changes.</p>
<p><strong>Reported project measurements:</strong> 99.4% reduction in downstream JSON parse exceptions; sub-25ms input/output assertion overhead; automated eval test suites evaluating 500+ golden cases across model upgrades.</p>

<h3>How it works</h3>
<p><strong>Prompt as Code &amp; SemVer Registry:</strong> Models prompt templates with typed input/output variables, storing versions with semantic SemVer tags (major: schema contract change, minor: prompt engineering optimization, patch: parameter/temperature tuning).</p>
<p><strong>Structured Output Assertion &amp; JSON Repair:</strong> Enforces strict Zod schema validation on model outputs, with automated markdown stripping and bracket repair for multi-provider API responses (OpenAI, Anthropic, Ollama).</p>
<p><strong>Automated CI/CD Evaluation Pipeline:</strong> Executes regression test suites against prompt releases on golden datasets, computing LLM-as-a-Judge semantic similarity, exact match rates, token costs, and latency metrics.</p>

<h3>How the pieces connect</h3>
<pre><code class="language-mermaid">
flowchart TD
    subgraph PromptRepo [Prompt as Code & Version Control]
        A[Prompt Template Markdown / YAML] --> B[Zod Input/Output Schema Contract]
        B --> C[SemVer Version Resolver]
    end

    subgraph RouterLayer [Multi-Provider Dispatcher]
        C --> D[Model Dispatcher & Failover Router]
        D -->|Primary| E1[Anthropic Claude 3.5 Sonnet]
        D -->|Fallback| E2[OpenAI GPT-4o]
        D -->|Local Sandbox| E3[Ollama Llama 3]
    end

    subgraph ValidationEval [Output Validation & CI/CD Eval]
        E1 & E2 & E3 --> F[Zod Structured JSON Validator & Auto-Repair]
        F --> G[Automated Eval Suite: Golden Datasets]
        G --> H1[LLM-as-a-Judge Semantic Accuracy]
        G --> H2[Latency & Token Cost Profiler]
        G --> H3[Hallucination & Drift Detector]
    end

    subgraph ReleaseGate [Release Pipeline Gate]
        H1 & H2 & H3 --> I{Eval Quality Gate: >= 98% Pass}
        I -->|Pass| J[Promote to Production Registry]
        I -->|Fail| K[Block CI/CD Build & Alert]
    end
</code></pre>

<h3>Implementation notes</h3>

<h4>Type-Safe Prompt Template Contract &amp; Output Assertion (<code>lib/prompt_runner.ts</code>)</h4>
<pre><code class="language-typescript">
// Type-Safe Prompt Template Contract & Output Assertion
import { z } from "zod";

interface PromptDefinition&lt;TInput extends z.ZodTypeAny, TOutput extends z.ZodTypeAny&gt; {
  id: string;
  version: string;
  inputSchema: TInput;
  outputSchema: TOutput;
  template: (inputs: z.infer&lt;TInput&gt;) => string;
}

class PromptRunner {
  public static async execute&lt;TIn extends z.ZodTypeAny, TOut extends z.ZodTypeAny&gt;(
    def: PromptDefinition&lt;TIn, TOut&gt;,
    inputs: z.infer&lt;TIn&gt;,
    dispatcher: (prompt: string) => Promise&lt;string&gt;
  ): Promise&lt;z.infer&lt;TOut&gt;&gt; {
    // 1. Assert input schema conformance
    const validatedInput = def.inputSchema.parse(inputs);
    const promptText = def.template(validatedInput);

    // 2. Dispatch to LLM provider
    const rawResponse = await dispatcher(promptText);

    // 3. Extract JSON and validate against output contract
    const startIdx = rawResponse.indexOf("{");
    const endIdx = rawResponse.lastIndexOf("}");
    const cleanedJson = startIdx !== -1 && endIdx !== -1 ? rawResponse.slice(startIdx, endIdx + 1) : rawResponse;
    return def.outputSchema.parse(JSON.parse(cleanedJson));
  }
}
</code></pre>

<h4>Automated CI/CD Evaluation Runner (<code>lib/evals/eval_suite.ts</code>)</h4>
<pre><code class="language-typescript">
// Automated Golden Dataset Eval Suite Runner
interface EvalCase {
  input: Record&lt;string, unknown&gt;;
  expectedOutput: Record&lt;string, unknown&gt;;
}

async function runEvalSuite(
  evalCases: EvalCase[],
  runner: (input: Record&lt;string, unknown&gt;) => Promise&lt;Record&lt;string, unknown&gt;&gt;
): Promise&lt;{ passRate: number; totalCases: number }&gt; {
  let passed = 0;
  for (const testCase of evalCases) {
    const result = await runner(testCase.input);
    if (JSON.stringify(result) === JSON.stringify(testCase.expectedOutput)) {
      passed++;
    }
  }
  return {
    passRate: (passed / evalCases.length) * 100,
    totalCases: evalCases.length,
  };
}
</code></pre>

<h3>Tradeoffs and lessons</h3>
<ul>
  <li><strong>Strict Schemas vs. Unstructured Chat:</strong> Schema-driven structured outputs combined with CI eval gates reduced downstream API contract failures by 99.4%.</li>
  <li><strong>Multi-Provider Failover:</strong> Dynamic routing between Anthropic and OpenAI ensured high availability during third-party API degradation.</li>
  <li><strong>Prompt Regression Isolation:</strong> Treating prompt templates as SemVer packages isolated behavioral changes, allowing safe rollbacks when model providers updated underlying model weights.</li>
</ul>`,
    commands_json: JSON.stringify(PROMPTOPS_COMMANDS_OBJ),
    playback_json: JSON.stringify(PROMPTOPS_PLAYBACK_OBJ),
    created_at: new Date("2026-03-25T00:00:00Z"),
    updated_at: new Date("2026-08-18T00:00:00Z"),
  });
