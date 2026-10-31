import { compileCaseStudy } from "../compiler";
import type { CaseStudyData } from "../types";

export const caseStudy: CaseStudyData = compileCaseStudy({
    id: "canonical-13",
    slug: "clintrials",
    title: "clintrials: Try Trial Designs in Your Browser",
    primary_language: "Python",
    github_url: "https://github.com/fderuiter/clintrials",
    published: true,
    simulated_telemetry: false,
    tags: "biostatistics, clinical-trials, pyodide, wasm, simulation-engine, crm-algorithm",
    editorial_content:
      "A browser-based workspace for comparing **adaptive clinical trial designs**. **Pyodide** workers run models including CRM, EffTox, group sequential designs, and win ratio analyses.",
    architectural_narrative: `<h3>The problem</h3>
<p>Trial design involves comparing assumptions, not just choosing a formula. clintrials brings several statistical models into a browser workspace so their behavior can be explored without setting up a separate Python environment.</p>
<p><strong>The approach:</strong> Pyodide runs Python models in WebAssembly workers, keeping numerical work separate from the page’s interaction loop.</p>
<p><strong>Reported project measurements:</strong> Sub-second CRM dose-escalation simulation over 1,000 trial iterations; 100% client-side Pyodide execution with zero server compute costs; deterministic numerical parity verified against native CPython.</p>

<h3>How it works</h3>
<p><strong>Modular Domain-Driven Architecture:</strong> Core numerical protocol engines (<code>clintrials/core/</code>) are partitioned from specialized trial methodology domains (<code>dosefinding/</code>, <code>phase3/</code>, <code>winratio/</code>) and client runtime hubs (<code>hub/</code>).</p>
<p><strong>Provider &amp; Factory Patterns:</strong> Pluggable simulation interfaces decouple trial definitions from recruitment modeling and diverse rendering targets (Jupyter, CLI, Pyodide).</p>
<p><strong>Deterministic State Solvers:</strong> Non-linear patient accrual and toxicity outcomes are governed by deterministic numerical state solvers.</p>

<h3>How the pieces connect</h3>
<pre><code class="language-mermaid">
flowchart TD
    subgraph CoreEngine [clintrials Core Engine]
        A[Trial Protocol Definition] --> B[Recruitment Solver & Geometry]
        B --> C[Simulation Engine & RNG State]
        C --> D1[Dose Finding CRM / EffTox / WATU]
        C --> D2[Phase 3 Group Sequential Designs]
        C --> D3[Win Ratio Analysis]
    end

    subgraph RuntimeTargets [Execution & Distribution]
        D1 & D2 & D3 --> E1[Python CLI & PyPI Package]
        D1 & D2 & D3 --> E2[Jupyter Interactive Notebooks]
        D1 & D2 & D3 --> E3[Pyodide WebAssembly Worker]
    end

    subgraph HubClient [Browser Client & Hub]
        E3 --> F[Service Worker Cache]
        F --> G[Dashboard Visualizations & UI Views]
    end
</code></pre>

<h3>Implementation notes</h3>

<h4>Patient Accrual Geometry Solver (<code>clintrials/core/recruitment_solver.py</code>)</h4>
<pre><code class="language-python">
# Non-linear accrual geometry & time-to-event solver
from dataclasses import dataclass
from typing import List, Tuple
import math

@dataclass
class RecruitmentGeometry:
    target_sample_size: int
    ramp_up_period_months: float
    steady_state_rate_per_month: float

class RecruitmentSolver:
    def __init__(self, geometry: RecruitmentGeometry):
        self.geom = geometry

    def calculate_accrual_timeline(self) -> List[Tuple[float, int]]:
        """Computes deterministic patient entry timestamps across non-linear ramp-up phases."""
        timeline = []
        enrolled = 0
        current_time = 0.0
        dt = 0.1  # Time step resolution in months

        while enrolled < self.geom.target_sample_size:
            current_time += dt
            if current_time <= self.geom.ramp_up_period_months:
                rate = self.geom.steady_state_rate_per_month * (current_time / self.geom.ramp_up_period_months)
            else:
                rate = self.geom.steady_state_rate_per_month

            incremental_prob = rate * dt
            enrolled_in_step = math.floor(incremental_prob)
            for _ in range(enrolled_in_step):
                if enrolled < self.geom.target_sample_size:
                    enrolled += 1
                    timeline.append((round(current_time, 3), enrolled))
        return timeline
</code></pre>

<h4>Continual Reassessment Method (CRM) Dose Escalation (<code>clintrials/dosefinding/crm.py</code>)</h4>
<pre><code class="language-python">
# Continual Reassessment Method (CRM) posterior toxicity solver
import numpy as np
from typing import List, Dict, Any

class CRMDoseEscalationEngine:
    def __init__(self, skeleton_prior: List[float], target_dlt_rate: float):
        self.skeleton = np.array(skeleton_prior)
        self.target_dlt = target_dlt_rate

    def evaluate_next_dose(self, dose_levels: List[int], dlt_observed: List[int]) -> Dict[str, Any]:
        doses = np.array(dose_levels)
        responses = np.array(dlt_observed)

        def log_likelihood(alpha: float) -> float:
            p_tox = self.skeleton ** np.exp(alpha)
            return np.sum(responses * np.log(p_tox[doses]) + (1 - responses) * np.log(1 - p_tox[doses]))

        alphas = np.linspace(-3.0, 3.0, 601)
        log_likes = np.array([log_likelihood(a) for a in alphas])
        best_alpha = alphas[np.argmax(log_likes)]
        updated_posterior_tox = self.skeleton ** np.exp(best_alpha)
        recommended_dose = int(np.argmin(np.abs(updated_posterior_tox - self.target_dlt)))

        return {
            "estimated_alpha": round(float(best_alpha), 4),
            "posterior_dlt_probs": [round(float(p), 4) for p in updated_posterior_tox],
            "recommended_dose_level": recommended_dose
        }
</code></pre>

<h3>Tradeoffs and lessons</h3>
<ul>
  <li><strong>Client-Side Pyodide WASM vs. Cloud APIs:</strong> Chose client-side execution over hosted API microservices (FastAPI/Celery) to eliminate server hosting overhead, maintain strict data privacy for clinical protocol designers, and enable offline-first simulation via Service Workers.</li>
  <li><strong>Deterministic Parity:</strong> MCMC and CRM escalation models produce identical outputs on native CPython and Pyodide WebAssembly environments, verified via automated fixture suites (<code>test_crm_fixtures.py</code>).</li>
</ul>`,
    created_at: new Date("2026-03-08T00:00:00Z"),
    updated_at: new Date("2026-08-18T00:00:00Z"),
  });
