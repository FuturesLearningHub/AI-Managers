/**
 * Hero montage behaviour tests.
 *
 *   python3 -m http.server 8765
 *   node tools/hero-montage-test.mjs
 *
 * The real clips are H.264 on the CDN, which the bundled test Chromium cannot
 * decode and this container cannot reach, so the suite substitutes tiny local
 * VP9 stubs (tools/stubs/) into a copy of the built page and tests the
 * player's behaviour: fade-in, crossfade, the pause chip, page-turn and
 * reduced-motion handling, and every failure path standing down cleanly.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';

// build a test copy of the self-paced page with the stub clips wired in
let html = fs.readFileSync('index.html', 'utf8');
// build.py leaves empty strings when no CDN urls are configured; swap them for the stubs
const before = html;
html = html.replace(/var HERO_POSTER = '[^']*';/, "var HERO_POSTER = 'http://localhost:8765/assets/img/favicon-96.png';")
  .replace(/var HERO_CLIPS = \[[^\]]*\];/,
    "var HERO_CLIPS = ['http://localhost:8765/tools/stubs/stub1.webm','http://localhost:8765/tools/stubs/stub2.webm','http://localhost:8765/tools/stubs/stub3.webm'];");
if (html === before) { console.error('FATAL: stub substitution matched nothing'); process.exit(2); }
// the js gates on /^https:/ — widen to http for the local stub test only
html = html.replace('var configured = HERO_CLIPS.filter(function(u){ return /^https:/.test(u); });',
                    'var configured = HERO_CLIPS.filter(function(u){ return /^https?:/.test(u); });')
           .replace("if(posterEl && /^https:/.test(HERO_POSTER)){", "if(posterEl && /^https?:/.test(HERO_POSTER)){");
fs.writeFileSync('_hv.html', html);

const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
const errs = [];
p.on('pageerror', e => errs.push(e.message));
const seen = [];
const ck = (c, n, d) => seen.push((c ? 'PASS  ' : 'FAIL  ') + n + (!c && d ? ' -> ' + d : ''));

await p.goto('http://localhost:8765/_hv.html', { waitUntil: 'networkidle' });
await p.waitForTimeout(1500);
ck(await p.locator('#heroVidA').evaluate(v => v.classList.contains('hv-on')), 'clip 1 fades in once it can play');
ck(await p.locator('#heroVidA').evaluate(v => !v.paused), 'clip 1 is playing');
ck(await p.locator('#hvToggle').isVisible(), 'the pause chip appears once something moves');
// the poster must never ghost under a playing clip, even when its image
// finishes loading after the video starts
await p.evaluate(() => {
  const img = document.getElementById('heroPoster');
  img.dispatchEvent(new Event('load'));   // simulate a late-arriving poster
});
ck(await p.locator('#heroPoster').evaluate(el => el.hidden && !el.classList.contains('hv-on')),
  'a late-loading poster cannot ghost under the playing video');
ck(await p.locator('#heroVidA').evaluate(v => v.muted), 'the video is muted');

// crossfade: 4s stubs -> layer B takes over; poll rather than race the timer
const handed = await p.waitForFunction(() =>
  document.getElementById('heroVidB').classList.contains('hv-on'), null, { timeout: 9000 }).then(() => true, () => false);
ck(handed, 'crossfade hands off to layer B');
ck((await p.locator('#heroVidB').evaluate(v => v.currentSrc)).includes('stub2'), 'layer B carries clip 2');

// pause control
await p.locator('#hvToggle').click();
await p.waitForTimeout(300);
ck(await p.evaluate(() => document.getElementById('heroVidA').paused && document.getElementById('heroVidB').paused),
   'the pause chip pauses every layer');
ck(await p.getAttribute('#hvToggle', 'aria-pressed') === 'true', 'the chip reports its pressed state');
await p.locator('#hvToggle').click();
await p.waitForTimeout(400);
ck(await p.evaluate(() => { const v = document.querySelector('.hero-video.hv-on'); return v && !v.paused; }),
   'the chip resumes the montage');

// page turn pauses; returning resumes
await p.locator('#pgNext').click();
await p.waitForTimeout(600);
ck(await p.evaluate(() => document.getElementById('heroVidA').paused && document.getElementById('heroVidB').paused),
   'leaving the welcome page pauses the montage');
await p.locator('#pgPrev').click();
await p.waitForTimeout(700);
ck(await p.evaluate(() => { const v = document.querySelector('.hero-video.hv-on'); return v && !v.paused; }),
   'returning to the welcome page resumes it');

// reduced motion: video never starts, poster may stand
{
  const rc = await b.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  const r = await rc.newPage();
  await r.goto('http://localhost:8765/_hv.html', { waitUntil: 'networkidle' });
  await r.waitForTimeout(1200);
  ck(await r.locator('#heroVidA').evaluate(v => !v.src), 'reduced motion never fetches a clip');
  ck(await r.locator('#hvToggle').isHidden(), 'reduced motion hides the pause chip');
  await rc.close();
}

// unreachable CDN: the real build's https URLs will fail in the container;
// simulate with a dead URL and confirm the hero stands clean
{
  let dead = fs.readFileSync('_hv.html', 'utf8')
    .replace(/http:\/\/localhost:8765\/tools\/stubs\/stub[123]\.webm/g, 'https://localhost:1/nope.mp4')
    .replace("'http://localhost:8765/assets/img/favicon-96.png'", "'https://localhost:1/nope.png'");
  fs.writeFileSync('_hv-dead.html', dead);
  const d = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  const derr = [];
  d.on('pageerror', e => derr.push(e.message));
  await d.goto('http://localhost:8765/_hv-dead.html', { waitUntil: 'networkidle' });
  await d.waitForTimeout(1500);
  ck(await d.locator('.hero-video.hv-on').count() === 0, 'a dead CDN shows no video layer');
  ck(await d.locator('#hvToggle').isHidden(), 'a dead CDN keeps the pause chip hidden');
  const bg = await d.evaluate(() => getComputedStyle(document.querySelector('.hero')).backgroundColor);
  ck(bg === 'rgb(28, 28, 28)', 'the black hero ground stands untouched');
  ck(derr.length === 0, 'no script errors on the dead-CDN path', derr[0]);
  await d.close();
}

// inert tokens (unhosted build): no fetch, no errors
{
  const i = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  const ierr = [];
  i.on('pageerror', e => ierr.push(e.message));
  await i.goto('http://localhost:8765/', { waitUntil: 'networkidle' });
  await i.waitForTimeout(800);
  await i.waitForTimeout(1200);
  ck(await i.locator('.hero-video.hv-on').count() === 0,
    'the live build with an unreachable CDN shows no half-loaded layer');
  ck(ierr.length === 0, 'the live build has no script errors when the CDN is unreachable', ierr[0]);
  await i.close();
}

ck(errs.length === 0, 'console clean through the whole montage', errs[0]);
await b.close();
seen.forEach(s => console.log('  ' + s));
process.exit(seen.some(s => s.startsWith('FAIL')) ? 1 : 0);
