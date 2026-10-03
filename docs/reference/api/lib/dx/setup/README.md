[**fderuiter-portfolio**](../../../README.md)

***

[fderuiter-portfolio](../../../modules.md) / lib/dx/setup

# lib/dx/setup

## Interfaces

- [SetupOptions](interfaces/SetupOptions.md)

## Variables

- [runCommand](variables/runCommand.md)

## Functions

- [parseShellStages](functions/parseShellStages.md)
- [runSetupWorkflow](functions/runSetupWorkflow.md)
- [validateLockfiles](functions/validateLockfiles.md)
- [validateNodeRuntime](functions/validateNodeRuntime.md)
- [validatePackageManager](functions/validatePackageManager.md)

## References

### AtomicWriteIo

Re-exports [AtomicWriteIo](environment/interfaces/AtomicWriteIo.md)

***

### classifyEnvKey

Re-exports [classifyEnvKey](environment/functions/classifyEnvKey.md)

***

### CommandResult

Re-exports [CommandResult](providers/publish/interfaces/CommandResult.md)

***

### CommandRunner

Re-exports [CommandRunner](providers/publish/type-aliases/CommandRunner.md)

***

### createNonInteractivePrompter

Re-exports [createNonInteractivePrompter](prompts/functions/createNonInteractivePrompter.md)

***

### createTerminalPrompter

Re-exports [createTerminalPrompter](prompts/functions/createTerminalPrompter.md)

***

### DatabaseIdentity

Re-exports [DatabaseIdentity](database/interfaces/DatabaseIdentity.md)

***

### DatabaseStatus

Re-exports [DatabaseStatus](types/interfaces/DatabaseStatus.md)

***

### DatabaseStepRecord

Re-exports [DatabaseStepRecord](types/interfaces/DatabaseStepRecord.md)

***

### DatabaseStepStatus

Re-exports [DatabaseStepStatus](types/type-aliases/DatabaseStepStatus.md)

***

### deriveUnpooledUrl

Re-exports [deriveUnpooledUrl](environment/functions/deriveUnpooledUrl.md)

***

### detectProductionTarget

Re-exports [detectProductionTarget](database/functions/detectProductionTarget.md)

***

### ENV\_KEY\_CLASSIFICATION

Re-exports [ENV_KEY_CLASSIFICATION](environment/variables/ENV_KEY_CLASSIFICATION.md)

***

### EnvAssignment

Re-exports [EnvAssignment](environment/interfaces/EnvAssignment.md)

***

### EnvironmentStatus

Re-exports [EnvironmentStatus](types/interfaces/EnvironmentStatus.md)

***

### EnvKeyClassification

Re-exports [EnvKeyClassification](types/interfaces/EnvKeyClassification.md)

***

### EnvKeyKind

Re-exports [EnvKeyKind](types/type-aliases/EnvKeyKind.md)

***

### evaluateProfileReadiness

Re-exports [evaluateProfileReadiness](environment/functions/evaluateProfileReadiness.md)

***

### formatEnvAssignment

Re-exports [formatEnvAssignment](environment/functions/formatEnvAssignment.md)

***

### generateCronSecret

Re-exports [generateCronSecret](environment/functions/generateCronSecret.md)

***

### IntegrationOutcome

Re-exports [IntegrationOutcome](types/interfaces/IntegrationOutcome.md)

***

### isPlaceholderValue

Re-exports [isPlaceholderValue](environment/functions/isPlaceholderValue.md)

***

### isSetupProfileId

Re-exports [isSetupProfileId](environment/functions/isSetupProfileId.md)

***

### parseDatabaseIdentity

Re-exports [parseDatabaseIdentity](database/functions/parseDatabaseIdentity.md)

***

### parseEnvAssignments

Re-exports [parseEnvAssignments](environment/functions/parseEnvAssignments.md)

***

### parseEnvValues

Re-exports [parseEnvValues](environment/functions/parseEnvValues.md)

***

### parseVerifyFlag

Re-exports [parseVerifyFlag](verification/functions/parseVerifyFlag.md)

***

### PLACEHOLDER\_MARKERS

Re-exports [PLACEHOLDER_MARKERS](environment/variables/PLACEHOLDER_MARKERS.md)

***

### ProbeContext

Re-exports [ProbeContext](providers/types/interfaces/ProbeContext.md)

***

### ProbeFetch

Re-exports [ProbeFetch](providers/types/type-aliases/ProbeFetch.md)

***

### ProbeResult

Re-exports [ProbeResult](providers/types/interfaces/ProbeResult.md)

***

### PROVIDER\_ADAPTERS

Re-exports [PROVIDER_ADAPTERS](providers/catalog/variables/PROVIDER_ADAPTERS.md)

***

### ProviderAdapter

Re-exports [ProviderAdapter](providers/types/interfaces/ProviderAdapter.md)

***

### ProviderCapability

Re-exports [ProviderCapability](providers/types/type-aliases/ProviderCapability.md)

***

### ProviderKey

Re-exports [ProviderKey](providers/types/interfaces/ProviderKey.md)

***

### ProviderPortability

Re-exports [ProviderPortability](providers/types/interfaces/ProviderPortability.md)

***

### PublishDestination

Re-exports [PublishDestination](providers/types/type-aliases/PublishDestination.md)

***

### PublishOutcome

Re-exports [PublishOutcome](providers/publish/interfaces/PublishOutcome.md)

***

### PublishRequest

Re-exports [PublishRequest](providers/publish/interfaces/PublishRequest.md)

***

### publishToDestination

Re-exports [publishToDestination](providers/publish/functions/publishToDestination.md)

***

### readSetupState

Re-exports [readSetupState](state/functions/readSetupState.md)

***

### redactSecrets

Re-exports [redactSecrets](environment/functions/redactSecrets.md)

***

### resolvePrismaDatabaseUrl

Re-exports [resolvePrismaDatabaseUrl](database/functions/resolvePrismaDatabaseUrl.md)

***

### resolveProviderAdapters

Re-exports [resolveProviderAdapters](providers/catalog/functions/resolveProviderAdapters.md)

***

### runVerification

Re-exports [runVerification](verification/functions/runVerification.md)

***

### schemaCommandFor

Re-exports [schemaCommandFor](database/functions/schemaCommandFor.md)

***

### SETUP\_PROFILE\_IDS

Re-exports [SETUP_PROFILE_IDS](types/variables/SETUP_PROFILE_IDS.md)

***

### SETUP\_PROFILES

Re-exports [SETUP_PROFILES](environment/variables/SETUP_PROFILES.md)

***

### SETUP\_STAGE\_IDS

Re-exports [SETUP_STAGE_IDS](types/variables/SETUP_STAGE_IDS.md)

***

### SETUP\_STATE\_FILE

Re-exports [SETUP_STATE_FILE](state/variables/SETUP_STATE_FILE.md)

***

### SetupCancelledError

Re-exports [SetupCancelledError](prompts/classes/SetupCancelledError.md)

***

### SetupProfile

Re-exports [SetupProfile](environment/interfaces/SetupProfile.md)

***

### SetupProfileId

Re-exports [SetupProfileId](types/type-aliases/SetupProfileId.md)

***

### SetupPrompter

Re-exports [SetupPrompter](prompts/interfaces/SetupPrompter.md)

***

### SetupResult

Re-exports [SetupResult](types/interfaces/SetupResult.md)

***

### SetupStageId

Re-exports [SetupStageId](types/type-aliases/SetupStageId.md)

***

### SetupStageRecord

Re-exports [SetupStageRecord](types/interfaces/SetupStageRecord.md)

***

### SetupStageStatus

Re-exports [SetupStageStatus](types/type-aliases/SetupStageStatus.md)

***

### SetupState

Re-exports [SetupState](state/interfaces/SetupState.md)

***

### upsertEnvContent

Re-exports [upsertEnvContent](environment/functions/upsertEnvContent.md)

***

### validateEnvironmentSchema

Re-exports [validateEnvironmentSchema](environment/functions/validateEnvironmentSchema.md)

***

### VERCEL\_ENVIRONMENTS

Re-exports [VERCEL_ENVIRONMENTS](providers/publish/variables/VERCEL_ENVIRONMENTS.md)

***

### VercelEnvironment

Re-exports [VercelEnvironment](providers/publish/type-aliases/VercelEnvironment.md)

***

### VERIFICATION\_LEVELS

Re-exports [VERIFICATION_LEVELS](verification/variables/VERIFICATION_LEVELS.md)

***

### VerificationCheck

Re-exports [VerificationCheck](types/interfaces/VerificationCheck.md)

***

### VerificationLevel

Re-exports [VerificationLevel](verification/type-aliases/VerificationLevel.md)

***

### VerificationStatus

Re-exports [VerificationStatus](types/type-aliases/VerificationStatus.md)

***

### writeFileAtomic

Re-exports [writeFileAtomic](environment/functions/writeFileAtomic.md)
