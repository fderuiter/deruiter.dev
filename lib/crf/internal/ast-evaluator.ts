/**
 * Central facade re-exporting expression evaluation, formula linting,
 * formula presets, and form validation submodules for backwards compatibility.
 */

export {
  ExpressionEvaluator,
  evaluateFormula,
  evaluateCondition,
  evaluateRule,
  evaluateConditionResult,
  combineConditionResults,
  getRuleGroups,
  evaluateRuleResult,
  describeCondition,
  explainRule,
  explainCalculationDerivation,
  isMissingOrNullFlavor,
  calculateBMI,
  calculateMostellerBSA,
  calculateDuboisBSA,
  calculateCockcroftGaultCrCl,
  calculateBazettQTc,
  calculateFridericiaQTc,
  calculateRecistSldChange,
  type Token,
  type TokenType,
  type ConditionExplanation,
  type GroupExplanation,
  type RuleExplanation,
  type DerivationStep,
  type DerivationInputDependency,
  type DerivationExplanation,
} from "./expression-evaluator";

export {
  tokenizeWithSpans,
  lintFormula,
  KNOWN_MATH_FUNCTIONS,
  NUMERIC_DATA_TYPES,
  type FormulaTokenType,
  type HighlightToken,
  type FormulaDiagnostic,
  type FormulaLintResult,
} from "./formula-linter";

export {
  mapPresetToFormVariables,
  CLINICAL_FORMULA_PRESETS,
  type ClinicalFormulaPreset,
} from "./formula-presets";

export { lintForm, type DiagnosticItem } from "./form-linter";
