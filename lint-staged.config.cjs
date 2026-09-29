/* eslint-disable @typescript-eslint/no-require-imports */

const GENERATED_ARTIFACTS = new Set([
  "app/icon.svg",
  "public/favicon.svg",
  "app/favicon.ico",
  "public/favicon.ico",
  "public/apple-touch-icon.png",
  "public/icon-192.png",
  "public/icon-512.png",
  "lib/design-manifest.ts",
  "public/garmin-engine.js",
  "public/monkey-c-mayhem.js",
]);

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
