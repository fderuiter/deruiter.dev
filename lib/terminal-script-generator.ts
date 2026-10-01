/**
 * Client-Side Terminal EDC Script Generator Utility
 * Converts interactive terminal command history into executable Bash (.sh) and Python (.py) scripts.
 */

export interface ScriptExportOptions {
  slug?: string;
  studyId?: string;
  timestamp?: string;
}

/**
 * Escapes single quotes for safe embedding in Bash shell single-quoted string literals.
 */
export function escapeShellArg(arg: string): string {
  return `'${arg.replace(/'/g, "'\\''")}'`;
}

/**
 * Escapes string values safely for embedding into Python string literals.
 */
export function escapePythonString(val: string): string {
  return JSON.stringify(val);
}

/**
 * Extracts the string value associated with a CLI flag (e.g., --id 123 or --study BRIGHT-01).
 */
export function extractFlagValue(cmd: string, flag: string): string | null {
  const regex = new RegExp(`${flag}(?:=|\\s+)("[^"]*"|'[^']*'|\\S+)`, "i");
  const match = cmd.match(regex);
  if (!match) return null;
  let val = match[1].trim();
  if (
    (val.startsWith('"') && val.endsWith('"')) ||
    (val.startsWith("'") && val.endsWith("'"))
  ) {
    val = val.slice(1, -1);
  }
  return val;
}

/**
 * Generates an executable Bash script (.sh) representing the terminal command sequence.
 */
export function generateBashScript(
  commands: string[],
  options: ScriptExportOptions = {}
): string {
  const nowIso = options.timestamp || new Date().toISOString();
  const slug = options.slug || "imednet-python-sdk";
  const studyId = options.studyId || "BRIGHT-01";

  const validCommands = commands
    .map((c) => c.trim())
    .filter((c) => c.length > 0 && c !== "clear" && c !== "help");

  const effectiveCommands =
    validCommands.length > 0
      ? validCommands
      : [
          "imednet studies list",
          `imednet subjects get --id 123`,
          `imednet records search --study ${studyId}`,
        ];

  const lines: string[] = [
    "#!/usr/bin/env bash",
    "# ==============================================================================",
    "# iMednet Clinical EDC Execution Pipeline Script",
    `# Generated on: ${nowIso}`,
    `# Target Project / SDK: ${slug}`,
    `# Primary Study Context: ${studyId}`,
    "# Description: Automated Bash CLI / curl execution pipeline for clinical trial data",
    "# ==============================================================================",
    "set -euo pipefail",
    "",
    "# Base Configuration",
    'IMEDNET_API_URL="${IMEDNET_API_URL:-https://api.imednet.edc/v1}"',
    'IMEDNET_API_KEY="${IMEDNET_API_KEY:-your_api_key_here}"',
    "",
    'echo "Starting iMednet EDC Command Sequence Execution..."',
    'echo "=================================================="',
    "",
  ];

  effectiveCommands.forEach((cmd, idx) => {
    lines.push(`# Step ${idx + 1}: ${cmd}`);
    lines.push(`echo "[EXEC ${idx + 1}/${effectiveCommands.length}] ${cmd}"`);

    const lower = cmd.toLowerCase();

    if (lower === "imednet studies list") {
      lines.push('curl -s -X GET "${IMEDNET_API_URL}/studies" \\');
      lines.push('  -H "Authorization: Bearer ${IMEDNET_API_KEY}" \\');
      lines.push('  -H "Accept: application/json"');
      lines.push('echo ""');
    } else if (lower.startsWith("imednet subjects get")) {
      const subjectId = extractFlagValue(cmd, "--id") || "123";
      const safeSubId = escapeShellArg(subjectId);
      lines.push(`SUB_ID=${safeSubId}`);
      lines.push('curl -s -X GET "\${IMEDNET_API_URL}/subjects/\${SUB_ID}" \\');
      lines.push('  -H "Authorization: Bearer \${IMEDNET_API_KEY}" \\');
      lines.push('  -H "Accept: application/json"');
      lines.push('echo ""');
    } else if (lower.startsWith("imednet records search")) {
      const study = extractFlagValue(cmd, "--study") || studyId;
      const safeStudy = escapeShellArg(study);
      lines.push(`STUDY_NAME=${safeStudy}`);
      lines.push(
        'curl -s -X GET "\${IMEDNET_API_URL}/records/search?study_id=\${STUDY_NAME}" \\'
      );
      lines.push('  -H "Authorization: Bearer \${IMEDNET_API_KEY}" \\');
      lines.push('  -H "Accept: application/json"');
      lines.push('echo ""');
    } else {
      // Generic command sanitization and execution
      const sanitized = cmd.replace(/[`$\\]/g, "\\$&");
      lines.push(`${sanitized}`);
      lines.push('echo ""');
    }
    lines.push("");
  });

  lines.push('echo "iMednet EDC Execution Pipeline Completed Successfully."');
  return lines.join("\n");
}

/**
 * Generates an executable Python script (.py) representing the terminal command sequence.
 */
export function generatePythonScript(
  commands: string[],
  options: ScriptExportOptions = {}
): string {
  const nowIso = options.timestamp || new Date().toISOString();
  const slug = options.slug || "imednet-python-sdk";
  const studyId = options.studyId || "BRIGHT-01";

  const validCommands = commands
    .map((c) => c.trim())
    .filter((c) => c.length > 0 && c !== "clear" && c !== "help");

  const effectiveCommands =
    validCommands.length > 0
      ? validCommands
      : [
          "imednet studies list",
          `imednet subjects get --id 123`,
          `imednet records search --study ${studyId}`,
        ];

  const lines: string[] = [
    "#!/usr/bin/env python3",
    "# ==============================================================================",
    "# iMednet Clinical EDC Execution Pipeline Script",
    `# Generated on: ${nowIso}`,
    `# Target Project / SDK: ${slug}`,
    `# Primary Study Context: ${studyId}`,
    "# Description: Automated Python requests/SDK pipeline for clinical trial data",
    "# ==============================================================================",
    "",
    "import os",
    "import sys",
    "import json",
    "import requests",
    "",
    'BASE_URL = os.getenv("IMEDNET_API_URL", "https://api.imednet.edc/v1")',
    'API_KEY = os.getenv("IMEDNET_API_KEY", "your_api_key_here")',
    "",
    "HEADERS = {",
    '    "Authorization": f"Bearer {API_KEY}",',
    '    "Content-Type": "application/json",',
    '    "Accept": "application/json",',
    "}",
    "",
    "",
    "def run_pipeline():",
    '    print("Starting iMednet EDC Command Sequence Execution...")',
    '    print("==================================================")',
    "",
  ];

  effectiveCommands.forEach((cmd, idx) => {
    lines.push(`    # Step ${idx + 1}: ${cmd}`);
    lines.push(
      `    print(${escapePythonString(`[EXEC ${idx + 1}/${effectiveCommands.length}] ${cmd}`)})`
    );

    const lower = cmd.toLowerCase();

    if (lower === "imednet studies list") {
      lines.push(
        '    resp = requests.get(f"{BASE_URL}/studies", headers=HEADERS)'
      );
      lines.push("    resp.raise_for_status()");
      lines.push("    print(json.dumps(resp.json(), indent=2))");
    } else if (lower.startsWith("imednet subjects get")) {
      const subjectId = extractFlagValue(cmd, "--id") || "123";
      lines.push(`    subject_id = ${escapePythonString(subjectId)}`);
      lines.push(
        '    resp = requests.get(f"{BASE_URL}/subjects/{subject_id}", headers=HEADERS)'
      );
      lines.push("    resp.raise_for_status()");
      lines.push("    print(json.dumps(resp.json(), indent=2))");
    } else if (lower.startsWith("imednet records search")) {
      const study = extractFlagValue(cmd, "--study") || studyId;
      lines.push(`    study_id = ${escapePythonString(study)}`);
      lines.push(
        '    resp = requests.get(f"{BASE_URL}/records/search", headers=HEADERS, params={"study_id": study_id})'
      );
      lines.push("    resp.raise_for_status()");
      lines.push("    print(json.dumps(resp.json(), indent=2))");
    } else {
      const sanitizedCmd = escapePythonString(cmd);
      lines.push(`    print(f"Executing command: {${sanitizedCmd}}")`);
    }
    lines.push('    print("-" * 50)');
    lines.push("");
  });

  lines.push(
    '    print("iMednet EDC Execution Pipeline Completed Successfully.")'
  );
  lines.push("");
  lines.push("");
  lines.push('if __name__ == "__main__":');
  lines.push("    run_pipeline()");

  return lines.join("\n");
}
