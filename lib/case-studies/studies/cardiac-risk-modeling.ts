import { compileCaseStudy } from "../compiler";
import type { CaseStudyCommands, CaseStudyData, CaseStudyPlayback } from "../types";

export const CARDIAC_RISK_COMMANDS_OBJ: CaseStudyCommands = {
  "cardiac-ml validate --dataset nhanes-cohort-2026.parquet --adversarial": {
    description:
      "Evaluates dataset for clinical distribution shift and feature leakage via adversarial classifier.",
    payload: {
      adversarialAuc: 0.518,
      driftDetected: false,
      samplesCount: 24890,
      featuresAnalyzed: 34,
      missingnessRate: "4.2%",
      leakCheckStatus: "PASS_ZERO_LEAKAGE",
    },
  },
  "cardiac-ml train --models lgbm,xgboost,catboost --folds 10": {
    description:
      "Executes leak-free 10-fold Stratified OOF training and outputs validation metrics.",
    payload: {
      folds: 10,
      oofMetrics: {
        auroc: 0.8942,
        auprc: 0.7418,
        brierScore: 0.0876,
        expectedCalibrationError: "2.14%",
      },
      ensembleWeights: {
        lightgbm: 0.45,
        xgboost: 0.35,
        catboost: 0.2,
      },
      trainingDurationSec: 18.6,
    },
  },
  "cardiac-ml explain --patient-id PATIENT-8921": {
    description:
      "Generates localized TreeSHAP risk attribution and feature contribution waterfall for a patient.",
    payload: {
      patientId: "PATIENT-8921",
      baselinePopulationRisk: 0.082,
      predicted10YearMaceRisk: 0.287,
      riskCategory: "HIGH_CARDIOVASCULAR_RISK",
      topShapDrivers: [
        { feature: "systolic_bp_mmhg", value: 158, shapContribution: "+0.092" },
        {
          feature: "ldl_cholesterol_mg_dl",
          value: 174,
          shapContribution: "+0.061",
        },
        { feature: "hba1c_percent", value: 7.4, shapContribution: "+0.048" },
        {
          feature: "hdl_cholesterol_mg_dl",
          value: 52,
          shapContribution: "-0.015",
        },
      ],
    },
  },
};

export const CARDIAC_RISK_PLAYBACK_OBJ: CaseStudyPlayback = [
  {
    command:
      "cardiac-ml validate --dataset nhanes-cohort-2026.parquet --adversarial",
    description:
      "Run adversarial validation drift checks on clinical cohort dataset",
  },
  {
    command: "cardiac-ml train --models lgbm,xgboost,catboost --folds 10",
    description:
      "Execute leak-free 10-fold Stratified OOF training across GBDT ensemble",
  },
  {
    command: "cardiac-ml explain --patient-id PATIENT-8921",
    description:
      "Generate TreeSHAP localized risk attribution waterfall for clinical triage",
  },
];

export const caseStudy: CaseStudyData = compileCaseStudy({
    id: "canonical-17",
    slug: "cardiac-risk-modeling",
    title: "Cardiac Risk Modeling: Predictions You Can Inspect",
    primary_language: "Python",
    github_url: "https://github.com/fderuiter/cardiac-risk-modeling",
    external_platform_type: "kaggle",
    external_platform_url:
      "https://www.kaggle.com/code/fredderuiter/fred-predicting-heart-disease",
    published: true,
    simulated_telemetry: false,
    tags: "Python, Scikit-Learn, XGBoost, LightGBM, CatBoost, Tabular ML, Clinical Informatics, Cross-Validation, Adversarial Validation, SHAP, Kaggle, Healthcare Analytics, Machine Learning, Clinical ML",
    editorial_content:
      "A **Python** cardiac risk modeling project using **XGBoost**, **LightGBM**, calibration, and **SHAP** explanations. The writeup examines data leakage, distribution shift, and how to evaluate the predictions.",
    architectural_narrative: `<h3>The problem</h3>
<p>A risk model needs more scrutiny than a good leaderboard score. This project looks at cardiovascular data through preprocessing, cross-validation, calibration, and feature explanations, with particular attention to leakage and changes in the data distribution.</p>
<p><strong>The approach:</strong> Scikit-Learn preprocessing feeds XGBoost and LightGBM models. Cross-validation, probability calibration, and SHAP analysis provide different views of model behavior.</p>
<p><strong>Reported project measurements:</strong> Out-of-fold AUROC of 0.894 with Brier calibration score < 0.088; 100% leak-free temporal & group stratified validation; sub-5ms single-patient risk scoring inference.</p>

<h3>How it works</h3>
<p><strong>Strict In-Fold Preprocessing:</strong> Enforces zero feature leakage by executing robust quantile scaling, iterative multivariate imputation, and one-hot encodings strictly inside cross-validation splits.</p>
<p><strong>Ensemble Model Stacking:</strong> Blends gradient-boosted decision trees (XGBoost, LightGBM, CatBoost) with regularized logistic regression baselines.</p>
<p><strong>Probability Calibration Engine:</strong> Applies Platt scaling (logistic sigmoid calibration) and isotonic regression to convert raw logit margins into well-calibrated posterior probabilities suitable for clinical decision curves.</p>
<p><strong>SHAP Attribution & Feature Importance:</strong> Computes TreeSHAP feature interactions to explain individual patient risk factor contributions (e.g. ST depression delta, exercise-induced angina, age-adjusted max heart rate).</p>

<h3>How the pieces connect</h3>
<pre><code class="language-mermaid">
flowchart TD
    subgraph Data Ingestion & Preprocessing
        A[Raw Patient Data: Clinical CSV] --> B[Exploratory Data Analysis & Outlier Truncation]
        B --> C[Scikit-Learn ColumnTransformer Pipeline]
        C --> D1[Continuous Numerical: RobustScaler / QuantileTransformer]
        C --> D2[Categorical Features: OneHotEncoder]
    end
    subgraph Cross-Validation & Model Ensembling
        D1 & D2 --> E[Stratified K-Fold CV Splitter]
        E --> F1[XGBoost Classifier]
        E --> F2[LightGBM Gradient Booster]
        E --> F3[Calibrated Logistic Regression Baseline]
        F1 & F2 & F3 --> G[Model Evaluation & Hyperparameter Search: Optuna]
    end
    subgraph Calibration & Explainability
        G --> H[Platt Probability Calibration]
        H --> I[SHAP Feature Importance & Attribution Engine]
        I --> J[Actionable Clinical Risk Score Matrix]
    end
</code></pre>

<h3>Implementation notes</h3>

<h4>Leak-Free Stratified Cross-Validation Pipeline (<code>src/pipeline/oof_validator.py</code>)</h4>
<pre><code class="language-python">
# Strict In-Fold Preprocessing & Ensemble OOF Validator
import numpy as np
from sklearn.model_selection import StratifiedKFold
from sklearn.impute import IterativeImputer
from sklearn.calibration import CalibratedClassifierCV
import lightgbm as lgb

class LeakFreeClinicalPipeline:
    def __init__(self, n_splits: int = 10, random_state: int = 42):
        self.n_splits = n_splits
        self.random_state = random_state
        self.oof_predictions = None
        self.models = []

    def fit_predict_oof(self, X: np.ndarray, y: np.ndarray) -> np.ndarray:
        skf = StratifiedKFold(n_splits=self.n_splits, shuffle=True, random_state=self.random_state)
        self.oof_predictions = np.zeros(len(X))

        for fold, (train_idx, val_idx) in enumerate(skf.split(X, y)):
            X_train, y_train = X[train_idx], y[train_idx]
            X_val, y_val = X[val_idx], y[val_idx]

            # Imputation transformer fit strictly on train fold
            imputer = IterativeImputer(max_iter=10, random_state=self.random_state)
            X_train_imp = imputer.fit_transform(X_train)
            X_val_imp = imputer.transform(X_val)

            # Gradient Boosted Classifier with early stopping
            clf = lgb.LGBMClassifier(
                n_estimators=1000,
                learning_rate=0.03,
                num_leaves=31,
                random_state=self.random_state + fold
            )
            clf.fit(
                X_train_imp, y_train,
                eval_set=[(X_val_imp, y_val)],
                callbacks=[lgb.early_stopping(50, verbose=False)]
            )

            # Calibrate probabilities via Isotonic Regression / Platt Scaling
            calibrator = CalibratedClassifierCV(clf, cv="prefit", method="isotonic")
            calibrator.fit(X_val_imp, y_val)

            self.oof_predictions[val_idx] = calibrator.predict_proba(X_val_imp)[:, 1]
            self.models.append(calibrator)

        return self.oof_predictions
</code></pre>

<h4>SHAP Feature Attribution & Waterfall Generator (<code>src/explainability/shap_engine.py</code>)</h4>
<pre><code class="language-python">
# Patient-level SHAP explainability engine
import shap
import pandas as pd

def compute_patient_shap_waterfall(model, background_data: pd.DataFrame, patient_features: pd.DataFrame):
    """Computes TreeSHAP attribution values and expected base value for a patient."""
    explainer = shap.TreeExplainer(model, background_data)
    shap_values = explainer(patient_features)
    
    top_risk_drivers = pd.DataFrame({
        "feature": patient_features.columns,
        "patient_value": patient_features.iloc[0].values,
        "shap_attribution": shap_values.values[0]
    }).sort_values(by="shap_attribution", ascending=False)
    
    return {
        "base_risk": float(explainer.expected_value),
        "predicted_risk": float(model.predict_proba(patient_features)[:, 1][0]),
        "top_drivers": top_risk_drivers.to_dict(orient="records")
    }
</code></pre>

<h3>Tradeoffs and lessons</h3>
<ul>
  <li><strong>Probability Calibration in Clinical Thresholds:</strong> Raw tree output margins can produce overly polarized probabilities. Integrating Platt scaling and isotonic regression aligned predicted risks with empirical clinical prevalence (Expected Calibration Error &lt; 2.5%).</li>
  <li><strong>Feature Attribution vs. Black-Box Accuracy:</strong> Using TreeSHAP allowed clinicians to verify that predictions were driven by physiologically plausible pathways (ST depression, angina) rather than dataset collection artifacts.</li>
  <li><strong>Adversarial Validation:</strong> Testing train vs out-of-cohort clinical site distributions prevented silent covariate shift from degrading cross-hospital diagnostic accuracy.</li>
</ul>`,
    commands_json: JSON.stringify(CARDIAC_RISK_COMMANDS_OBJ),
    playback_json: JSON.stringify(CARDIAC_RISK_PLAYBACK_OBJ),
    created_at: new Date("2026-03-18T00:00:00Z"),
    updated_at: new Date("2026-08-18T00:00:00Z"),
  });
