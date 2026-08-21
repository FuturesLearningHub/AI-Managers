(function(){
'use strict';
var yr = document.getElementById('yr'); if(yr) yr.textContent = new Date().getFullYear();

/* ══════════ storage: one guarded handle, one prefix ══════════
   Everything this course remembers is a leading-* key in this browser's
   localStorage. Private windows and blocked-storage settings throw on the
   first write, so the handle is probed once and every read falls back to an
   in-memory object. Nothing is ever sent anywhere. */
var K = 'leading-';
var mem = {};
var store = (function(){
  try{
    var t = K + 'probe';
    window.localStorage.setItem(t, '1');
    window.localStorage.removeItem(t);
    return window.localStorage;
  }catch(e){ return null; }
})();
function getVal(k){
  if(store){ try{ var v = store.getItem(K + k); if(v !== null) return v; }catch(e){} }
  return (k in mem) ? mem[k] : null;
}
function setVal(k, v){
  if(v === null || v === ''){ delete mem[k]; if(store){ try{ store.removeItem(K + k); }catch(e){} } return; }
  mem[k] = v;
  if(store){ try{ store.setItem(K + k, v); }catch(e){} }
}

/* ══════════ QR: encodes the hosted URL, drawn client-side (no network) ══════════ */
var qrBox = document.getElementById('qrBox');
if(qrBox && typeof qrcode === 'function'){
  var qrCard = document.getElementById('qrCard');
  var qrTarget = (qrCard && qrCard.getAttribute('data-url')) ||
    (location.protocol === 'file:' ? '' : location.origin + location.pathname);
  var qrUrlEl = document.getElementById('qrUrl');
  if(qrTarget){
    try{
      var qr = qrcode(0, 'M');
      qr.addData(qrTarget);
      qr.make();
      qrBox.innerHTML = qr.createSvgTag({ scalable:true, margin:2 });
      if(qrUrlEl) qrUrlEl.textContent = qrTarget.replace(/^https?:\/\//, '').replace(/\/$/, '');
    }catch(err){
      if(qrBox.parentElement) qrBox.parentElement.style.display = 'none';
    }
  } else {
    if(qrUrlEl) qrUrlEl.textContent = 'QR appears when the site is hosted';
    qrBox.innerHTML = '<div style="width:100%;aspect-ratio:1;display:grid;place-items:center;border:1px dashed #E4E4E4;color:#555;font-family:Inter,Arial,sans-serif;font-size:.8rem;padding:1rem;text-align:center">Deploy to generate the QR code</div>';
  }
}

/* ══════════ hero ambient montage ══════════
   Three clips crossfade on two <video> layers, Working Smarter style. The
   montage is strictly progressive enhancement: it waits for the first clip's
   canplay before showing anything, so an unreachable CDN (an embedded viewer,
   an offline room) leaves the black hero exactly as designed. Reduced motion
   shows the still instead. The pause chip satisfies WCAG 2.2.2 and appears
   only once something is actually moving. */
var HERO_POSTER = '__HERO_POSTER__';
var HERO_CLIPS = [
  '__HERO_CLIP_1__',
  '__HERO_CLIP_2__',
  '__HERO_CLIP_3__'
];
(function(){
  var A = document.getElementById('heroVidA'), B = document.getElementById('heroVidB');
  var posterEl = document.getElementById('heroPoster');
  var toggle = document.getElementById('hvToggle'), toggleT = document.getElementById('hvToggleT');
  var icPause = document.getElementById('hvIcPause'), icPlay = document.getElementById('hvIcPlay');
  if(!A || !B) return;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var configured = HERO_CLIPS.filter(function(u){ return /^https:/.test(u); });
  if(posterEl && /^https:/.test(HERO_POSTER)){
    posterEl.src = HERO_POSTER;
    posterEl.hidden = false;
    posterEl.addEventListener('load', function(){ posterEl.classList.add('hv-on'); });
  }
  if(reduce || !configured.length) return;   /* the still (or nothing) stands */

  var layers = [A, B];
  var clip = 0;          /* index into configured of the clip now playing */
  var active = 0;        /* which layer is on top */
  var started = false, userPaused = false, pageVisible = true, fadeT = null;

  function src(i){ return configured[i % configured.length]; }
  function label(playing){
    if(toggleT) toggleT.textContent = playing ? 'Pause the background video' : 'Play the background video';
    if(toggle){
      toggle.setAttribute('aria-pressed', playing ? 'false' : 'true');
      toggle.setAttribute('aria-label', playing ? 'Pause the background video' : 'Play the background video');
    }
    if(icPause){ if(playing) icPause.removeAttribute('hidden'); else icPause.setAttribute('hidden',''); }
    if(icPlay){ if(playing) icPlay.setAttribute('hidden',''); else icPlay.removeAttribute('hidden'); }
  }
  function playSafe(v){ var pr = v.play(); if(pr && pr.catch) pr.catch(function(){}); }
  function shouldRun(){ return started && !userPaused && pageVisible; }
  function syncPlayback(){
    if(shouldRun()){ playSafe(layers[active]); }
    else { layers.forEach(function(v){ try{ v.pause(); }catch(e){} }); }
  }

  /* crossfade to the next clip when the current one is nearly done */
  function arm(v){
    v.addEventListener('timeupdate', function(){
      if(v !== layers[active] || !shouldRun()) return;
      if(!v.duration || v.duration - v.currentTime > 1.6) return;
      var next = layers[1 - active];
      if(next.getAttribute('data-clip') !== String(clip + 1)){
        next.setAttribute('data-clip', String(clip + 1));
        next.src = src(clip + 1);
        next.load();
      }
      if(next.readyState >= 3 && !next.classList.contains('hv-on')){
        clip += 1; active = 1 - active;
        next.currentTime = 0;
        playSafe(next);
        next.classList.add('hv-on');
        v.classList.remove('hv-on');
        if(fadeT) window.clearTimeout(fadeT);
        fadeT = window.setTimeout(function(){ try{ v.pause(); }catch(e){} }, 1900);
      }
    });
    /* a clip that dies mid-montage ends the show quietly; the poster stands */
    v.addEventListener('error', function(){
      if(!started && v === A){ if(toggle) toggle.hidden = true; }
      v.classList.remove('hv-on');
    });
  }
  layers.forEach(arm);

  /* boot: nothing is fetched until the hero is the visible page */
  var booted = false;
  function boot(){
    if(booted) return;
    booted = true;
    A.setAttribute('data-clip', '0');
    A.preload = 'auto';
    A.src = src(0);
    A.load();
    A.addEventListener('canplay', function onc(){
      A.removeEventListener('canplay', onc);
      started = true;
      A.classList.add('hv-on');
      if(posterEl) posterEl.classList.remove('hv-on');
      if(toggle) toggle.hidden = false;
      label(true);
      syncPlayback();
      /* warm the second clip once the first is safely up */
      B.preload = 'auto';
      B.setAttribute('data-clip', '1');
      B.src = src(1);
      B.load();
    });
  }

  /* the montage runs only while the welcome page is the current page */
  function onPage(){
    var cur = (window.leadPager && window.leadPager.current) ? window.leadPager.current().key : 'home';
    pageVisible = (cur === 'home') && !document.hidden;
    if(pageVisible) boot();
    syncPlayback();
  }
  document.addEventListener('lead:page', onPage);
  document.addEventListener('visibilitychange', onPage);
  onPage();

  if(toggle) toggle.addEventListener('click', function(){
    userPaused = !userPaused;
    label(!userPaused);
    syncPlayback();
  });
})();

/* ══════════ nav shade + mobile menu ══════════ */
var nav = document.getElementById('nav');
function navShade(idx){ if(nav) nav.classList.toggle('scrolled', idx > 0); }
document.addEventListener('lead:page', function(ev){ navShade(ev.detail ? ev.detail.index : 0); });
if(window.leadPager) navShade(window.leadPager.current().index);

var menuBtn = document.getElementById('menuBtn'), mobileMenu = document.getElementById('mobileMenu');
function setMenu(open){
  var wasOpen = document.body.classList.contains('menu-open');
  document.body.classList.toggle('menu-open', open);
  if(menuBtn){ menuBtn.setAttribute('aria-expanded', open?'true':'false'); menuBtn.setAttribute('aria-label', open?'Close menu':'Open menu'); }
  if(open && mobileMenu){
    var first = mobileMenu.querySelector('a');
    if(first) first.focus();
  } else if(wasOpen && !open && menuBtn){
    menuBtn.focus();
  }
}
if(menuBtn) menuBtn.addEventListener('click', function(){ setMenu(!document.body.classList.contains('menu-open')); });
if(mobileMenu) mobileMenu.addEventListener('click', function(e){ if(e.target.closest('a')) setMenu(false); });
document.addEventListener('keydown', function(e){ if(e.key==='Escape') setMenu(false); });
/* trap Tab inside the open mobile menu */
document.addEventListener('keydown', function(e){
  if(e.key !== 'Tab' || !document.body.classList.contains('menu-open') || !mobileMenu) return;
  var items = Array.prototype.slice.call(mobileMenu.querySelectorAll('a'));
  if(menuBtn) items.unshift(menuBtn);
  if(!items.length) return;
  var first = items[0], last = items[items.length - 1];
  var active = document.activeElement, idx = items.indexOf(active);
  if(idx === -1){ e.preventDefault(); first.focus(); }
  else if(e.shiftKey && active === first){ e.preventDefault(); last.focus(); }
  else if(!e.shiftKey && active === last){ e.preventDefault(); first.focus(); }
});

/* ══════════ MODE: classroom vs self-paced ══════════
   Each edition ships with its own default (DEFAULT_MODE, written by the
   build). body[data-mode] decides which .mode-* blocks render, on screen and
   in the print takeaway. The bottom-bar switch exists so a learner who lands
   on the wrong edition is never stuck with the wrong instructions. */
var modeMem = DEFAULT_MODE;
function modeGet(){
  var v = getVal('mode-locked');
  return (v === 'class' || v === 'web') ? v : modeMem;
}
function modeSet(v){
  modeMem = (v === 'class') ? 'class' : 'web';
  setVal('mode-locked', modeMem);
  modeRender();
}
var bbModeBtn = document.getElementById('bbMode'), bbModeT = document.getElementById('bbModeT'),
    bbModeIcC = document.getElementById('bbModeIcClass'), bbModeIcW = document.getElementById('bbModeIcWeb');
function modeRender(){
  var m = modeGet();
  document.body.setAttribute('data-mode', m);
  if(bbModeT) bbModeT.textContent = m === 'class' ? 'Mode: class' : 'Mode: solo';
  /* attribute, not property: SVGElement has no .hidden IDL, so the property would be an inert expando */
  if(bbModeIcC){ if(m === 'class') bbModeIcC.removeAttribute('hidden'); else bbModeIcC.setAttribute('hidden',''); }
  if(bbModeIcW){ if(m === 'web') bbModeIcW.removeAttribute('hidden'); else bbModeIcW.setAttribute('hidden',''); }
  if(bbModeBtn){
    bbModeBtn.setAttribute('aria-label', m === 'class'
      ? 'Mode: in a classroom. Select to switch to self-paced.'
      : 'Mode: self-paced. Select to switch to classroom.');
    bbModeBtn.setAttribute('title', m === 'class' ? 'Switch to self-paced' : 'Switch to classroom');
  }
}
if(bbModeBtn) bbModeBtn.addEventListener('click', function(){ modeSet(modeGet() === 'class' ? 'web' : 'class'); });

/* ══════════ the prompt builder ══════════
   Two instances of the same five-field builder: one in Module 02 loaded from
   worked scenarios, one in Practice for the learner's own message. Each keeps
   a live <pre> preview in step with the fields, persists what was typed, and
   feeds the print takeaway. The Interview-style clarifying line is fixed, so
   it is printed rather than typed and can never be edited away by accident. */
var CLARIFY = 'Ask me one clarifying question before you draft.';
var FIELDS = ['Role', 'Context', 'Task', 'Constraints', 'Format'];

function Builder(prefix, preId){
  var self = this;
  this.prefix = prefix;
  this.pre = document.getElementById(preId);
  this.els = {};
  FIELDS.forEach(function(f){
    var el = document.getElementById(prefix + f);
    if(!el) return;
    self.els[f] = el;
    var saved = getVal(prefix + '-' + f.toLowerCase());
    if(saved) el.value = saved;
    el.addEventListener('input', function(){
      setVal(prefix + '-' + f.toLowerCase(), el.value.trim() ? el.value : null);
      self.render();
      if(self.onInput) self.onInput();
    });
  });
  this.render();
}
Builder.prototype.text = function(){
  var self = this;
  var lines = FIELDS.map(function(f){
    var el = self.els[f];
    var v = el && el.value.trim();
    return f + ': ' + (v || '___');
  });
  return lines.join('\n') + '\n\n' + CLARIFY;
};
Builder.prototype.filled = function(){
  var self = this;
  return FIELDS.every(function(f){ var el = self.els[f]; return el && el.value.trim(); });
};
Builder.prototype.touched = function(){
  var self = this;
  return FIELDS.some(function(f){ var el = self.els[f]; return el && el.value.trim(); });
};
Builder.prototype.set = function(values){
  var self = this;
  FIELDS.forEach(function(f){
    var el = self.els[f];
    if(!el) return;
    el.value = values && values[f] ? values[f] : '';
    setVal(self.prefix + '-' + f.toLowerCase(), el.value || null);
  });
  this.render();
};
Builder.prototype.render = function(){ if(this.pre) this.pre.textContent = this.text(); };

var pb = new Builder('pb', 'pbcode');   /* Module 02, with presets */
var pr = new Builder('pr', 'prcode');   /* Practice, the learner's own */

/* the three worked scenarios behind the Module 02 preset buttons */
var PRESETS = {
  workflow: {
    Role: 'You are helping a manager at a large research university.',
    Context: 'A team of eight who have asked for fewer meetings, about to be told there will be one more. They are already stretched and this will land as one more demand unless the reason is clear.',
    Task: 'Draft an email announcing a shift to weekly stand-ups, and say plainly what it replaces and what it means for their week.',
    Constraints: 'Warm but direct. Under 120 words. No jargon. Do not invent policy. Name what this replaces.',
    Format: 'Email with a subject line.'
  },
  hard: {
    Role: 'You are helping a manager prepare for a difficult conversation. You are not writing the conversation.',
    Context: 'A direct report, described by role only, has missed three deadlines this month. Their work was strong before this. I do not know yet what changed, and I want to find out before I decide anything.',
    Task: 'Help me prepare. Give me an opening, three curious questions, and one boundary I need to state clearly.',
    Constraints: 'Do not script what they should say. Do not assume the cause. Nothing that sounds rehearsed.',
    Format: 'Opening, then the three questions as a list, then the boundary in one sentence.'
  },
  upward: {
    Role: 'You are a skeptical director reading a one-page memo from someone who reports to you.',
    Context: 'I need a decision from my director about adding evening coverage. They have about four minutes and they will want the recommendation first.',
    Task: 'Turn the bullets I paste below into a one-page memo. Lead with the recommendation, then the reasoning, then one risk and one open question.',
    Constraints: 'Under 400 words. No throat-clearing. Do not invent numbers I have not given you.',
    Format: 'One page: recommendation, reasoning, risk, open question.'
  }
};
var presetBtns = document.querySelectorAll('.pb-preset');
function presetSync(name){
  presetBtns.forEach(function(b){
    b.setAttribute('aria-pressed', b.getAttribute('data-preset') === name ? 'true' : 'false');
  });
}
presetBtns.forEach(function(b){
  b.addEventListener('click', function(){
    var name = b.getAttribute('data-preset');
    if(name === 'clear'){ pb.set(null); presetSync(null); }
    else { pb.set(PRESETS[name]); presetSync(name); }
    progAuto('clarity');
    /* the preview is what changed, so send focus there rather than leaving it
       on a button whose pressed state no longer describes the page */
    if(pb.pre){ pb.pre.setAttribute('tabindex', '-1'); pb.pre.focus(); }
  });
});

/* ══════════ Module 05: the habit picker ══════════
   A single-choice toggle group. The chosen habit drives the prompt block on
   the page, the line in the recap, the printed takeaway, and the wording of
   the calendar reminder. */
var HABITS = {
  recap: {
    name: 'The ten-minute meeting recap',
    when: 'after every meeting that has a transcript, within the hour',
    tool: 'Copilot in Teams, or the Amplify note-taker',
    prompt: 'Here is the transcript from the meeting that just ended.\n\nGive me:\n1. A five-bullet recap.\n2. A decisions list: what we actually decided, not what we discussed.\n3. An action-item table with owners and due dates.\n\nFlag anything ambiguous as a question rather than inventing an action or an owner.\nKeep it short enough to read on a phone.'
  },
  triage: {
    name: 'The Friday triage',
    when: 'Friday afternoon, before you close the laptop',
    tool: 'the Amplify email assistant, or Copilot in Outlook',
    prompt: 'Here are my top ten unresolved email threads.\n\nCluster them three ways:\n1. Decision needed from me.\n2. Information needed from someone else.\n3. Can be closed today.\n\nFor everything in group 3, draft a one-line reply I can send as it is.\nFor group 1, tell me what decision each one is actually asking for.'
  },
  synthesis: {
    name: 'The weekly synthesis',
    when: 'once a week, at the end of the week',
    tool: 'Amplify, or ChatGPT EDU only if nothing internal is involved',
    prompt: 'Here is my calendar for last week, my notes, and my top three priorities.\n\nTell me:\n1. What I am overspending time on relative to those three priorities.\n2. What to cut, what to delegate, and what to batch next week.\n3. Anything on the calendar that no longer connects to a priority at all.\n\nBe specific about which meetings. Do not soften it.'
  }
};
var habBtns = document.querySelectorAll('.hab');
var habNote = document.getElementById('habNote');
var habPre = document.getElementById('habcode');
var habLabel = document.getElementById('habPromptLabel');
var recapHabit = document.getElementById('recapHabit');

function habitRender(){
  var key = getVal('habit');
  var h = key && HABITS[key];
  habBtns.forEach(function(b){
    var on = b.getAttribute('data-habit') === key;
    b.setAttribute('aria-pressed', on ? 'true' : 'false');
    var state = b.querySelector('.h-state');
    if(state) state.textContent = on ? 'Chosen' : 'Choose this one';
  });
  if(habNote){
    habNote.innerHTML = h
      ? 'You chose <b>' + h.name + '</b>, ' + h.when + ', using ' + h.tool + '. It is on your printed takeaway and in the calendar reminder at the end.'
      : 'No habit chosen yet. <b>Pick the one that fits the week you actually have</b>, and it will appear on your printed takeaway and in the calendar reminder at the end.';
  }
  if(habPre) habPre.textContent = h ? h.prompt : 'Choose a habit above and its prompt appears here, ready to copy.';
  if(habLabel) habLabel.textContent = h ? ('The prompt for ' + h.name.replace(/^The /, 'the ')) : 'The prompt for your habit';
  if(recapHabit){
    recapHabit.textContent = h
      ? ('You chose ' + h.name + ', ' + h.when + '.')
      : 'Pick one in Module 05 if you have not yet.';
  }
}
habBtns.forEach(function(b){
  b.addEventListener('click', function(){
    var key = b.getAttribute('data-habit');
    setVal('habit', getVal('habit') === key ? null : key);
    habitRender();
    if(getVal('habit')) progAuto('hours');
  });
});

/* the self-paced commitment note, printed on the takeaway */
var cfNote = document.getElementById('cfNote');
if(cfNote){
  var savedNote = getVal('note');
  if(savedNote) cfNote.value = savedNote;
  cfNote.addEventListener('input', function(){
    setVal('note', cfNote.value.trim() ? cfNote.value : null);
    if(cfNote.value.trim()) progAuto('hours');
  });
}

/* ══════════ drills and the knowledge check ══════════
   One engine for every [data-q] block. The verdict is injected as real text
   ("This one" / "Not this one") rather than carried by border color alone,
   because the approved palette has no red and because color is never the
   only channel. The explanation is a role="status" region, so a screen
   reader hears it the moment it appears. */
function verdict(btn, ok){
  var mark = btn.querySelector('.qmark');
  if(!mark){
    mark = document.createElement('span');
    mark.className = 'qmark';
    btn.appendChild(mark);
  }
  mark.textContent = ok ? 'This one' : 'Not this one';
}
function clearVerdict(btn){
  var mark = btn.querySelector('.qmark');
  if(mark) mark.remove();
}
var SCORE_BOX = { tools:'toolScore', anchors:'anchorScore', coach:'coachScore', decide:'decideScore' };
function scoreGroup(sel, boxId, noun){
  var qs = document.querySelectorAll(sel);
  if(!qs.length) return;
  var box = document.getElementById(boxId);
  if(!box) return;
  var answered = 0, right = 0;
  qs.forEach(function(q){
    if(q.getAttribute('data-answered') !== '1') return;
    answered++;
    if(q.getAttribute('data-right') === '1') right++;
  });
  if(!answered){ box.hidden = true; return; }
  box.hidden = false;
  box.textContent = answered < qs.length
    ? (answered + ' of ' + qs.length + ' ' + noun + ' answered')
    : (right + ' of ' + qs.length + ' right on the first try. ' +
       (right === qs.length ? 'Nothing here should surprise you now.' : 'Read the reasoning under any you missed; that is where the course actually lands.'));
}
document.querySelectorAll('[data-q]').forEach(function(q){
  var opts = q.querySelectorAll('.qopt'), x = q.querySelector('.qz-x');
  opts.forEach(function(o){
    o.addEventListener('click', function(){
      var firstTry = q.getAttribute('data-answered') !== '1';
      var ok = o.getAttribute('data-ok') === '1';
      opts.forEach(function(b){ b.classList.remove('ok','no'); clearVerdict(b); });
      if(ok){ o.classList.add('ok'); verdict(o, true); }
      else{
        o.classList.add('no');
        verdict(o, false);
        q.querySelectorAll('.qopt[data-ok="1"]').forEach(function(c){ c.classList.add('ok'); verdict(c, true); });
      }
      if(x) x.hidden = false;
      if(firstTry){
        q.setAttribute('data-answered', '1');
        q.setAttribute('data-right', ok ? '1' : '0');
      }
      var drill = q.getAttribute('data-drill');
      if(drill && SCORE_BOX[drill]) scoreGroup('[data-drill="' + drill + '"]', SCORE_BOX[drill], 'cases');
      if(q.hasAttribute('data-check')){
        scoreGroup('[data-check]', 'checkScore', 'questions');
        var all = Array.prototype.every.call(document.querySelectorAll('[data-check]'), function(z){
          return z.getAttribute('data-answered') === '1';
        });
        if(all) progAuto('check');
      }
      /* a completed drill completes its module page */
      if(drill){
        var done = Array.prototype.every.call(document.querySelectorAll('[data-drill="' + drill + '"]'), function(z){
          return z.getAttribute('data-answered') === '1';
        });
        if(done) progAuto(drill === 'tools' ? 'tools' : drill);
      }
    });
  });
});

/* ══════════ print takeaway: carries what the learner typed and chose ══════════ */
function fillPrint(){
  var pp = document.getElementById('psPrompt');
  if(pp){
    pp.textContent = pr.touched() ? pr.text() :
      'Role: _________________________________________________________________\n' +
      'Context: ______________________________________________________________\n' +
      'Task: _________________________________________________________________\n' +
      'Constraints: __________________________________________________________\n' +
      'Format: _______________________________________________________________\n\n' + CLARIFY;
  }
  var ph = document.getElementById('psHabit');
  if(ph){
    var key = getVal('habit'), h = key && HABITS[key];
    ph.textContent = h
      ? (h.name + ', ' + h.when + ', using ' + h.tool + '.\n\n' + h.prompt)
      : 'No habit chosen yet. Pick one of the three: the ten-minute meeting recap, the Friday triage, or the weekly synthesis.';
  }
  var pn = document.getElementById('psNote');
  if(pn){
    var note = cfNote && cfNote.value.trim();
    if(note){ pn.textContent = '“' + note + '”'; pn.removeAttribute('hidden'); }
    else { pn.textContent = ''; pn.setAttribute('hidden',''); }
  }
}
window.addEventListener('beforeprint', fillPrint);
document.querySelectorAll('.print-btn').forEach(function(b){
  b.addEventListener('click', function(){ fillPrint(); window.print(); });
});

/* ══════════ the two-week check-in, as a calendar file ══════════ */
var icsBtn = document.getElementById('icsBtn');
function icsParts(){
  function pad(n){ return (n < 10 ? '0' : '') + n; }
  function f(t){ return t.getFullYear() + pad(t.getMonth() + 1) + pad(t.getDate()) + 'T' + pad(t.getHours()) + pad(t.getMinutes()) + '00'; }
  var d = new Date(Date.now() + 14 * 86400000); d.setHours(8, 30, 0, 0);
  var e = new Date(d.getTime() + 15 * 60000);
  var key = getVal('habit'), h = key && HABITS[key];
  var line = h ? ('Your habit was ' + h.name + ', ' + h.when + '. Did it stick?')
               : 'You had not picked a habit yet. Pick one now: meeting recap, Friday triage, or weekly synthesis.';
  var summary = 'Leading with AI check-in: did the habit stick?';
  /* [EDIT · SCORM] swap the refresher URL below for the LMS course link */
  var desc = 'Two weeks since the Leading with AI course. ' + line +
    ' Second question: does every draft still sound like you? Refresher: ' + COURSE_URL;
  var ics = 'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//CHARTProgram//LeadingWithAI//EN\r\nBEGIN:VEVENT\r\nUID:chart-leading-' + d.getTime() + '@vanderbilt\r\n' +
    'DTSTAMP:' + f(new Date()) + '\r\nDTSTART:' + f(d) + '\r\nDTEND:' + f(e) + '\r\n' +
    'SUMMARY:' + summary + '\r\nDESCRIPTION:' + desc + '\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n';
  return { start:d, end:e, summary:summary, desc:desc, ics:ics };
}
/* An embedded viewer (the published-artifact frame, some LMS players) will not
   let a page hand over a file, and the click would silently do nothing. Where
   that is the case the details are shown to copy instead, so the control
   always does something the learner can act on. */
function canHandOverFiles(){
  try{
    if(window.claude) return false;              /* artifact viewer */
    if(window.top !== window.self) return false; /* embedded in a frame */
  }catch(e){ return false; }                     /* cross-origin frame */
  return typeof Blob === 'function' && typeof URL !== 'undefined' && !!URL.createObjectURL;
}
if(icsBtn) icsBtn.addEventListener('click', function(){
  var p = icsParts();
  progAuto('recap');
  if(!canHandOverFiles()){
    var box = document.getElementById('icsFallback'), pre = document.getElementById('icsText');
    if(pre){
      pre.textContent = 'What: ' + p.summary + '\n' +
        'When: ' + p.start.toLocaleString() + ', 15 minutes\n\n' + p.desc;
    }
    if(box){
      box.hidden = false;
      box.setAttribute('tabindex', '-1');
      box.focus();
    }
    return;
  }
  var blob = new Blob([p.ics], { type:'text/calendar' });
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = 'chart-leading-with-ai-checkin.ics';
  document.body.appendChild(a); a.click();
  setTimeout(function(){ URL.revokeObjectURL(a.href); a.remove(); }, 500);
});

/* ══════════ bottom-bar appendix jump ══════════ */
var bbAppx = document.getElementById('bbAppx');
if(bbAppx) bbAppx.addEventListener('click', function(){ window.location.hash = 'p/sources/1'; });

/* ══════════ copy buttons (clipboard, with fallback) ══════════ */
function copyText(txt, labelEl, okMsg){
  var orig = labelEl.textContent;
  function done(msg){
    labelEl.textContent = msg;
    labelEl.classList.add('copied');
    window.setTimeout(function(){ labelEl.textContent = orig; labelEl.classList.remove('copied'); }, 1800);
  }
  function fallback(){
    try{
      var ta = document.createElement('textarea');
      ta.value = txt; ta.setAttribute('readonly','');
      ta.style.position = 'fixed'; ta.style.left = '-9999px';
      document.body.appendChild(ta); ta.select();
      var ok = document.execCommand('copy');
      document.body.removeChild(ta);
      done(ok ? okMsg : 'Select and copy manually');
    }catch(e){ done('Select and copy manually'); }
  }
  if(navigator.clipboard && navigator.clipboard.writeText){
    navigator.clipboard.writeText(txt).then(function(){ done(okMsg); }, fallback);
  } else { fallback(); }
}
document.querySelectorAll('.copy-btn').forEach(function(b){
  b.addEventListener('click', function(){
    var src = document.getElementById(b.getAttribute('data-copy'));
    var label = b.querySelector('span');
    if(src && label) copyText(src.textContent, label, 'Copied');
  });
});

/* ══════════ PROGRESS: per-page completion, saved in this browser only ══════════ */
var PROG_SECTIONS = [
  { k:'home',       no:'01', name:'Welcome' },
  { k:'mission',    no:'02', name:'The Chancellor’s charge' },
  { k:'tools',      no:'03', name:'Which tool, which moment' },
  { k:'anchors',    no:'04', name:'Module 01: the four anchors' },
  { k:'clarity',    no:'05', name:'Module 02: clear communication' },
  { k:'coach',      no:'06', name:'Module 03: coaching prep' },
  { k:'decide',     no:'07', name:'Module 04: sharper decisions' },
  { k:'hours',      no:'08', name:'Module 05: three habits' },
  { k:'guardrails', no:'09', name:'Guardrails' },
  { k:'practice',   no:'10', name:'Practice now' },
  { k:'check',      no:'11', name:'Knowledge check' },
  { k:'recap',      no:'12', name:'Recap' },
  { k:'sources',    no:'13', name:'Appendix' }
];
function progIs(k){ return getVal('progress-' + k) === '1'; }
function progWrite(k, v){ setVal('progress-' + k, v ? '1' : null); }
function progRender(){
  PROG_SECTIONS.forEach(function(s){
    var done = progIs(s.k);
    var dot = document.querySelector('.bb-dot[data-rail="' + s.k + '"]');
    if(dot){
      dot.classList.toggle('done', done);
      dot.setAttribute('aria-label', s.name + ', ' + (done ? 'done' : 'not done'));
      dot.setAttribute('title', s.no + ' · ' + s.name + ' · ' + (done ? 'done' : 'not yet'));
    }
  });
  bbDoneSync();
}
/* bottom-bar "Mark done": completes the current page */
var bbDoneBtn = document.getElementById('bbDone');
function bbDoneSync(){
  if(!bbDoneBtn) return;
  var curKey = (window.leadPager && window.leadPager.current) ? window.leadPager.current().key : '';
  var sec = null;
  PROG_SECTIONS.forEach(function(s){ if(s.k === curKey) sec = s; });
  if(!sec){ bbDoneBtn.hidden = true; bbDoneBtn.removeAttribute('data-prog'); return; }
  var done = progIs(sec.k);
  bbDoneBtn.hidden = false;
  bbDoneBtn.setAttribute('data-prog', sec.k);
  bbDoneBtn.setAttribute('aria-pressed', done ? 'true' : 'false');
  bbDoneBtn.setAttribute('aria-label', done ? sec.name + ' completed. Select to un-mark.' : 'Mark done: ' + sec.name);
  if(done) bbDoneBtn.setAttribute('title', 'Select to un-mark'); else bbDoneBtn.removeAttribute('title');
  var t = bbDoneBtn.querySelector('.bb-done-t');
  if(t) t.textContent = done ? 'Completed' : 'Mark done';
}
if(bbDoneBtn) bbDoneBtn.addEventListener('click', function(){
  var k = bbDoneBtn.getAttribute('data-prog');
  if(!k) return;
  progWrite(k, !progIs(k));
  progRender();
});
document.addEventListener('lead:page', progRender);

/* auto-complete: finishing a page's activity marks it done. Content pages
   complete themselves when the learner turns past them; activity pages have
   their own triggers above. Mark done still works both ways. */
function progAuto(k){ if(!progIs(k)){ progWrite(k, true); progRender(); } }
var AUTO_ON_LEAVE = { home:1, mission:1, guardrails:1, recap:1, sources:1 };
var lastPageKey = null;
document.addEventListener('lead:page', function(){
  var cur = (window.leadPager && window.leadPager.current) ? window.leadPager.current().key : null;
  if(lastPageKey && lastPageKey !== cur && AUTO_ON_LEAVE[lastPageKey]) progAuto(lastPageKey);
  lastPageKey = cur;
});
/* Module 02 and Practice: a filled builder, or copying one, is the activity */
pb.onInput = function(){ if(pb.filled()) progAuto('clarity'); };
pr.onInput = function(){ if(pr.filled()) progAuto('practice'); };
document.querySelectorAll('.copy-btn').forEach(function(b){
  var target = b.getAttribute('data-copy');
  b.addEventListener('click', function(){
    if(target === 'pbcode' && pb.touched()) progAuto('clarity');
    if(target === 'prcode' && pr.touched()) progAuto('practice');
    if(target === 'c1code' || target === 'c2code') progAuto('coach');
    if(target === 'd1code' || target === 'd2code') progAuto('decide');
    if(target === 'habcode' && getVal('habit')) progAuto('hours');
  });
});
document.querySelectorAll('#recap .print-btn, #practice .print-btn').forEach(function(b){
  b.addEventListener('click', function(){ progAuto('recap'); });
});

/* footer reset: clears every leading-* key (progress, last page, mode, habit,
   both builders, the commitment note) and empties the fields on screen */
var progReset = document.getElementById('progReset');
if(progReset) progReset.addEventListener('click', function(){
  mem = {};
  modeMem = DEFAULT_MODE;
  if(store){
    try{
      var kill = [];
      for(var i = 0; i < store.length; i++){
        var key = store.key(i);
        if(key && key.indexOf(K) === 0) kill.push(key);
      }
      kill.forEach(function(key){ store.removeItem(key); });
    }catch(e){}
  }
  pb.set(null); pr.set(null);
  presetSync(null);
  if(cfNote) cfNote.value = '';
  document.querySelectorAll('[data-q]').forEach(function(q){
    q.removeAttribute('data-answered'); q.removeAttribute('data-right');
    var x = q.querySelector('.qz-x'); if(x) x.hidden = true;
    q.querySelectorAll('.qopt').forEach(function(o){ o.classList.remove('ok','no'); clearVerdict(o); });
  });
  document.querySelectorAll('.qscore').forEach(function(s){ s.hidden = true; s.textContent = ''; });
  habitRender();
  progRender();
  modeRender();
});

habitRender();
progRender();
modeRender();
})();
