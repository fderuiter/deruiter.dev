[**fderuiter-portfolio**](../../README.md)

***

[fderuiter-portfolio](../../modules.md) / lib/simulator

# lib/simulator

Architectural Archetype simulator: the decision tree behind `/simulator`
and the pure, deterministic scoring that turns three answers into an
archetype and four decision stats.

The route stores progress as answer indices in the URL hash (`ans=0,1,0`),
so everything here is a function of those indices alone: the same path
always yields the same archetype, stats and report.

## Interfaces

- [Archetype](interfaces/Archetype.md)
- [SimulatorEvaluation](interfaces/SimulatorEvaluation.md)
- [SimulatorOption](interfaces/SimulatorOption.md)
- [SimulatorQuestion](interfaces/SimulatorQuestion.md)
- [SimulatorState](interfaces/SimulatorState.md)

## Type Aliases

- [ArchetypeId](type-aliases/ArchetypeId.md)
- [AxisPoints](type-aliases/AxisPoints.md)
- [SimulatorAxis](type-aliases/SimulatorAxis.md)
- [SimulatorQuestionId](type-aliases/SimulatorQuestionId.md)
- [SimulatorStepId](type-aliases/SimulatorStepId.md)

## Variables

- [ARCHETYPES](variables/ARCHETYPES.md)
- [SIMULATOR\_AXES](variables/SIMULATOR_AXES.md)
- [SIMULATOR\_FINAL\_STEP](variables/SIMULATOR_FINAL_STEP.md)
- [SIMULATOR\_QUESTIONS](variables/SIMULATOR_QUESTIONS.md)
- [SIMULATOR\_START\_STEP](variables/SIMULATOR_START_STEP.md)

## Functions

- [deriveSimulatorState](functions/deriveSimulatorState.md)
- [evaluateDecisions](functions/evaluateDecisions.md)
- [formatSimulatorReport](functions/formatSimulatorReport.md)
- [maxAxisPoints](functions/maxAxisPoints.md)
- [parseAnswerIndices](functions/parseAnswerIndices.md)
- [replayAnswers](functions/replayAnswers.md)
- [resolveArchetype](functions/resolveArchetype.md)
- [sumAxisPoints](functions/sumAxisPoints.md)
