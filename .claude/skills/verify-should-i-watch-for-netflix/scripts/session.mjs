// Shared harness for verify-should-i-watch-for-netflix. Imported by scenarios/*.mjs, never run directly.
// Needs: EV (evidence dir, set by the skill), a built dist/ (npm run build).
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { appendFileSync, existsSync, mkdirSync, readdirSync, rmSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');

// Tunable pacing, in ms unless noted. A reviewer can speed a clip up but cannot slow it down, so err slow.
export const PACE = {
  pauseBefore: 1000, // show the target and its starting state
  pauseAfter: 1000, // show the result
  keyDelay: 120, // per character when typing
  finalHold: 2000, // hold the final state
  titleHold: 1500, // scenario title card
  minSecPerAction: 2, // pacing self-check threshold (seconds per action)
};

function loadPlaywright() {
  const roots = [REPO, execFileSync('npm', ['root', '-g'], { encoding: 'utf8' }).trim() + '/@playwright/cli'];
  for (const root of roots) {
    try {
      return createRequire(root + '/')('playwright-core');
    } catch {}
  }
  throw new Error('playwright-core not found: install it globally (npm i -g @playwright/cli) or set up the repo with it');
}

// Extensions need the full Chromium build; the headless shell cannot load them, and branded Chrome ignores --load-extension.
function findChromium() {
  if (process.env.VERIFY_CHROMIUM) return process.env.VERIFY_CHROMIUM;
  const cache = join(homedir(), 'Library/Caches/ms-playwright');
  const linux = join(homedir(), '.cache/ms-playwright');
  for (const base of [cache, linux]) {
    if (!existsSync(base)) continue;
    const dirs = readdirSync(base).filter((d) => /^chromium-\d+$/.test(d)).sort((a, b) => Number(b.slice(9)) - Number(a.slice(9)));
    for (const d of dirs) {
      for (const rel of ['chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing', 'chrome-mac-x64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing', 'chrome-linux64/chrome', 'chrome-linux/chrome']) {
        const p = join(base, d, rel);
        if (existsSync(p)) return p;
      }
    }
  }
  throw new Error('no Playwright Chromium found; set VERIFY_CHROMIUM to a Chromium/Chrome-for-Testing binary');
}

function duration(file) {
  const out = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file], { encoding: 'utf8' });
  return Number(out.trim());
}

export async function start(scenario, { record = true, warmPath = 'options.html' } = {}) {
  const EV = process.env.EV;
  if (!EV) throw new Error('EV (evidence dir) is not set');
  mkdirSync(join(EV, 'video'), { recursive: true });
  mkdirSync(join(EV, 'shots'), { recursive: true });
  const dist = join(REPO, 'dist');
  if (!existsSync(join(dist, 'manifest.json'))) throw new Error('dist/ is missing, run npm run build');
  const { chromium } = loadPlaywright();
  const profile = process.env.VERIFY_PROFILE_DIR || join(EV, `profile-${scenario}`);
  const rawVideo = join(EV, `raw-${scenario}`);
  const ctx = await chromium.launchPersistentContext(profile, {
    headless: false,
    executablePath: findChromium(),
    locale: 'en-US',
    viewport: { width: 1100, height: 800 },
    recordVideo: record ? { dir: rawVideo, size: { width: 1100, height: 800 } } : undefined,
    args: [`--disable-extensions-except=${dist}`, `--load-extension=${dist}`, '--headless=new'],
  });
  let [sw] = ctx.serviceWorkers();
  sw ??= await ctx.waitForEvent('serviceworker', { timeout: 15000 });
  const extId = new URL(sw.url()).host;
  const url = (path) => `chrome-extension://${extId}/${path}`;

  // Visit once before recording so the first load is not in the clip; the warm page's own video is discarded.
  const warm = await ctx.newPage();
  await warm.goto(url(warmPath));
  await warm.close();

  const page = await ctx.newPage();
  const t0 = Date.now();
  const consoleErrors = [];
  page.on('console', (m) => m.type() === 'error' && consoleErrors.push(m.text()));
  page.on('pageerror', (e) => consoleErrors.push(String(e)));
  let actions = 0;
  const checks = [];

  const s = {
    ctx, page, extId, url, consoleErrors, EV,
    pause: (ms = PACE.pauseBefore) => page.waitForTimeout(ms),
    // Overlay text must be a literal from the scenario script, never page content.
    async label(text) {
      await page.evaluate((txt) => {
        let el = document.getElementById('__verify_label');
        if (!el) {
          el = document.createElement('div');
          el.id = '__verify_label';
          el.style.cssText = 'position:fixed;left:50%;top:8px;transform:translateX(-50%);z-index:2147483647;background:#111c;color:#fff;font:600 15px system-ui;padding:6px 14px;border-radius:8px;pointer-events:none';
          document.documentElement.appendChild(el);
        }
        el.textContent = txt;
      }, text);
    },
    async title(text) {
      await s.label(text);
      await s.pause(PACE.titleHold);
    },
    async click(locator, text) {
      actions++;
      await s.label(text);
      await locator.scrollIntoViewIfNeeded();
      await s.pause();
      await locator.click();
      await s.pause(PACE.pauseAfter);
    },
    async type(locator, value, text) {
      actions++;
      await s.label(text);
      await locator.scrollIntoViewIfNeeded();
      await locator.click();
      await locator.fill('');
      await s.pause();
      await locator.pressSequentially(value, { delay: PACE.keyDelay });
      await s.pause(PACE.pauseAfter);
    },
    async shot(name) {
      await page.screenshot({ path: join(EV, 'shots', `${scenario}-${name}.png`) });
    },
    // Reads storage from an extension page, so it works without the service worker being awake.
    storage: (key) => page.evaluate((k) => chrome.storage.local.get(k).then((r) => r[k]), key),
    check(name, ok, detail = '') {
      checks.push({ name, ok: !!ok });
      console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` | ${detail}` : ''}`);
    },
    // Closes the page (a clip is only complete then), saves the clip, runs the pacing check and writes clips.md.
    async finish(proves) {
      await s.pause(PACE.finalHold);
      const passed = checks.length > 0 && checks.every((c) => c.ok) && consoleErrors.length === 0;
      if (consoleErrors.length) console.log('console errors:', consoleErrors);
      let line;
      if (record) {
        const dest = join(EV, 'video', `${scenario}.webm`);
        const video = page.video();
        await page.close();
        await video.saveAs(dest);
        await ctx.close();
        rmSync(rawVideo, { recursive: true, force: true });
        const secs = duration(dest);
        const perAction = secs / Math.max(actions, 1);
        const paced = perAction >= PACE.minSecPerAction;
        console.log(`clip ${dest} ${statSync(dest).size} bytes, ${secs.toFixed(1)}s, ${actions} actions, ${perAction.toFixed(1)}s/action (min ${PACE.minSecPerAction}) ${paced ? 'PACING OK' : 'PACING TOO FAST, re-record slower'}`);
        line = `- video/${scenario}.webm | ${proves} | ${passed && paced ? 'PASS' : 'FAIL'}\n`;
        s.paced = paced;
        s.passed = passed && paced;
      } else {
        await ctx.close();
        line = `- (no clip) ${scenario} | ${proves} | ${passed ? 'PASS' : 'FAIL'}\n`;
        s.passed = passed;
      }
      appendFileSync(join(EV, 'clips.md'), line);
      console.log(line.trim());
      process.exitCode = s.passed ? 0 : 1;
    },
  };
  console.log(`session ${scenario}: ext ${extId}, evidence ${EV}, t0 ${t0}`);
  return s;
}
