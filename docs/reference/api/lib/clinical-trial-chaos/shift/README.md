[**fderuiter-portfolio**](../../../README.md)

***

[fderuiter-portfolio](../../../modules.md) / lib/clinical-trial-chaos/shift

# lib/clinical-trial-chaos/shift

## Interfaces

- [PhaseProgress](interfaces/PhaseProgress.md)
- [SettledSubmission](interfaces/SettledSubmission.md)
- [ShiftClocks](interfaces/ShiftClocks.md)
- [ShiftClockTick](interfaces/ShiftClockTick.md)
- [ShiftPauseState](interfaces/ShiftPauseState.md)
- [SponsorEventNotice](interfaces/SponsorEventNotice.md)
- [SubmissionScore](interfaces/SubmissionScore.md)
- [ViolationBreakdown](interfaces/ViolationBreakdown.md)

## Type Aliases

- [PowerUpRefusal](type-aliases/PowerUpRefusal.md)

## Variables

- [COFFEE\_BREAK\_END\_LOG](variables/COFFEE_BREAK_END_LOG.md)
- [COFFEE\_BREAK\_START\_LOG](variables/COFFEE_BREAK_START_LOG.md)
- [EXPIRY\_SUSPICION](variables/EXPIRY_SUSPICION.md)
- [MAX\_SHIFT\_TICK\_MS](variables/MAX_SHIFT_TICK_MS.md)
- [PHASE\_TARGETS](variables/PHASE_TARGETS.md)
- [POWER\_UP\_REFUSAL\_LABELS](variables/POWER_UP_REFUSAL_LABELS.md)
- [QUERY\_EXTENSION\_LOG](variables/QUERY_EXTENSION_LOG.md)
- [SHIFT\_END\_LOGS](variables/SHIFT_END_LOGS.md)

## Functions

- [adjustAuditorSuspicion](functions/adjustAuditorSuspicion.md)
- [appendRuleViolation](functions/appendRuleViolation.md)
- [applyCorrectionScore](functions/applyCorrectionScore.md)
- [applySubmissionScore](functions/applySubmissionScore.md)
- [autoCleanSubject](functions/autoCleanSubject.md)
- [breakCombo](functions/breakCombo.md)
- [buildInspectionReport](functions/buildInspectionReport.md)
- [canActivatePowerUp](functions/canActivatePowerUp.md)
- [createRuleViolation](functions/createRuleViolation.md)
- [describePowerUpRefusal](functions/describePowerUpRefusal.md)
- [describeSponsorEvent](functions/describeSponsorEvent.md)
- [endCoffeeBreak](functions/endCoffeeBreak.md)
- [extendSubjectDeadlines](functions/extendSubjectDeadlines.md)
- [formatCorrectionLog](functions/formatCorrectionLog.md)
- [formatExpiryLog](functions/formatExpiryLog.md)
- [formatNextDossierCue](functions/formatNextDossierCue.md)
- [formatRuleFailureLog](functions/formatRuleFailureLog.md)
- [getAmendmentIntervalSeconds](functions/getAmendmentIntervalSeconds.md)
- [getComboMultiplier](functions/getComboMultiplier.md)
- [getFastTrackDomain](functions/getFastTrackDomain.md)
- [getPhaseLockTarget](functions/getPhaseLockTarget.md)
- [getPhaseProgress](functions/getPhaseProgress.md)
- [getPowerUpRefusal](functions/getPowerUpRefusal.md)
- [getSAEChance](functions/getSAEChance.md)
- [getShiftTickSeconds](functions/getShiftTickSeconds.md)
- [getSubjectErrorChance](functions/getSubjectErrorChance.md)
- [getSubmissionCharge](functions/getSubmissionCharge.md)
- [getViolationBreakdown](functions/getViolationBreakdown.md)
- [isPhaseCleared](functions/isPhaseCleared.md)
- [isShiftClockHalted](functions/isShiftClockHalted.md)
- [raiseAuditorSuspicion](functions/raiseAuditorSuspicion.md)
- [recordExpiredSubjects](functions/recordExpiredSubjects.md)
- [recordStationSubmission](functions/recordStationSubmission.md)
- [replaceObservation](functions/replaceObservation.md)
- [scoreSubmission](functions/scoreSubmission.md)
- [selectNextDossier](functions/selectNextDossier.md)
- [settleSubmission](functions/settleSubmission.md)
- [spendPowerUp](functions/spendPowerUp.md)
- [startCoffeeBreak](functions/startCoffeeBreak.md)
- [tickShiftClocks](functions/tickShiftClocks.md)
