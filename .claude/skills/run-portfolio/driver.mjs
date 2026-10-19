#!/usr/bin/env node
/**
 * REPL driver for the portfolio Next.js web app.
 *
 * `chromium-cli` isn't installed in this environment, so this is a small
 * hand-rolled equivalent: a headless-Chromium REPL you pipe commands to.
 * Drives a page against a locally running `next dev` / `next start`
 * server. Designed for agents: wrap in tmux, send-keys commands one at a
 * time, capture-pane the output.
 *
 * Usage: node .claude/skills/run-portfolio/driver.mjs
 */
import * as readline from "node:readline";
import * as fs from "node:fs";
import * as path from "node:path";
import { chromium } from "@playwright/test";

const SHOT_DIR = process.env.SCREENSHOT_DIR || "/tmp/shots";
fs.mkdirSync(SHOT_DIR, { recursive: true });
const BASE_URL = process.env.PORTFOLIO_BASE_URL || "http://localhost:3000";

// This sandbox pre-seeds an older cached Chromium build under a stable,
// unversioned path ($PLAYWRIGHT_BROWSERS_PATH/chromium) instead of the
// exact revision @playwright/test expects, so a bare chromium.launch()
// fails with "Executable doesn't exist". Same fallback as
// lib/dx/browser-launch.ts's launchChromiumWithFallback(), inlined here
// so this driver has zero project-code dependencies and can run standalone.
async function launchChromium(options) {
  try {
    return await chromium.launch(options);
  } catch (error) {
    const browsersPath = process.env.PLAYWRIGHT_BROWSERS_PATH;
    const fallback = browsersPath
      ? path.join(browsersPath, "chromium")
      : undefined;
    if (!fallback || !fs.existsSync(fallback)) throw error;
    return chromium.launch({ ...options, executablePath: fallback });
  }
}

function parseSize(arg) {
  const m = /(\d+)x(\d+)/.exec(arg || "");
  return m ? [Number(m[1]), Number(m[2])] : null;
}

let browser = null;
let page = null;
const consoleErrors = [];

const COMMANDS = {
  // `launch [WxH] [touch]`, e.g. `launch 375x812 touch`. `touch` emulates
  // a coarse pointer, which the arcade's phone gate keys on; a plain
  // narrow viewport never triggers it.
  async launch(arg) {
    if (browser) return console.log("already launched");
    const [width, height] = parseSize(arg) ?? [1280, 800];
    const touch = /\btouch\b/.test(arg || "");
    browser = await launchChromium({ headless: true, args: ["--no-sandbox"] });
    const context = await browser.newContext({
      viewport: { width, height },
      ...(touch ? { hasTouch: true, isMobile: true } : {}),
    });
    // next dev mounts its "N Issue" badge in a <nextjs-portal> shadow host
    // over the bottom-left of every page; hide it so screenshots show the
    // app. SHOW_DEV_OVERLAY=1 keeps it (e.g. to read the error it counts).
    if (!process.env.SHOW_DEV_OVERLAY) {
      await context.addInitScript(() => {
        document.addEventListener("DOMContentLoaded", () => {
          const style = document.createElement("style");
          style.textContent = "nextjs-portal{display:none!important}";
          document.head.appendChild(style);
        });
      });
    }
    page = await context.newPage();
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });
    page.on("pageerror", (err) =>
      consoleErrors.push(`pageerror: ${err.message}`)
    );
    console.log("launched.");
  },

  async viewport(arg) {
    if (!page) return console.log("ERROR: launch first");
    const size = parseSize(arg);
    if (!size) return console.log("usage: viewport <width>x<height>");
    await page.setViewportSize({ width: size[0], height: size[1] });
    console.log("viewport ->", size.join("x"));
  },

  async nav(url) {
    if (!page) return console.log("ERROR: launch first");
    const target = /^https?:\/\//.test(url)
      ? url
      : `${BASE_URL}${url.startsWith("/") ? "" : "/"}${url}`;
    await page.goto(target, { waitUntil: "domcontentloaded", timeout: 30_000 });
    console.log("nav ->", page.url());
  },

  async "wait-for"(arg) {
    if (!page) return console.log("ERROR: launch first");
    try {
      if (arg.startsWith("text=")) {
        await page.getByText(arg.slice(5)).first().waitFor({ timeout: 15_000 });
      } else {
        await page.waitForSelector(arg, { timeout: 15_000 });
      }
      console.log("found:", arg);
    } catch {
      console.log("TIMEOUT:", arg);
    }
  },

  async screenshot(arg) {
    if (!page) return console.log("ERROR: launch first");
    const parts = (arg || "").split(/\s+/).filter(Boolean);
    const fullPage = parts.includes("--full");
    const name = parts.find((p) => p !== "--full");
    const f = path.join(SHOT_DIR, `${name || "ss-" + Date.now()}.png`);
    await page.screenshot({ path: f, fullPage });
    console.log("screenshot:", f);
  },

  async sleep(ms) {
    await new Promise((r) => setTimeout(r, Number(ms) || 1000));
    console.log("slept", Number(ms) || 1000, "ms");
  },

  async tap(sel) {
    if (!page) return console.log("ERROR: launch first");
    try {
      await page.tap(sel, { timeout: 10_000 });
      console.log("tap", sel, "-> OK");
    } catch (e) {
      console.log("tap", sel, "-> ERROR:", e.message.split("\n")[0]);
    }
  },

  async click(sel) {
    if (!page) return console.log("ERROR: launch first");
    try {
      await page.click(sel, { timeout: 10_000 });
      console.log("click", sel, "-> OK");
    } catch (e) {
      console.log("click", sel, "-> ERROR:", e.message.split("\n")[0]);
    }
  },

  async "click-text"(text) {
    if (!page) return console.log("ERROR: launch first");
    try {
      await page
        .getByText(text, { exact: false })
        .first()
        .click({ timeout: 10_000 });
      console.log("click-text", JSON.stringify(text), "-> OK");
    } catch (e) {
      console.log(
        "click-text",
        JSON.stringify(text),
        "-> ERROR:",
        e.message.split("\n")[0]
      );
    }
  },

  async fill(arg) {
    if (!page) return console.log("ERROR: launch first");
    const idx = arg.indexOf(" ");
    const sel = idx === -1 ? arg : arg.slice(0, idx);
    const value = idx === -1 ? "" : arg.slice(idx + 1);
    try {
      await page.fill(sel, value);
      console.log("fill", sel, "-> OK");
    } catch (e) {
      console.log("fill", sel, "-> ERROR:", e.message.split("\n")[0]);
    }
  },

  async type(text) {
    if (!page) return console.log("ERROR: launch first");
    await page.keyboard.type(text, { delay: 20 });
  },

  async press(key) {
    if (!page) return console.log("ERROR: launch first");
    await page.keyboard.press(key);
    console.log("press", key);
  },

  async eval(expr) {
    if (!page) return console.log("ERROR: launch first");
    try {
      console.log(JSON.stringify(await page.evaluate(expr)));
    } catch (e) {
      console.log("ERROR:", e.message);
    }
  },

  async text(sel) {
    if (!page) return console.log("ERROR: launch first");
    const out = await page.evaluate(
      (s) =>
        (s ? document.querySelector(s) : document.body)?.innerText ?? "(null)",
      sel || ""
    );
    console.log(out.slice(0, 2000));
  },

  console(flag) {
    if ((flag || "").includes("--errors")) {
      if (consoleErrors.length === 0) console.log("no console errors captured");
      else consoleErrors.forEach((e) => console.log("console error:", e));
    } else {
      console.log(consoleErrors.length, "console error(s) captured so far");
    }
  },

  async quit() {
    if (browser) await browser.close().catch(() => {});
    browser = null;
    page = null;
  },

  help() {
    console.log("commands:", Object.keys(COMMANDS).join(", "));
  },
};

// Use the raw fd so nothing upstream can steal stdin from under the REPL.
const stdin = fs.createReadStream(null, { fd: fs.openSync("/dev/stdin", "r") });
const rl = readline.createInterface({
  input: stdin,
  output: process.stdout,
  prompt: "driver> ",
});

// Lines run strictly one after another. Without the queue, a `wait-for`
// sent right behind a `nav` starts before the navigation finishes and can
// match the previous page.
let queue = Promise.resolve();
rl.on("line", (line) => {
  queue = queue.then(() => runLine(line));
});

async function runLine(line) {
  const [cmd, ...rest] = line.trim().split(/\s+/);
  if (!cmd) return rl.prompt();
  const fn = COMMANDS[cmd];
  if (!fn) {
    console.log("unknown:", cmd, "- try: help");
    return rl.prompt();
  }
  try {
    await fn(rest.join(" "));
  } catch (e) {
    console.log("ERROR:", e.message);
  }
  if (cmd === "quit") {
    rl.close();
    process.exit(0);
  }
  rl.prompt();
}
rl.on("close", async () => {
  await queue;
  await COMMANDS.quit();
  process.exit(0);
});

console.log('portfolio driver - "help" for commands, "launch" to start');
rl.prompt();
