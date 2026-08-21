/**
 * Accessibility gate for Leading with AI.
 *
 *   python3 -m http.server 8765
 *   node tools/a11y-audit.mjs
 *
 * Runs axe-core over every page of both editions, at desktop and at 320px,
 * and fails the build on any critical or serious violation. Book mode means
 * one section is visible at a time, so the audit walks the pager rather than
 * scanning the document once: a violation on page 9 is invisible to a single
 * scan of page 1.
 */
import { chromium } from 'playwright';
import { AxeBuilder } from '@axe-core/playwright';

const BASE = process.env.BASE || 'http://localhost:8765';
const EDITIONS = [
  { name: 'self-paced', url: `${BASE}/` },
  { name: 'classroom', url: `${BASE}/classroom/` },
];
const SECTIONS = ['home', 'mission', 'tools', 'anchors', 'clarity', 'coach', 'decide',
                  'hours', 'guardrails', 'practice', 'check', 'recap', 'sources'];
const VIEWPORTS = [
  { name: '1440x900', width: 1440, height: 900 },
  { name: '320x640', width: 320, height: 640 },
];

const problems = [];
let scans = 0;

// The image ships Chromium at a fixed path that may not match the version this
// Playwright build expects, so point at it directly rather than downloading.
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium',
  args: ['--no-sandbox'],
});

for (const ed of EDITIONS) {
  for (const vp of VIEWPORTS) {
    // axe-core/playwright requires a real context, not browser.newPage()
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
    const page = await ctx.newPage();
    const consoleErrors = [];
    page.on('console', (m) => {
      if (m.type() !== 'error') return;
      const t = m.text();
      if (/TUNNEL|net::|favicon/i.test(t)) return;   // proxy and favicon noise
      consoleErrors.push(t);
    });
    page.on('pageerror', (e) => consoleErrors.push('pageerror: ' + e.message));

    for (const sec of SECTIONS) {
      await page.goto(`${ed.url}#p/${sec}/1`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(120);
      scans++;
      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
        .analyze();
      for (const v of results.violations) {
        if (v.impact !== 'critical' && v.impact !== 'serious') continue;
        problems.push(`${ed.name} ${vp.name} #${sec}: [${v.impact}] ${v.id} - ${v.help} (${v.nodes.length} node(s))\n      ${v.nodes[0]?.target?.join(' ')}`);
      }

      // no sideways scroll at any width, on any page
      const overflow = await page.evaluate(() =>
        document.documentElement.scrollWidth - document.documentElement.clientWidth);
      if (overflow > 1) {
        problems.push(`${ed.name} ${vp.name} #${sec}: page scrolls horizontally by ${overflow}px`);
      }
    }

    if (consoleErrors.length) {
      problems.push(`${ed.name} ${vp.name}: console errors -> ${consoleErrors.slice(0, 3).join(' | ')}`);
    }
    await page.close();
    await ctx.close();
  }
}

// the facilitator runbook is a plain document, so one scan per width is enough
for (const vp of VIEWPORTS) {
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/facilitator/`, { waitUntil: 'networkidle' });
  scans++;
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
  for (const v of results.violations) {
    if (v.impact !== 'critical' && v.impact !== 'serious') continue;
    problems.push(`facilitator ${vp.name}: [${v.impact}] ${v.id} - ${v.help} (${v.nodes.length} node(s))\n      ${v.nodes[0]?.target?.join(' ')}`);
  }
  const overflow = await page.evaluate(() =>
    document.documentElement.scrollWidth - document.documentElement.clientWidth);
  if (overflow > 1) problems.push(`facilitator ${vp.name}: page scrolls horizontally by ${overflow}px`);
  await page.close(); await ctx.close();
}

// 200% zoom: emulated as a half-width viewport at the desktop height
{
  const ctx = await browser.newContext({ viewport: { width: 720, height: 450 } });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/#p/clarity/1`, { waitUntil: 'networkidle' });
  const overflow = await page.evaluate(() =>
    document.documentElement.scrollWidth - document.documentElement.clientWidth);
  if (overflow > 1) problems.push(`200% zoom: page scrolls horizontally by ${overflow}px`);
  await page.close();
  await ctx.close();
}

await browser.close();

console.log(`axe scans run: ${scans}`);
if (problems.length) {
  console.log(`\nA11Y GATE FAILED: ${problems.length} problem(s)\n`);
  problems.forEach((p) => console.log('  - ' + p));
  process.exit(1);
}
console.log('A11Y GATE PASSED: zero critical or serious violations, no horizontal scroll.');
