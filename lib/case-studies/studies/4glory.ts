import { compileCaseStudy } from "../compiler";
import type { CaseStudyCommands, CaseStudyData, CaseStudyPlayback } from "../types";

export const FOUR_GLORY_COMMANDS_OBJ: CaseStudyCommands = {
  "4glory stream connect --match-id EPL-2026-M42": {
    description:
      "Connects to live match telemetry stream and initializes spatial event parser.",
    payload: {
      matchId: "EPL-2026-M42",
      fixture: "Arsenal vs. Manchester City",
      streamStatus: "CONNECTED_LIVE",
      sampleRateHz: 25,
      eventBufferCapacity: 65536,
      latencyMs: 18.4,
    },
  },
  "4glory analytics compute-xg --match-id EPL-2026-M42": {
    description:
      "Evaluates live cumulative expected goals (xG), shot quality metrics, and pitch control.",
    payload: {
      homeTeam: {
        name: "Arsenal",
        actualGoals: 2,
        cumulativeXg: 2.18,
        shotCount: 14,
      },
      awayTeam: {
        name: "Manchester City",
        actualGoals: 1,
        cumulativeXg: 1.42,
        shotCount: 9,
      },
      highestQualityChance: {
        minute: 64,
        player: "B. Saka",
        shotType: "Left Foot / Open Play",
        xg: 0.62,
        distanceMeters: 9.2,
        angleDegrees: 42.1,
      },
    },
  },
  '4glory sim run --home "Arsenal" --away "Manchester City" --iterations 10000':
    {
      description:
        "Executes 10,000-iteration Monte Carlo simulation from current match state.",
      payload: {
        iterationsCompleted: 10000,
        durationMs: 142.6,
        simulatedProbabilities: {
          homeWin: "56.4%",
          draw: "25.1%",
          awayWin: "18.5%",
        },
        mostLikelyScoreline: "2 - 1 (Probability: 19.8%)",
      },
    },
  '4glory evaluate-hypothesis --hypothesis "High press in transition forces turnover against low block"':
    {
      description:
        "Empirically tests fan tactical hypothesis against seasonal spatial dataset.",
      payload: {
        hypothesis:
          "High press in transition forces turnover against low block",
        sampleSizeMatches: 380,
        empiricalTurnoverRate: "64.2%",
        counterAttackConversionRate: "14.8%",
        verdict: "CONFIRMED_STATISTICALLY_SIGNIFICANT",
        fredBallKnowledgeScore: "98.7% // ELITE TACTICAL INTELLECT",
      },
    },
};

export const FOUR_GLORY_PLAYBACK_OBJ: CaseStudyPlayback = [
  {
    command: "4glory stream connect --match-id EPL-2026-M42",
    description: "Connect to live match telemetry WebSocket stream",
  },
  {
    command: "4glory analytics compute-xg --match-id EPL-2026-M42",
    description:
      "Compute spatial expected goals (xG) and pitch control telemetry",
  },
  {
    command:
      '4glory sim run --home "Arsenal" --away "Manchester City" --iterations 10000',
    description: "Execute 10,000-iteration Monte Carlo match simulation",
  },
  {
    command:
      '4glory evaluate-hypothesis --hypothesis "High press in transition forces turnover against low block"',
    description: "Evaluate tactical hypothesis against empirical tracking data",
  },
];

export const caseStudy: CaseStudyData = compileCaseStudy({
    id: "canonical-18",
    slug: "4glory",
    title: "4Glory: Does Fred Know Ball?",
    primary_language: "Python",
    github_url: "https://github.com/fderuiter/4Glory",
    published: true,
    simulated_telemetry: false,
    tags: "TypeScript, Python, XGBoost, Pandas, Scikit-Learn, Basketball Analytics, Sports Analytics, Machine Learning, Feature Engineering, Monte Carlo, Kaggle",
    editorial_content:
      "A **Python** basketball prediction project that compares my basketball judgment with **XGBoost** models across NBA seasons. Includes rolling features, walk-forward validation, and SHAP analysis. Confidence is easy; checking it takes a dataset.",
    architectural_narrative: `<h3>The problem</h3>
<p>I have basketball opinions. This project gives them something to compete against: models trained on NBA data. The interesting part is testing predictions on later games and seeing which features hold up when the answer is not already known.</p>
<p><strong>The approach:</strong> Rolling features feed XGBoost models, and walk-forward validation tests them on later games. SHAP analysis helps explain what influenced a prediction.</p>
<p><strong>Reported project measurements:</strong> Out-of-sample prediction accuracy benchmarked across 2,400+ games; 100% leak-free temporal splitting; calibrated Brier score &lt; 0.198 on spread and win probability forecasts.</p>

<h3>How it works</h3>
<p><strong>Vectorized Rolling Feature Pipeline:</strong> Computes cumulative and windowed rolling differentials (Offensive Rating, Defensive Rating, True Shooting %, Rebound Rate, Turnover Delta) using vectorized NumPy/Pandas transforms without row-iteration bottlenecks.</p>
<p><strong>Temporal Walk-Forward Validation:</strong> Enforces strictly chronological train/test splits that model real-world deployment, eliminating look-ahead bias common in naive random cross-validation.</p>
<p><strong>Probability Calibration in High-Variance Regimes:</strong> Calibrates raw XGBoost and logistic regression logits using Platt scaling and isotonic regression to yield reliable win probabilities for expected value analysis.</p>
<p><strong>SHAP Feature Explainability:</strong> Decomposes model predictions into interpretable feature contributions, surfacing how schedule fatigue, rest disparity, and pace deltas influence outcome projections.</p>

<h3>How the pieces connect</h3>
<pre><code class="language-mermaid">
flowchart TD
    subgraph Data Ingestion
        A[Raw Match Telemetry & Box Scores: NBA API] --> B[Data Cleaning & Temporal Alignment]
    end
    subgraph Feature Engineering
        B --> C[Vectorized Rolling Feature Engine: L5, L10, Season]
        C --> D1[Offensive / Defensive Rating Differentials]
        C --> D2[Pace-Adjusted Four Factors & Shot Quality]
        C --> D3[Rest Days & Travel Fatigue Heuristic Indices]
    end
    subgraph Model Ensemble & Validation
        D1 & D2 & D3 --> E[Temporal Walk-Forward Validation Splitter]
        E --> F1[Fred Expert Domain Heuristics Engine]
        E --> F2[XGBoost & Logistic Regression Ensemble]
        F1 & F2 --> G[Probability Calibration & Expected Value Model]
    end
    subgraph Decision Engine
        G --> H[Model vs Human Performance & SHAP Interpretability]
        H --> I[Decision Matrix & Live Match Prediction Ledger]
    end
</code></pre>

<h3>Implementation notes</h3>

<h4>Vectorized Rolling Feature Pipeline (<code>src/features/rolling_pipeline.py</code>)</h4>
<pre><code class="language-python">
# Vectorized rolling window feature generator for team match histories
import pandas as pd
import numpy as np

def compute_rolling_team_features(df: pd.DataFrame, windows=[5, 10]) -> pd.DataFrame:
    """Computes rest-adjusted rolling offensive and defensive efficiency deltas."""
    df = df.sort_values(by=["team_id", "game_date"]).copy()
    
    for w in windows:
        # Shift by 1 to strictly prevent current-game leakage
        df[f"roll_ortg_{w}"] = df.groupby("team_id")["ortg"].transform(
            lambda x: x.shift(1).rolling(w, min_periods=max(1, w // 2)).mean()
        )
        df[f"roll_drtg_{w}"] = df.groupby("team_id")["drtg"].transform(
            lambda x: x.shift(1).rolling(w, min_periods=max(1, w // 2)).mean()
        )
        df[f"roll_net_rating_{w}"] = df[f"roll_ortg_{w}"] - df[f"roll_drtg_{w}"]
        df[f"roll_pace_{w}"] = df.groupby("team_id")["pace"].transform(
            lambda x: x.shift(1).rolling(w, min_periods=max(1, w // 2)).mean()
        )
        
    df["rest_days"] = df.groupby("team_id")["game_date"].diff().dt.days.fillna(7).clip(upper=7)
    return df
</code></pre>

<h4>Temporal Walk-Forward Validation Splitter (<code>src/validation/temporal_split.py</code>)</h4>
<pre><code class="language-python">
# Strict temporal walk-forward split generator
from typing import Generator, Tuple
import pandas as pd

def temporal_walk_forward_cv(
    df: pd.DataFrame,
    date_col: str = "game_date",
    initial_train_seasons: int = 3,
    step_months: int = 1
) -> Generator[Tuple[pd.Index, pd.Index], None, None]:
    """Generates temporal expanding-window train/validation indices."""
    unique_dates = df[date_col].sort_values().unique()
    split_start_idx = int(len(unique_dates) * (initial_train_seasons / 10.0))
    
    current_idx = split_start_idx
    while current_idx < len(unique_dates):
        split_date = unique_dates[current_idx]
        train_mask = df[date_col] < split_date
        val_mask = (df[date_col] >= split_date) & (df[date_col] < split_date + pd.DateOffset(months=step_months))
        
        if val_mask.sum() > 0:
            yield df[train_mask].index, df[val_mask].index
            
        current_idx += max(1, int(len(unique_dates) * 0.05))
</code></pre>

<h4>SHAP Feature Interpretability Engine (<code>src/models/explainability.py</code>)</h4>
<pre><code class="language-python">
# SHAP model explainability decomposition for basketball predictions
import shap

def explain_matchup_prediction(model, feature_matrix: pd.DataFrame, matchup_idx: int):
    """Decomposes a single game prediction into feature attribution values."""
    explainer = shap.TreeExplainer(model)
    shap_values = explainer(feature_matrix)
    
    return {
        "expected_value": float(explainer.expected_value),
        "game_features": feature_matrix.iloc[matchup_idx].to_dict(),
        "attributions": dict(zip(feature_matrix.columns, shap_values.values[matchup_idx]))
    }
</code></pre>

<h3>Tradeoffs and lessons</h3>
<ul>
  <li><strong>Look-Ahead Bias Elimination:</strong> Standard k-fold cross validation artificially inflates sports prediction accuracy by training on future games to predict past games. Enforcing temporal walk-forward splitting yielded realistic out-of-sample metrics.</li>
  <li><strong>Probability Calibration in High-Variance Environments:</strong> Applying Platt scaling to model logits prevented overconfident probability estimates in high 3-point shooting variance matchups.</li>
  <li><strong>Decoupled Production Architecture:</strong> Refactoring exploratory Jupyter notebooks into modular, type-annotated Python scripts with automated test harnesses enabled reliable model retraining and historical backtesting.</li>
</ul>`,
    commands_json: JSON.stringify(FOUR_GLORY_COMMANDS_OBJ),
    playback_json: JSON.stringify(FOUR_GLORY_PLAYBACK_OBJ),
    created_at: new Date("2026-03-20T00:00:00Z"),
    updated_at: new Date("2026-08-18T00:00:00Z"),
  });
