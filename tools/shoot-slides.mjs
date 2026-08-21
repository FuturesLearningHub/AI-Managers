/**
 * Capture one image per course page for the printable facilitator guide.
 *
 *   python3 -m http.server 8765
 *   node tools/shoot-slides.mjs
 *
 * Shoots the CLASSROOM edition (what learners actually see in the room), not
 * the facilitator edition, so the guide pictures the page without the rail
 * over it. Re-shoot after any visual change to the course.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';

const BASE = process.env.BASE || 'http://localhost:8765';
const OUT = 'facilitator/img';
const KEYS = ['home', 'mission', 'tools', 'anchors', 'clarity', 'coach', 'decide',
              'hours', 'guardrails', 'practice', 'check', 'recap', 'sources'];

fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium',
  args: ['--no-sandbox'],
});
const ctx = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  reducedMotion: 'reduce',
  deviceScaleFactor: 1,
});
const page = await ctx.newPage();
// the bottom bar and the scroll pill are chrome, not content
await page.addStyleTag({ content: '.book-bar,#pgMore{display:none !important}' }).catch(() => {});

for (const k of KEYS) {
  await page.goto(`${BASE}/classroom/#p/${k}/1`, { waitUntil: 'networkidle' });
  await page.addStyleTag({ content: '.book-bar,#pgMore{display:none !important}' });
  await page.waitForTimeout(250);
  const el = page.locator('.page.cur');
  await el.screenshot({ path: `${OUT}/${k}.jpg`, type: 'jpeg', quality: 68 });
  process.stdout.write(`${k} `);
}
await browser.close();
const total = KEYS.reduce((n, k) => n + fs.statSync(`${OUT}/${k}.jpg`).size, 0);
console.log(`\n${KEYS.length} images, ${(total / 1024).toFixed(0)} KB total, in ${OUT}/`);
