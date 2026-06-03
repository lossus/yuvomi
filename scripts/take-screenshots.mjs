/**
 * Screenshot Script - Oikos
 * Captures all modules in light + dark mode for two device profiles:
 *   - mobile: output 1206 × 2622, viewport 440 × 956, app content zoomed to 90%
 *   - web:    output 2360 × 1640, viewport 1376 × 1032
 *
 * Exact output resolution is achieved with a fractional deviceScaleFactor and a
 * screenshot clip — the screenshot itself is never rescaled. The mobile profile
 * uses CSS zoom (browser-style) inside the app to fit more content.
 *
 * Suppresses: the dashboard onboarding wizard and the PWA "Install" prompt.
 * Verifies every page rendered real content (fails loudly on empty pages).
 *
 * Usage: node scripts/take-screenshots.mjs   (server must run on BASE_URL)
 */

import { chromium } from '/opt/homebrew/lib/node_modules/playwright/index.mjs';
import { mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCREENSHOT_DIR = resolve(__dirname, '..', 'docs', 'screenshots');
const BASE_URL = 'http://localhost:3001';

const IPHONE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
const DESKTOP_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

const DEVICES = [
  {
    name: 'mobile',
    target: { w: 1206, h: 2622 },
    viewport: { w: 440, h: 956 },
    zoom: 0.9,
    isMobile: true,
    hasTouch: true,
    ua: IPHONE_UA,
    locale: 'en-US',
  },
  {
    name: 'desktop',
    target: { w: 2360, h: 1640 },
    viewport: { w: 1376, h: 1032 },
    zoom: 1,
    isMobile: false,
    hasTouch: false,
    ua: DESKTOP_UA,
    locale: 'en-US',
  },
];

const MODULES = [
  { path: '/',             name: 'dashboard'    },
  { path: '/tasks',        name: 'tasks'        },
  { path: '/calendar',     name: 'calendar'     },
  { path: '/meals',        name: 'meals'        },
  { path: '/recipes',      name: 'recipes'      },
  { path: '/shopping',     name: 'shopping'     },
  { path: '/birthdays',    name: 'birthdays'    },
  { path: '/notes',        name: 'notes'        },
  { path: '/contacts',     name: 'contacts'     },
  { path: '/budget',       name: 'budget'       },
  { path: '/documents',    name: 'documents'    },
  { path: '/housekeeping', name: 'housekeeping' },
  { path: '/settings',     name: 'settings'     },
];

mkdirSync(SCREENSHOT_DIR, { recursive: true });

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// localStorage flags applied before any app code runs.
function initFlags(theme) {
  return (t) => {
    try {
      localStorage.setItem('oikos-locale', 'en');
      localStorage.setItem('oikos-onboarded', '1');                 // skip dashboard wizard
      localStorage.setItem('oikos-install-dismissed', String(Date.now())); // skip PWA install prompt
      localStorage.setItem('oikos-theme', t);
    } catch {}
    window.addEventListener('beforeinstallprompt', (e) => e.preventDefault());
  };
}

async function dismissOverlays(page) {
  // Remove any onboarding/install overlays that may have rendered anyway.
  await page.evaluate(() => {
    document.querySelectorAll('.onboarding-overlay, oikos-install-prompt').forEach((el) => el.remove());
  });
  const closeBtn = page.locator('.modal-close').first();
  if (await closeBtn.count() > 0) {
    try { await closeBtn.click({ timeout: 400 }); } catch {}
  }
}

async function applyAppState(page, dev, theme) {
  // The 90% "zoom" is realised by enlarging the layout viewport (see main()),
  // not via CSS zoom — that keeps the fixed bottom nav at the true frame edge
  // and avoids an empty strip. So nothing scale-related to set here.
  await page.evaluate((theme) => {
    localStorage.setItem('oikos-locale', 'en');
    localStorage.setItem('oikos-onboarded', '1');
    localStorage.setItem('oikos-install-dismissed', String(Date.now()));
    localStorage.setItem('oikos-theme', theme);
    document.documentElement.setAttribute('data-theme', theme);
  }, theme);
}

async function waitForPageLoad(page) {
  try {
    await page.waitForFunction(() => {
      const loading = document.getElementById('app-loading');
      return !loading || loading.hidden || loading.style.display === 'none';
    }, { timeout: 10000 });
  } catch {}
  await wait(1100);
}

// Returns the amount of visible text in the main content area — used to detect empty pages.
async function contentSignal(page) {
  return page.evaluate(() => {
    const main = document.querySelector('main, #app, .app-shell, .page') || document.body;
    const text = (main.innerText || '').replace(/\s+/g, ' ').trim();
    const nodes = main.querySelectorAll('*').length;
    return { len: text.length, nodes };
  });
}

async function login(context, page) {
  const resp = await context.request.post(`${BASE_URL}/api/v1/auth/login`, {
    data: { username: 'alex', password: 'demo1234' },
    headers: { 'Content-Type': 'application/json' },
  });
  if (!resp.ok()) throw new Error(`Login failed: ${resp.status()} ${await resp.text()}`);
  await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded' });
  await wait(2200);
  await waitForPageLoad(page);
  if (page.url().includes('/login') || page.url().includes('/setup')) {
    throw new Error(`Not authenticated, landed on ${page.url()}`);
  }
}

async function captureModule(page, dev, theme, mod) {
  await page.evaluate((path) => {
    if (window.navigate) window.navigate(path);
    else { window.history.pushState({}, '', path); window.dispatchEvent(new PopStateEvent('popstate')); }
  }, mod.path);

  await waitForPageLoad(page);
  await applyAppState(page, dev, theme);
  await dismissOverlays(page);
  await wait(500);

  const sig = await contentSignal(page);
  const empty = sig.len < 40 || sig.nodes < 25;

  // Full-viewport capture. The context viewport/DSF (set in main) are chosen so
  // viewport × DSF == target resolution exactly — no clip, no rescaling.
  const filepath = `${SCREENSHOT_DIR}/${mod.name}-${theme}-${dev.name}.png`;
  await page.screenshot({ path: filepath });

  const flag = empty ? ' ⚠️  LOOKS EMPTY' : '';
  console.log(`  ✓ ${mod.name}-${theme}-${dev.name}.png  (text:${sig.len}, nodes:${sig.nodes})${flag}`);
  return { empty, name: `${mod.name}-${theme}-${dev.name}` };
}

async function main() {
  console.log('Launching browser…');
  const browser = await chromium.launch({ headless: true });
  const warnings = [];

  for (const dev of DEVICES) {
    // Enlarge the layout viewport by 1/zoom so content renders at `zoom` scale
    // (more content, frame-filling). Pick DSF so renderW × DSF == target width,
    // and a render height so renderH × DSF == target height — both exact.
    const renderW = Math.round(dev.viewport.w / dev.zoom);
    const DSF = dev.target.w / renderW;
    const renderH = Math.round(dev.target.h / DSF);

    for (const theme of ['light', 'dark']) {
      console.log(`\n── ${dev.name.toUpperCase()} · ${theme.toUpperCase()}  →  ${dev.target.w}×${dev.target.h} (layout ${renderW}×${renderH}, zoom ${dev.zoom}, DSF ${DSF.toFixed(4)}) ──`);

      const context = await browser.newContext({
        viewport: { width: renderW, height: renderH },
        deviceScaleFactor: DSF,
        userAgent: dev.ua,
        isMobile: dev.isMobile,
        hasTouch: dev.hasTouch,
        locale: dev.locale,
        colorScheme: theme === 'dark' ? 'dark' : 'light',
      });
      await context.addInitScript(initFlags(theme), theme);

      const page = await context.newPage();
      try {
        await login(context, page);
        await applyAppState(page, dev, theme);
        await page.evaluate(async () => { if (window.setLocale) await window.setLocale('en'); });
        await wait(400);

        for (const mod of MODULES) {
          try {
            const res = await captureModule(page, dev, theme, mod);
            if (res.empty) warnings.push(res.name);
          } catch (err) {
            console.error(`  ✗ ${mod.name}-${theme}-${dev.name}: ${err.message}`);
            warnings.push(`${mod.name}-${theme}-${dev.name} (error)`);
          }
        }
      } finally {
        await context.close();
      }
    }
  }

  await browser.close();
  console.log(`\nDone! Screenshots saved to docs/screenshots/`);
  if (warnings.length) {
    console.log(`\n⚠️  ${warnings.length} screenshot(s) may be empty or failed:`);
    for (const w of warnings) console.log(`   - ${w}`);
    process.exitCode = 2;
  } else {
    console.log('All pages rendered content. ✓');
  }
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
