/* eslint-disable @typescript-eslint/no-require-imports */

const {
  FORMATTING_EXCLUDED_ARTIFACTS,
} = require("./lib/dx/generated-artifacts.ts");

const GENERATED_ARTIFACTS = new Set(FORMATTING_EXCLUDED_ARTIFACTS);

const CODE_FILE = /\.(?:[cm]?js|jsx|tsx?)$/u;

function quote(file) {
  return JSON.stringify(file);
}

/**
 * A single staged-file task makes formatting finish before ESLint begins.
 * Generated files are verified by their own generators, never reformatted.
 */
module.exports = {
  "*": (files) => {
    const authoredFiles = files.filter(
      (file) =>
        !GENERATED_ARTIFACTS.has(
          file
            .replaceAll("\\", "/")
            .replace(/^(?:.*\/)?(app|public|lib)\//u, "$1/")
        )
    );
    const codeFiles = authoredFiles.filter((file) => CODE_FILE.test(file));
    const commands = [];

    if (authoredFiles.length > 0) {
      commands.push(
        `prettier --ignore-unknown --write ${authoredFiles.map(quote).join(" ")}`
      );
    }
    if (codeFiles.length > 0) {
      commands.push(
        `eslint --fix --no-warn-ignored ${codeFiles.map(quote).join(" ")}`
      );
    }

    return commands;
  },
};
