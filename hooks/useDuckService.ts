import { useCallback, useMemo } from "react";
import {
  DuckCommandHandler,
  DuckCommandInput,
  DuckCommandInputSchema,
  DuckCommandResult,
  InteractHazardHandler,
  InteractHazardInput,
  InteractHazardInputSchema,
  InteractHazardResult,
  createFailure,
} from "@/lib/services/client";

/**
 * Custom React hook providing access to Working With Duck domain service operations.
 * Wraps DuckCommandHandler and InteractHazardHandler with Zod input validation
 * and zero-exception ServiceResult error handling.
 */
export function useDuckService() {
  const commandHandler = useMemo(() => new DuckCommandHandler(), []);
  const hazardHandler = useMemo(() => new InteractHazardHandler(), []);

  const dispatchCommand = useCallback(
    (input: DuckCommandInput): DuckCommandResult => {
      const parsed = DuckCommandInputSchema.safeParse(input);
      if (!parsed.success) {
        return createFailure(
          "INVALID_STATE",
          parsed.error.issues[0]?.message || "Invalid Duck command input",
          {
            suggestion: "Verify Duck state and command parameters",
            recoverable: true,
            details: parsed.error,
          }
        );
      }
      return commandHandler.execute(parsed.data);
    },
    [commandHandler]
  );

  const interactHazard = useCallback(
    (input: InteractHazardInput): InteractHazardResult => {
      const parsed = InteractHazardInputSchema.safeParse(input);
      if (!parsed.success) {
        return createFailure(
          "INVALID_STATE",
          parsed.error.issues[0]?.message || "Invalid hazard interaction input",
          {
            suggestion: "Verify hazard target and duck state parameters",
            recoverable: true,
            details: parsed.error,
          }
        );
      }
      return hazardHandler.execute(parsed.data);
    },
    [hazardHandler]
  );

  return useMemo(
    () => ({
      dispatchCommand,
      interactHazard,
    }),
    [dispatchCommand, interactHazard]
  );
}
