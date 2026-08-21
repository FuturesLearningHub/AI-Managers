/**
 * Behaviour tests: every interactive module has to round-trip.
 *
 *   python3 -m http.server 8765
 *   node tools/interaction-test.mjs
 */
import { chromium } from 'playwright';

const BASE = process.env.BASE || 'http://localhost:8765';
const fails = [];
const ok = (name) => console.log('  PASS  ' + name);
function check(cond, name, detail) {
  if (cond) return ok(name);
  fails.push(name + (detail ? ' -> ' + detail : ''));
  console.log('  FAIL  ' + name + (detail ? ' -> ' + detail : ''));
}

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium',
  args: ['--no-sandbox'],
});
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error' && !/net::|favicon/i.test(m.text())) errors.push(m.text()); });

console.log('Self-paced edition');
console.log('-'.repeat(72));

// ── cold URL routing ────────────────────────────────────────────────────────
await page.goto(`${BASE}/#p/coach/1`, { waitUntil: 'networkidle' });
check(await page.locator('.page.cur').getAttribute('data-sec') === 'coach',
  'cold URL #p/coach/1 opens the coaching page');

// ── mode: the self-paced build hides the classroom layer ────────────────────
await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
check(await page.getAttribute('body', 'data-mode') === 'web', 'self-paced build opens in mode "web"');
await page.goto(`${BASE}/#p/tools/1`, { waitUntil: 'networkidle' });
check(await page.locator('.page.cur .moment.mode-class').first().isVisible() === false,
  'gold Together cards are absent from the self-paced edition');
check(await page.locator('.page.cur .moment.mode-web').first().isVisible(),
  'the self-paced reflection beats render');
await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
check(await page.locator('.qr-side').isVisible() === false,
  'QR welcome panel is absent from the self-paced edition');

// ── the drill: right answer, wrong answer, verdict wording ──────────────────
await page.goto(`${BASE}/#p/tools/1`, { waitUntil: 'networkidle' });
const q1 = page.locator('[data-drill="tools"]').first();
await q1.locator('.qopt').nth(1).click();      // the correct one
check(await q1.locator('.qz-x').isVisible(), 'drill reveals its reasoning after an answer');
check(/this one/i.test(await q1.locator('.qopt').nth(1).innerText()),
  'a correct option is labelled in words, not colour alone');
const q3 = page.locator('[data-drill="tools"]').nth(2);
await q3.locator('.qopt').first().click();     // a wrong one
check(/not this one/i.test(await q3.locator('.qopt').first().innerText()),
  'a wrong option is labelled in words, not colour alone');
check(/this one/i.test(await q3.locator('.qopt[data-ok="1"]').innerText()),
  'the right answer is revealed alongside a wrong pick');
await page.locator('[data-drill="tools"]').nth(1).locator('.qopt').nth(2).click();
const score = await page.locator('#toolScore').innerText();
check(/of 3/i.test(score), 'the drill reports a running score', score);

// ── the prompt builder: presets fill it, typing updates the preview ─────────
await page.goto(`${BASE}/#p/clarity/1`, { waitUntil: 'networkidle' });
await page.locator('.pb-preset[data-preset="workflow"]').click();
check((await page.locator('#pbRole').inputValue()).length > 10, 'a preset fills the builder fields');
check((await page.locator('#pbcode').innerText()).includes('weekly stand-ups'),
  'the live preview reflects the loaded preset');
check(await page.getAttribute('.pb-preset[data-preset="workflow"]', 'aria-pressed') === 'true',
  'the loaded preset reports its pressed state');
await page.fill('#pbTask', 'Draft the note about Thursday coverage.');
check((await page.locator('#pbcode').innerText()).includes('Thursday coverage'),
  'typing updates the preview');
check((await page.locator('#pbcode').innerText()).includes('Ask me one clarifying question'),
  'the clarifying line is always present');
await page.locator('.pb-preset[data-preset="clear"]').click();
check((await page.locator('#pbRole').inputValue()) === '', 'Clear empties the builder');

// ── the habit picker feeds the prompt block and the recap ───────────────────
await page.goto(`${BASE}/#p/hours/1`, { waitUntil: 'networkidle' });
await page.locator('.hab[data-habit="triage"]').click();
check(await page.getAttribute('.hab[data-habit="triage"]', 'aria-pressed') === 'true',
  'the chosen habit reports its pressed state');
check(/chosen/i.test(await page.locator('.hab[data-habit="triage"] .h-state').innerText()),
  'the chosen habit says so in words');
check((await page.locator('#habcode').innerText()).includes('Cluster them three ways'),
  'the habit prompt loads for the chosen habit');
check((await page.locator('#habNote').innerText()).includes('Friday triage'),
  'the habit note names the choice');
await page.locator('.hab[data-habit="recap"]').click();
check(await page.getAttribute('.hab[data-habit="triage"]', 'aria-pressed') === 'false',
  'choosing another habit releases the first (single choice)');

// ── progress marks, persists, and resets ────────────────────────────────────
await page.goto(`${BASE}/#p/guardrails/1`, { waitUntil: 'networkidle' });
await page.locator('#bbDone').click();
check(await page.getAttribute('#bbDone', 'aria-pressed') === 'true', 'Mark done marks the page');
check(await page.locator('.bb-dot[data-rail="guardrails"]').getAttribute('class') === 'bb-dot done'
   || (await page.getAttribute('.bb-dot[data-rail="guardrails"]', 'class')).includes('done'),
  'the progress rail shows the page as done');
await page.reload({ waitUntil: 'networkidle' });
check((await page.getAttribute('.bb-dot[data-rail="guardrails"]', 'class')).includes('done'),
  'progress survives a reload');
const habitBefore = await page.evaluate(() => localStorage.getItem('leading-habit'));
check(habitBefore === 'recap', 'the habit persists across pages', String(habitBefore));
await page.goto(`${BASE}/#p/sources/1`, { waitUntil: 'networkidle' });
await page.locator('#progReset').click();
check(await page.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith('leading-')).length) === 0,
  'Reset clears every leading-* key');
check(!(await page.getAttribute('.bb-dot[data-rail="guardrails"]', 'class')).includes('done'),
  'Reset clears the progress rail');

// ── keyboard: skip link, page turn, focus lands in the new page ─────────────
await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
await page.keyboard.press('Tab');
check(await page.evaluate(() => document.activeElement?.className) === 'skip',
  'the first Tab reaches the skip link');
await page.locator('#pgNext').click();
await page.waitForTimeout(120);
// Turning from the bottom bar keeps focus on Next (it persists and you may
// press it again), so the page change is announced instead of grabbed.
const announced = await page.locator('#pgAnnounce').innerText();
check(/page 2 of 13/i.test(announced), 'a page turn is announced to assistive tech', announced);
check(await page.evaluate(() => document.activeElement?.id) === 'pgNext',
  'focus stays on the Next control after turning from the bar');
// but focus inside a page must never be stranded in a hidden one
await page.locator('.page.cur a, .page.cur button').first().focus().catch(() => {});
await page.keyboard.press('ArrowRight');
await page.waitForTimeout(200);
check(await page.evaluate(() => {
  const ae = document.activeElement;
  const pg = ae && ae.closest && ae.closest('.page');
  return !pg || pg.classList.contains('cur');
}), 'focus is never stranded inside a page that has been turned away');
check(await page.evaluate(() => {
  const out = [...document.querySelectorAll('.page:not(.cur)')];
  return out.every(p => p.getAttribute('aria-hidden') === 'true');
}), 'every non-current page is aria-hidden');
check(await page.evaluate(() => [...document.querySelectorAll('.page:not(.cur)')].every(p => p.inert === true)),
  'every non-current page is inert, so Tab cannot reach it');

// ── copy button reports back ────────────────────────────────────────────────
await ctx.grantPermissions(['clipboard-read', 'clipboard-write']);
await page.goto(`${BASE}/#p/decide/1`, { waitUntil: 'networkidle' });
await page.locator('.copy-btn[data-copy="d1code"]').click();
await page.waitForTimeout(200);
check((await page.locator('.copy-btn[data-copy="d1code"] span').innerText()).includes('Copied'),
  'the copy button confirms the copy');
const clip = await page.evaluate(() => navigator.clipboard.readText());
check(clip.includes('Three distinct options'), 'the prompt actually reached the clipboard');

// ── the calendar file is generated ──────────────────────────────────────────
await page.goto(`${BASE}/#p/recap/1`, { waitUntil: 'networkidle' });
const dl = page.waitForEvent('download', { timeout: 5000 }).catch(() => null);
await page.locator('#icsBtn').click();
const download = await dl;
check(!!download && download.suggestedFilename().endsWith('.ics'),
  'the two-week check-in downloads as a calendar file',
  download ? download.suggestedFilename() : 'no download');
check(await page.locator('#icsFallback').isVisible() === false,
  'the copy-by-hand fallback stays hidden where the download works');

// where a page cannot hand over a file (an embedded viewer), the control must
// still do something: show the details to copy rather than fail silently
{
  const emb = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const e = await emb.newPage();
  await e.addInitScript(() => { window.claude = {}; });   // stands in for the artifact frame
  await e.goto(`${BASE}/#p/recap/1`, { waitUntil: 'networkidle' });
  await e.locator('#icsBtn').click();
  await e.waitForTimeout(150);
  check(await e.locator('#icsFallback').isVisible(), 'an embedded viewer gets the details to copy instead');
  const txt = await e.locator('#icsText').innerText();
  check(/Leading with AI check-in/.test(txt) && /When:/.test(txt),
    'the copyable details name the event and its time', txt.slice(0, 60));
  await emb.close();
}

// ── reduced motion kills the page-turn animation ────────────────────────────
{
  const rmCtx = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  const rm = await rmCtx.newPage();
  await rm.goto(`${BASE}/`, { waitUntil: 'networkidle' });
  await rm.locator('#pgNext').click();
  const anim = await rm.evaluate(() => {
    const cur = document.querySelector('.page.cur');
    return cur ? getComputedStyle(cur).animationName : 'none';
  });
  check(anim === 'none', 'prefers-reduced-motion stops the page-turn animation', anim);
  const smooth = await rm.evaluate(() => getComputedStyle(document.documentElement).scrollBehavior);
  check(smooth === 'auto', 'prefers-reduced-motion stops smooth scrolling', smooth);
  await rmCtx.close();
}

// ── no-JS fallback: the scroll layout stands ────────────────────────────────
{
  const njCtx = await browser.newContext({ javaScriptEnabled: false });
  const nj = await njCtx.newPage();
  await nj.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
  check(await nj.locator('#sources').isVisible(), 'without JS every section is still readable');
  check(await nj.locator('#clarity').isVisible(), 'without JS the middle of the course is reachable');
  await njCtx.close();
}

console.log('\nClassroom edition');
console.log('-'.repeat(72));
{
  const cCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const c = await cCtx.newPage();
  await c.goto(`${BASE}/classroom/`, { waitUntil: 'networkidle' });
  check(await c.getAttribute('body', 'data-mode') === 'class', 'classroom build opens in mode "class"');
  await c.goto(`${BASE}/classroom/#p/tools/1`, { waitUntil: 'networkidle' });
  check(await c.locator('.page.cur .moment.mode-class').first().isVisible(), 'the gold Together cards render');
  check(await c.locator('.page.cur .moment.mode-web').first().isVisible() === false, 'the self-paced beats are hidden');
  await c.goto(`${BASE}/classroom/`, { waitUntil: 'networkidle' });
  check(await c.locator('.qr-side').isVisible(), 'the QR welcome panel renders');
  check(await c.locator('#qrBox svg').count() > 0, 'the QR code draws client-side');
  await cCtx.close();
}

if (errors.length) {
  fails.push('console/page errors: ' + errors.slice(0, 3).join(' | '));
  console.log('\n  FAIL  console clean -> ' + errors.slice(0, 3).join(' | '));
} else {
  console.log('\n  PASS  console clean across every interaction');
}

await browser.close();
console.log();
if (fails.length) {
  console.log(`INTERACTION TESTS FAILED: ${fails.length}`);
  fails.forEach((f) => console.log('  - ' + f));
  process.exit(1);
}
console.log('INTERACTION TESTS PASSED.');
