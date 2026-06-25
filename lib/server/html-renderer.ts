import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import puppeteerCore, { type Browser } from "puppeteer-core";

/**
 * Server-side HTML → PNG renderer. Drives the html-mockup screenshot cache
 * (data/<appId>/design/mockup-screenshots/<pageId>.png), which the frontend
 * agent receives as a multimodal vision input ALONGSIDE the inlined html text.
 *
 * The structured text gives the agent copy fidelity (verbatim quotes); the
 * rendered image gives spatial truth (proportions, alignment, density, visual
 * rhythm) that pure text/markup can't carry. Multimodal beats single-modal —
 * the Figma MCP literature was explicit, and the design-to-code failure mode
 * we'd otherwise hit is "agent forgets layout."
 *
 * Uses puppeteer-core + the system Chrome binary (not bundled Chromium, ~165MB
 * lighter install). The browser instance is cached across renders within a
 * process, so the puppeteer launch cost (~400ms) is amortized.
 */

const CHROME_CANDIDATES = [
  // macOS
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  // Linux
  "/usr/bin/google-chrome",
  "/usr/bin/google-chrome-stable",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
];

function findChromeBinary(): string | null {
  // Explicit override wins — useful for CI / non-standard installs.
  if (process.env.CHROME_PATH && existsSync(process.env.CHROME_PATH)) {
    return process.env.CHROME_PATH;
  }
  for (const p of CHROME_CANDIDATES) {
    if (existsSync(p)) return p;
  }
  return null;
}

let cachedBrowser: Browser | null = null;

async function getBrowser(): Promise<Browser | null> {
  if (cachedBrowser?.connected) return cachedBrowser;
  const executablePath = findChromeBinary();
  if (!executablePath) {
    console.warn(
      "[html-renderer] no Chrome binary found — set CHROME_PATH env var. HTML→PNG rendering disabled.",
    );
    return null;
  }
  cachedBrowser = await puppeteerCore.launch({
    executablePath,
    headless: true,
    // --no-sandbox is needed in containerised dev envs and harmless on local Mac.
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  return cachedBrowser;
}

export interface RenderOptions {
  /** Viewport width (px). Default 1400 — desktop. */
  width?: number;
  /** Viewport height (px). Default 900. */
  height?: number;
  /** Device scale factor (Retina = 2). Default 1 for smaller PNGs. */
  deviceScaleFactor?: number;
  /** Wait this many ms after `setContent` before snapshotting, so any fonts /
   *  images finish settling. Default 300. */
  settleMs?: number;
}

/** Render an HTML document string to a PNG buffer. Returns null when the
 *  Chrome binary can't be found (renderer silently disabled) or on any
 *  per-render error — callers must tolerate the cache miss. */
export async function renderHtmlToPng(
  html: string,
  options: RenderOptions = {},
): Promise<Buffer | null> {
  const browser = await getBrowser();
  if (!browser) return null;

  const { width = 1400, height = 900, deviceScaleFactor = 1, settleMs = 300 } = options;

  try {
    const page = await browser.newPage();
    await page.setViewport({ width, height, deviceScaleFactor });
    // `domcontentloaded` returns once the doc has parsed; `networkidle0` would
    // hang on external font CDNs the mockup may load. settleMs covers fonts.
    await page.setContent(html, { waitUntil: "domcontentloaded" });
    if (settleMs > 0) await new Promise((r) => setTimeout(r, settleMs));
    // Full-page screenshot, not just the viewport — mockups often scroll.
    const buffer = await page.screenshot({ type: "png", fullPage: true });
    await page.close();
    return Buffer.from(buffer);
  } catch (error) {
    console.warn("[html-renderer] render failed:", error instanceof Error ? error.message : error);
    return null;
  }
}

const appDir = (appId: string) => path.join(process.cwd(), "data", appId);

function screenshotPath(appId: string, pageId: string): string {
  return path.join(appDir(appId), "design", "mockup-screenshots", `${pageId}.png`);
}

/** Render the given HTML mockup and cache the PNG on disk under its pageId.
 *  Returns the absolute path on success, null otherwise (renderer disabled or
 *  render error). The build handoff reads the cached file and attaches it as
 *  a vision part. */
export async function cacheHtmlScreenshot(
  appId: string,
  pageId: string,
  html: string,
  options?: RenderOptions,
): Promise<string | null> {
  const png = await renderHtmlToPng(html, options);
  if (!png) return null;
  const out = screenshotPath(appId, pageId);
  mkdirSync(path.dirname(out), { recursive: true });
  writeFileSync(out, png);
  return out;
}

/** Path to the cached PNG for a (appId, pageId) html mockup, or null if no
 *  screenshot has been cached yet. */
export function readCachedScreenshotPath(appId: string, pageId: string): string | null {
  const p = screenshotPath(appId, pageId);
  return existsSync(p) ? p : null;
}
