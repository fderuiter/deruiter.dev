import { useCallback, useRef, useState } from "react";

interface ConsoleLog {
  id: string;
  type: "command" | "output" | "error" | "info" | "success";
  text: string;
}

const WELCOME: ConsoleLog = {
  id: "welcome",
  type: "info",
  text: "Logical Proof Assistant CLI v2.4\nType 'help' to review syntax. Hover or tap nodes to read specifications.",
};

/** The terminal's log, opening with the welcome message. */
export function useConsoleLog() {
  const [consoleLogs, setConsoleLogs] = useState<ConsoleLog[]>([WELCOME]);
  const nextIdRef = useRef(0);

  const addLog = useCallback((type: ConsoleLog["type"], text: string) => {
    nextIdRef.current += 1;
    const id = `log-${nextIdRef.current}`;
    setConsoleLogs((prev) => [...prev, { id, type, text }]);
  }, []);

  const clearLogs = useCallback(() => setConsoleLogs([]), []);

  return { consoleLogs, addLog, clearLogs };
}

export type AddLog = ReturnType<typeof useConsoleLog>["addLog"];
