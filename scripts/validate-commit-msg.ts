#!/usr/bin/env node
import fs from "fs";
import {
  validateCommitMessage,
  ALLOWED_COMMIT_TYPES,
} from "../lib/dx/git-guard";
import { colors } from "../lib/dx/utils";

function main() {
  const commitMsgFile = process.argv[2];

  let rawMessage = "";
  if (commitMsgFile && fs.existsSync(commitMsgFile)) {
    rawMessage = fs.readFileSync(commitMsgFile, "utf-8");
  } else if (commitMsgFile) {
    rawMessage = commitMsgFile;
  } else {
    console.error(
      `${colors.brightRed}❌ Error: No commit message provided to validator.${colors.reset}`
    );
    process.exit(1);
  }

  const result = validateCommitMessage(rawMessage);

  if (!result.valid) {
    console.error(
      `\n${colors.brightRed}❌ Commit message validation failed:${colors.reset}\n`
    );
    for (const err of result.errors) {
      console.error(`  ${colors.red}• ${err}${colors.reset}`);
    }
    console.error(
      `\n${colors.bold}Expected Conventional Commit format:${colors.reset}`
    );
    console.error(`  ${colors.cyan}<type>(<scope>): <subject>${colors.reset}`);
    console.error(`\n${colors.bold}Allowed types:${colors.reset}`);
    console.error(
      `  ${colors.yellow}${ALLOWED_COMMIT_TYPES.join(", ")}${colors.reset}`
    );
    console.error(`\n${colors.bold}Examples:${colors.reset}`);
    console.error(
      `  ${colors.gray}feat(proof): add modus ponens inference operator${colors.reset}`
    );
    console.error(
      `  ${colors.gray}fix(dx): resolve doctor environment parity check${colors.reset}`
    );
    console.error(
      `  ${colors.gray}dx(cli): enhance interactive commit prompter${colors.reset}\n`
    );
    console.error(
      `Tip: Use ${colors.cyan}npm run dx commit${colors.reset} for an interactive commit wizard.\n`
    );
    process.exit(1);
  }

  console.log(
    `${colors.brightGreen}✔ Commit message conforms to Conventional Commits format.${colors.reset}`
  );
  process.exit(0);
}

if (typeof process.env.VITEST === "undefined") {
  main();
}
