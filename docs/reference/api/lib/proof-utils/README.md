[**fderuiter-portfolio**](../../README.md)

***

[fderuiter-portfolio](../../modules.md) / lib/proof-utils

# lib/proof-utils

## Interfaces

- [AlignmentGuide](interfaces/AlignmentGuide.md)
- [AstTraceNode](interfaces/AstTraceNode.md)
- [CompatibleTargetInfo](interfaces/CompatibleTargetInfo.md)
- [Edge](interfaces/Edge.md)
- [FallacyDiagnosis](interfaces/FallacyDiagnosis.md)
- [FallacyFormulaAst](interfaces/FallacyFormulaAst.md)
- [LedgerStep](interfaces/LedgerStep.md)
- [ProofNode](interfaces/ProofNode.md)
- [PruneResult](interfaces/PruneResult.md)
- [RuleDefinition](interfaces/RuleDefinition.md)
- [SnapResult](interfaces/SnapResult.md)
- [TacticHint](interfaces/TacticHint.md)
- [TheoremDefinition](interfaces/TheoremDefinition.md)
- [TruthTableRow](interfaces/TruthTableRow.md)

## Type Aliases

- [PropAst](type-aliases/PropAst.md)
- [TheoremCategory](type-aliases/TheoremCategory.md)
- [TheoremId](type-aliases/TheoremId.md)

## Variables

- [INFERENCE\_RULES](variables/INFERENCE_RULES.md)
- [THEOREMS](variables/THEOREMS.md)
- [VALID\_COMMANDS](variables/VALID_COMMANDS.md)
- [VALID\_NODE\_IDS](variables/VALID_NODE_IDS.md)

## Functions

- [applyRuleToAsts](functions/applyRuleToAsts.md)
- [areAstsEqual](functions/areAstsEqual.md)
- [canConnect](functions/canConnect.md)
- [computeMagneticSnap](functions/computeMagneticSnap.md)
- [evaluateAst](functions/evaluateAst.md)
- [evaluateAstWithTrace](functions/evaluateAstWithTrace.md)
- [evaluateProofStatus](functions/evaluateProofStatus.md)
- [exportProofToLatex](functions/exportProofToLatex.md)
- [exportProofToLean4](functions/exportProofToLean4.md)
- [exportProofToMarkdown](functions/exportProofToMarkdown.md)
- [exportProofToMermaid](functions/exportProofToMermaid.md)
- [exportWorkspaceProof](functions/exportWorkspaceProof.md)
- [extractVariables](functions/extractVariables.md)
- [formatFormula](functions/formatFormula.md)
- [generateTruthTable](functions/generateTruthTable.md)
- [getCompatibleTargets](functions/getCompatibleTargets.md)
- [getDeductionLedger](functions/getDeductionLedger.md)
- [getFallacyDiagnosis](functions/getFallacyDiagnosis.md)
- [getNextTacticHint](functions/getNextTacticHint.md)
- [getStepStatusLabel](functions/getStepStatusLabel.md)
- [getSuggestion](functions/getSuggestion.md)
- [isValidNode](functions/isValidNode.md)
- [parseFormula](functions/parseFormula.md)
- [pruneStepOrNode](functions/pruneStepOrNode.md)
