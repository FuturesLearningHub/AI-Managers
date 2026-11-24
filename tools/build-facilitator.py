#!/usr/bin/env python3
"""Build the facilitator edition from the classroom edition and notes.json.

    python3 tools/build.py             # first, the two learner editions
    python3 tools/build-facilitator.py # then this

The facilitator edition IS the course. It is the classroom build with a
sticky script rail injected into every page, a briefing page prepended, a
Facilitator Edition badge in the nav, and a Hide control that folds the rail
away. That is the pattern the rest of the FLH library uses, and it is the
reason it works in a room: you teach from the same pages the learners see,
with Say / Do / Ask / Debrief / Transition beside them.

Never hand-edit facilitator/index.html. Edit facilitator/notes.json, or the
course sources in src/, and regenerate.
"""
import html
import json
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
NOTES = ROOT / "facilitator/notes.json"
BASE = ROOT / "classroom/index.html"
OUT = ROOT / "facilitator/index.html"
LEARNER_URL = "https://futureslearninghub.github.io/AI-Managers/classroom/"


def e(s):
    return html.escape(str(s), quote=False)


def q(s):
    """Facilitator script lines are meant to be read aloud, so they are quoted."""
    return "&ldquo;" + e(s) + "&rdquo;"


# ── validation ──────────────────────────────────────────────────────────────
def validate(d, course):
    problems = []
    full = sum(s["minutes"] for s in d["sections"])
    core = sum(s["coreMinutes"] for s in d["sections"])
    if full != d["meta"]["paths"]["full"]:
        problems.append(f"Full path sums to {full}, advertised {d['meta']['paths']['full']}")
    if core != d["meta"]["paths"]["core"]:
        problems.append(f"Core path sums to {core}, advertised {d['meta']['paths']['core']}")
    if full != d["meta"]["totalMinutes"]:
        problems.append(f"totalMinutes is {d['meta']['totalMinutes']}, sections sum to {full}")
    for s in d["sections"]:
        if s["id"] != "home" and f'id="{s["id"]}"' not in course:
            problems.append(f"section id '{s['id']}' has no matching page in the course")
    def walk(node, where):
        if isinstance(node, str):
            if "—" in node or "–" in node:
                problems.append(f"{where} contains an em or en dash")
        elif isinstance(node, dict):
            for k, v in node.items():
                walk(v, f"{where}.{k}")
        elif isinstance(node, list):
            for i, v in enumerate(node):
                walk(v, f"{where}[{i}]")
    walk(d, "notes")
    return problems


# ── the script rail ─────────────────────────────────────────────────────────
def rail(s, core_label):
    blk = []
    blk.append(
        '<div class="facnote__head"><span>Facilitator script</span>'
        f'<span class="facnote__time">Full {s["minutes"]} min &middot; '
        f'{"Core " + str(s["coreMinutes"]) if s["coreMinutes"] else "Core skip"}</span>'
        '<button class="facnote__hide" type="button" aria-label="Hide the facilitator script">Hide</button></div>')
    blk.append(f'<p class="facnote__purpose">{e(s["purpose"])}</p>')
    blk.append('<div class="facnote__blk"><span class="facnote__tag t-say">Say</span>'
               f'<p class="facnote__script">{q(s["say"])}</p></div>')
    if s.get("facilitate"):
        steps = "".join(f"<li>{e(x)}</li>" for x in s["facilitate"])
        blk.append('<div class="facnote__blk"><span class="facnote__tag t-do">Do</span>'
                   f'<ol class="facnote__steps">{steps}</ol></div>')
    if s.get("ask"):
        blk.append('<div class="facnote__blk"><span class="facnote__tag t-ask">Ask</span>'
                   f'<p class="facnote__script">{q(s["ask"])}</p></div>')
    if s.get("debrief"):
        blk.append('<div class="facnote__blk"><span class="facnote__tag t-deb">Debrief</span>'
                   f'<p class="facnote__mini">{e(s["debrief"])}</p></div>')
    blk.append(f'<p class="facnote__meta"><b>Validate:</b> {e(s["validate"])}</p>')
    blk.append(f'<p class="facnote__meta"><b>Watch for:</b> {e(s["watchFor"])}</p>')
    blk.append('<div class="facnote__blk"><span class="facnote__tag t-tra">Transition</span>'
               f'<p class="facnote__script">{q(s["transition"])}</p></div>')
    blk.append(f'<p class="facnote__meta facnote__core"><b>{core_label}:</b> {e(s["coreNote"])}</p>')
    return '<aside class="facnote" aria-label="Facilitator notes">' + "".join(blk) + "</aside>"


# ── the briefing page ───────────────────────────────────────────────────────
def briefing(m):
    def checks(items):
        return "".join(f"<li>{e(x)}</li>" for x in items)

    prep = "".join(
        f'<div class="brief__box"><h3>{n} &middot; {t}</h3><p class="brief__sub">{sub}</p>'
        f'<ol class="checks">{checks(m["prep"][k])}</ol></div>'
        for n, t, sub, k in [
            ("01", "A week before", "Learn the course by taking it", "weekBefore"),
            ("02", "The day before", "Test everything a learner touches", "dayBefore"),
            ("03", "30 minutes before", "Set the room, set the tone", "thirtyMinBefore"),
        ])
    materials = ('<div class="brief__box"><h3>04 &middot; Materials</h3>'
                 '<p class="brief__sub">Have these in hand</p>'
                 f'<ul class="checks">{checks(m["materials"])}</ul></div>')
    sideways = ('<div class="brief__box brief__wide"><h3>05 &middot; When things go sideways</h3>'
                '<p class="brief__sub">If it breaks, you have a move</p>' +
                "".join(f'<div class="brief__row"><b>If {e(c["if"])}:</b> {e(c["then"])}</div>'
                        for c in m["contingencies"]) + "</div>")
    tough = ('<div class="brief__box brief__wide"><h3>06 &middot; Tough questions, ready answers</h3>'
             '<p class="brief__sub">Say each answer out loud once before you teach</p>' +
             "".join(f'<details class="brief__q"><summary>{e(t["q"])}</summary><p>{e(t["a"])}</p></details>'
                     for t in m["toughQuestions"]) + "</div>")
    templates = ('<div class="brief__box brief__wide"><h3>07 &middot; Copy-paste templates</h3>'
                 '<p class="brief__sub">Copy, swap the brackets, send</p>' +
                 "".join(f'<details class="brief__q"><summary>{e(t["label"])}</summary>'
                         f'<pre class="brief__tpl">{e(t["body"])}</pre></details>'
                         for t in m["templates"]) + "</div>")
    run_rows = ""
    invite = next((t for t in m["templates"] if "invite" in t["label"].lower()), m["templates"][0])
    return f"""
<!-- ═══════════ 00 · FACILITATOR BRIEFING (facilitator edition only) ═══════════ -->
<section id="briefing" class="th-dark" aria-label="Facilitator briefing">
  <div class="wrap">
    <p class="brief__youarehere">You are here: the facilitator prep page. Learners start on the next page.</p>
    <span class="eyebrow"><span class="tick" aria-hidden="true"></span><span class="mono">Run this course / 00 &middot; Facilitator only</span></span>
    <h2>Before the room <em class="s">fills</em>.</h2>
    <p class="lead">Two paths: <b>Full {m['paths']['full']} minutes</b> or <b>Core {m['paths']['core']} minutes</b>.
      Every page ahead carries your script in the right rail: Say, Do, Ask, Validate, Watch for, and a Transition
      into the next page, with the Core cut named at the bottom of each card. This page is everything that happens
      before and around the room. Learners never see this edition, and the welcome QR on the next page sends them
      to their own.</p>
    <p><b>Audience.</b> {e(m['audience'])}</p>
    <p><b>Room.</b> {e(m['roomSetup'])}</p>
    <p><b>Framework.</b> {e(m['framework'])}</p>
    <div class="launch-row">
      <a class="btn btn-gold btn-sm" href="guide.html" target="_blank" rel="noopener">Print the facilitator guide</a>
      <a class="btn btn-ghost btn-sm" href="{LEARNER_URL}" target="_blank" rel="noopener">Open the learner edition</a>
    </div>
    <p class="brief__printnote">One paper packet: this prep page, the run of show, the tough-questions bank, and
      every section script with its page pictured beside the notes. Print it or choose Save as PDF.</p>
    <div class="brief__grid">{prep}{materials}{sideways}{tough}{templates}</div>
    <p class="brief__printnote" style="margin-top:1.5rem"><b>After the session:</b> {e(m['postSession'])}</p>
  </div>
  <aside class="facnote" aria-label="Facilitator notes">
    <div class="facnote__head"><span>Facilitator script</span>
      <span class="facnote__time">Full {m['paths']['full']} min &middot; Core {m['paths']['core']}</span>
      <button class="facnote__hide" type="button" aria-label="Hide the facilitator script">Hide</button></div>
    <p class="facnote__purpose">Run this course</p>
    <p class="facnote__mini">The pre-work invite. Send it with the calendar invite a week out; swap anything in [brackets] and it is ready.</p>
    <span class="facnote__tag t-say">Invite</span>
    <div class="facnote__invite">{e(invite['body'])}</div>
  </aside>
</section>
"""


FAC_CSS = """
/* ═══════════════════ FACILITATOR EDITION ═══════════════════
   The rail is its own dark surface whatever theme the page under it uses, so
   its contrast is fixed and measurable rather than dependent on the section. */
.fac__badge{ font-family:var(--cond); font-weight:700; text-transform:uppercase; letter-spacing:.08em;
  font-size:.66rem; color:#1C1C1C; background:var(--vu-gold); padding:.3rem .5rem; border-radius:3px;
  margin-left:.8rem; white-space:nowrap; }
@media (max-width:700px){ .fac__badge{ display:none; } }

@media (min-width:1200px){
  body.fac .page > section{ display:grid; grid-template-columns:minmax(0,1fr) 360px; align-items:start; column-gap:0; }
  body.fac .page > section > .wrap{ grid-column:1; }
  body.fac .facnote{ grid-column:2; grid-row:1; position:sticky; top:16px; margin:0 clamp(16px,2vw,28px) 0 0; }
  body.fac.fac-hide .page > section{ grid-template-columns:1fr; }
}
.facnote{ background:#141414; color:#D6D6D6; border:1px solid rgba(207,174,112,.45);
  border-left:3px solid var(--vu-gold); border-radius:6px; padding:1rem 1.1rem;
  font-size:.82rem; line-height:1.55; max-height:calc(100dvh - 140px); overflow:auto; z-index:5; }
@media (max-width:1199px){ .facnote{ margin:1.5rem clamp(20px,5vw,48px) 0; max-height:none; } }
.facnote__head{ display:flex; justify-content:space-between; gap:.5rem; align-items:baseline; flex-wrap:wrap;
  font-family:var(--cond); font-weight:700; text-transform:uppercase; letter-spacing:.07em;
  font-size:.68rem; color:var(--vu-gold); border-bottom:1px solid rgba(207,174,112,.3);
  padding-bottom:.5rem; margin-bottom:.6rem; }
.facnote__time{ color:#BDBDBD; }
.facnote__purpose{ margin:0 0 .6rem; color:#FFFFFF; font-weight:500; max-width:none; }
.facnote__steps{ margin:0 0 .6rem; padding-left:1.05rem; display:grid; gap:.35rem; }
.facnote__steps li{ color:#D6D6D6; }
.facnote__meta{ margin:.35rem 0 0; color:#BDBDBD; max-width:none; }
.facnote__meta b{ color:var(--vu-gold); font-weight:600; }
.facnote__core{ border-top:1px dashed rgba(207,174,112,.35); padding-top:.5rem; margin-top:.6rem; }
.facnote__blk{ margin:.55rem 0 0; }
.facnote__tag{ display:inline-block; font-family:var(--cond); font-weight:700; text-transform:uppercase;
  letter-spacing:.08em; font-size:.6rem; padding:.15rem .42rem; border-radius:2px; margin-bottom:.28rem; }
.t-say{ background:var(--vu-gold); color:#1C1C1C; }
.t-do { background:var(--vu-sky); color:#1C1C1C; }
.t-ask{ background:var(--vu-sage); color:#1C1C1C; }
.t-deb{ background:var(--vu-highlight); color:#1C1C1C; }
.t-tra{ background:#4F4F4F; color:#FFFFFF; }
.facnote__script{ margin:0; font-family:var(--serif-i); font-style:italic; font-size:.88rem; color:#FFFFFF; max-width:none; }
.facnote__mini{ margin:.25rem 0 0; font-size:.78rem; color:#BDBDBD; max-width:none; }
.facnote__invite{ border:1px solid rgba(255,255,255,.22); border-radius:5px; padding:.8rem .9rem;
  margin-top:.5rem; font-size:.79rem; color:#D6D6D6; white-space:pre-wrap; font-family:var(--sans); }
.facnote__hide{ font-family:var(--sans); font-weight:600; font-size:.72rem; color:#FFFFFF;
  background:rgba(255,255,255,.10); border:1px solid rgba(255,255,255,.35); border-radius:5px;
  padding:.3rem .7rem; cursor:pointer; text-transform:none; letter-spacing:0; }
.facnote__hide:hover{ border-color:var(--vu-gold); }
body.fac-hide .facnote{ display:none !important; }
.facshow{ position:fixed; right:clamp(14px,2vw,28px); top:calc(var(--nav-h,96px) + 14px); z-index:96;
  display:none; align-items:center; gap:.45rem; font-family:var(--cond); font-weight:700;
  text-transform:uppercase; letter-spacing:.09em; font-size:.68rem; color:var(--vu-gold);
  background:#141414; border:1px solid rgba(207,174,112,.45); border-radius:4px;
  padding:.5rem .75rem; cursor:pointer; }
body.fac-hide .facshow{ display:inline-flex; }

/* the briefing page */
.brief__youarehere{ font-family:var(--cond); font-weight:700; text-transform:uppercase;
  letter-spacing:.09em; font-size:.68rem; color:#A3A3A3; margin-bottom:1rem; }
.brief__grid{ display:grid; gap:1rem; grid-template-columns:1fr; margin-top:1.5rem; }
@media (min-width:980px){ .brief__grid{ grid-template-columns:repeat(2,1fr); } }
.brief__box{ background:#262624; border:1px solid rgba(207,174,112,.3); border-radius:6px; padding:1.1rem 1.25rem; font-size:.92rem; }
.brief__box h3{ font-family:var(--cond); font-weight:700; text-transform:uppercase; letter-spacing:.06em;
  font-size:.8rem; color:var(--vu-gold); margin-bottom:.6rem; }
.brief__box ol, .brief__box ul{ margin:0; padding-left:1.1rem; display:grid; gap:.4rem; color:#D6D6D6; }
.brief__wide{ grid-column:1 / -1; }
.brief__row{ padding:.45rem 0; border-bottom:1px solid rgba(255,255,255,.10); color:#D6D6D6; }
.brief__row b{ color:var(--vu-gold); }
.brief__q{ border-bottom:1px solid rgba(255,255,255,.10); padding:.4rem 0; }
.brief__q summary{ cursor:pointer; font-weight:500; color:#FFFFFF; }
.brief__q p{ margin:.4rem 0 .2rem; color:#D6D6D6; font-size:.9rem; }
.brief__tpl{ margin:.5rem 0 .2rem; white-space:pre-wrap; font-family:var(--sans); font-size:.85rem;
  color:#D6D6D6; background:#1C1C1C; border:1px solid rgba(255,255,255,.14); border-radius:4px; padding:.7rem .8rem; }
.brief__sub{ font-weight:600; color:#FFFFFF; margin:0 0 .6rem; font-size:1rem; }
.brief__printnote{ color:#BDBDBD; font-size:.9rem; max-width:62ch; margin-top:.75rem; }
.brief__box .checks{ list-style:none; padding-left:0; }
.brief__box .checks li{ position:relative; padding-left:1.4rem; }
.brief__box .checks li::before{ content:"\\2713"; position:absolute; left:0; color:var(--vu-gold); font-weight:700; }

/* the briefing is prose in a bare .wrap, so it sets its own rhythm */
#briefing .wrap > p{ margin-top:14px; max-width:72ch; color:#D6D6D6; }
#briefing h2{ margin-top:16px; }
#briefing .lead{ margin-top:20px; color:#FFFFFF; font-size:1.08rem; }
#briefing .launch-row{ margin-top:24px; }

/* the scroll affordance sits over the rail at wide widths; move it clear */
@media (min-width:1200px){
  body.fac:not(.fac-hide) #pgMore{ right:calc(360px + clamp(16px,2vw,28px) + 18px); }
}

@media print{
  .facnote{ break-inside:avoid; page-break-inside:avoid; }
  .facshow{ display:none !important; }
}
"""

FAC_JS = """
/* ══════════ the script rail: hide and bring back ══════════
   Hiding is remembered, because a facilitator who hides the rail to project
   the page cleanly does not want it back on every page turn. */
(function(){
  var KEY = 'leading-facScriptHidden';
  var show = document.createElement('button');
  show.className = 'facshow';
  show.type = 'button';
  show.textContent = 'Show facilitator script';
  document.body.appendChild(show);
  function set(h){
    document.body.classList.toggle('fac-hide', h);
    try{ localStorage.setItem(KEY, h ? '1' : '0'); }catch(e){}
  }
  document.addEventListener('click', function(ev){
    if(ev.target.closest && ev.target.closest('.facnote__hide')){
      set(true);
      show.focus();
    }
  });
  show.addEventListener('click', function(){
    set(false);
    var h = document.querySelector('.page.cur .facnote__hide');
    if(h) h.focus();
  });
  try{ if(localStorage.getItem(KEY) === '1') set(true); }catch(e){}
})();
"""



# ── the printable packet ────────────────────────────────────────────────────
GUIDE_CSS = """
:root{ --vu-black:#1C1C1C; --vu-gold:#946E24; --vu-rule:#E0D5C0; --ink:#1C1C1C; --ink2:#555555; }
*,*::before,*::after{ box-sizing:border-box; margin:0; padding:0; }
body{ font-family:'Inter',Arial,system-ui,sans-serif; font-size:10.5pt; line-height:1.5;
  color:var(--ink); background:#FFFFFF; }
.gwrap{ max-width:7.4in; margin-inline:auto; padding:0.5in 0.4in 0.7in; }
h1{ font-family:'Libre Caslon Display','Times New Roman',serif; font-weight:400; font-size:30pt;
  line-height:1.08; letter-spacing:-.01em; }
h1 em{ font-family:'Libre Caslon Text','Times New Roman',serif; font-style:italic; }
h2{ font-family:'Libre Caslon Display','Times New Roman',serif; font-weight:400; font-size:17pt;
  margin:22pt 0 8pt; padding-bottom:5pt; border-bottom:2px solid var(--vu-gold); }
h3{ font-family:'Antonio','Arial Narrow',sans-serif; font-weight:700; text-transform:uppercase;
  letter-spacing:.07em; font-size:9pt; color:var(--vu-gold); margin:12pt 0 4pt; }
.eyebrow{ font-family:'Antonio','Arial Narrow',sans-serif; font-weight:700; text-transform:uppercase;
  letter-spacing:.09em; font-size:8.5pt; color:var(--vu-gold); }
p{ margin-top:6pt; max-width:66ch; }
.lead{ font-size:11.5pt; color:var(--ink2); margin-top:10pt; }
.front dl{ display:grid; grid-template-columns:1.15in 1fr; gap:5pt 10pt; margin-top:10pt; }
.front dt{ font-family:'Antonio','Arial Narrow',sans-serif; font-weight:700; text-transform:uppercase;
  letter-spacing:.06em; font-size:8.5pt; color:var(--vu-gold); padding-top:1pt; }
.front dd{ color:var(--ink2); }
table.run{ width:100%; border-collapse:collapse; margin-top:10pt; font-size:9.5pt; }
table.run th{ text-align:left; font-family:'Antonio','Arial Narrow',sans-serif; font-weight:700;
  text-transform:uppercase; letter-spacing:.06em; font-size:8pt; color:var(--vu-gold);
  border-bottom:1.5pt solid var(--vu-gold); padding:4pt 5pt; }
table.run td{ border-bottom:.5pt solid var(--vu-rule); padding:4pt 5pt; vertical-align:top; color:var(--ink2); }
table.run td.name{ color:var(--ink); }
table.run td.num{ text-align:right; font-variant-numeric:tabular-nums; white-space:nowrap; }
table.run tfoot td{ font-weight:600; color:var(--ink); border-top:1.5pt solid var(--vu-gold); border-bottom:0; }
ul,ol{ margin:5pt 0 0 14pt; }
li{ margin-top:3pt; color:var(--ink2); }
.sec{ break-inside:avoid; page-break-inside:avoid; break-before:page; page-break-before:always;
  padding-top:8pt; }
.sec:first-of-type{ break-before:auto; page-page-break-before:auto; }
.sec__head{ display:flex; align-items:baseline; gap:10pt; flex-wrap:wrap;
  border-bottom:2px solid var(--vu-gold); padding-bottom:5pt; }
.sec__no{ font-family:'Antonio','Arial Narrow',sans-serif; font-weight:700; text-transform:uppercase;
  letter-spacing:.07em; font-size:9pt; color:var(--vu-gold); }
.sec__title{ font-family:'Libre Caslon Display','Times New Roman',serif; font-size:16pt; }
.sec__time{ margin-left:auto; font-family:'Antonio','Arial Narrow',sans-serif; font-weight:700;
  text-transform:uppercase; letter-spacing:.06em; font-size:8.5pt; color:var(--ink2); }
.sec__body{ display:grid; grid-template-columns:290px minmax(0,1fr); gap:14pt; margin-top:9pt; align-items:start; }
@media (max-width:760px){ .sec__body{ grid-template-columns:1fr; } }
.sec__shot img{ width:100%; display:block; border:.5pt solid var(--vu-rule); border-radius:3px; }
.sec__shot.missing img{ display:none; }
.sec__shot figcaption{ font-family:'Antonio','Arial Narrow',sans-serif; font-weight:700;
  text-transform:uppercase; letter-spacing:.06em; font-size:7.5pt; color:var(--ink2); margin-top:4pt; }
.purpose{ font-style:italic; color:var(--ink2); margin:0 0 7pt; }
.blk{ display:grid; grid-template-columns:52pt minmax(0,1fr); gap:8pt; margin-top:7pt; }
.tag{ font-family:'Antonio','Arial Narrow',sans-serif; font-weight:700; text-transform:uppercase;
  letter-spacing:.07em; font-size:7.5pt; color:var(--ink); background:var(--vu-rule);
  border-radius:2px; padding:2pt 4pt; text-align:center; height:fit-content; }
.tag.say{ background:#EFE0C4; }
.script{ font-family:'Libre Caslon Text','Times New Roman',serif; font-style:italic; font-size:10.5pt; color:var(--ink); }
.blk ol{ margin:0 0 0 13pt; }
.meta{ margin-top:5pt; font-size:9.5pt; color:var(--ink2); }
.meta b{ color:var(--ink); }
.core{ margin-top:6pt; padding-top:5pt; border-top:.5pt dashed var(--vu-gold); font-size:9.5pt; color:var(--ink2); }
.core b{ color:var(--vu-gold); }
.qa{ margin-top:8pt; padding-bottom:6pt; border-bottom:.5pt solid var(--vu-rule); }
.qa p:first-child{ font-weight:600; color:var(--ink); }
.tpl{ white-space:pre-wrap; font-size:9pt; color:var(--ink2); background:#F5F3EF;
  border:.5pt solid var(--vu-rule); border-radius:3px; padding:7pt 8pt; margin-top:5pt; }
.noprint{ margin-top:14pt; }
.pbtn{ font:inherit; font-weight:600; font-size:10pt; color:#FFFFFF; background:var(--vu-black);
  border:0; border-radius:3px; padding:8pt 14pt; cursor:pointer; }
@page{ size:letter; margin:0.55in 0.5in 0.6in; }
@media print{ .noprint{ display:none !important; } .gwrap{ max-width:none; padding:0; } }
"""


def guide(d, m, core_label):
    secs = d["sections"]
    rows = "".join(
        f'<tr><td class="num">{i+1:02d}</td><td class="name">{e(s["title"])}</td>'
        f'<td class="num">{s["minutes"] or ""}</td><td class="num">{s["coreMinutes"] or ""}</td>'
        f'<td>{e(s.get("coreNote",""))}</td></tr>' for i, s in enumerate(secs))
    blocks = []
    for i, s in enumerate(secs):
        steps = "".join(f"<li>{e(x)}</li>" for x in s.get("facilitate", []))
        blocks.append(f"""
<section class="sec">
  <div class="sec__head"><span class="sec__no">{i+1:02d}</span>
    <span class="sec__title">{e(s['title'])}</span>
    <span class="sec__time">Full {s['minutes']} min &middot; {"Core " + str(s['coreMinutes']) if s['coreMinutes'] else "Core skip"}</span></div>
  <div class="sec__body">
    <figure class="sec__shot">
      <img src="img/{e(s['id'])}.jpg" alt="The {e(s['title'])} page as learners see it"
           onerror="this.closest('.sec__shot').classList.add('missing')" />
      <figcaption>{e(s['title'])}</figcaption>
    </figure>
    <div>
      <p class="purpose">{e(s['purpose'])}</p>
      <div class="blk"><span class="tag say">Say</span><p class="script">{q(s['say'])}</p></div>
      {'<div class="blk"><span class="tag">Do</span><ol>' + steps + '</ol></div>' if steps else ''}
      {'<div class="blk"><span class="tag">Ask</span><p class="script">' + q(s['ask']) + '</p></div>' if s.get('ask') else ''}
      <p class="meta"><b>Validate:</b> {e(s['validate'])}</p>
      <p class="meta"><b>Watch for:</b> {e(s['watchFor'])}</p>
      <div class="blk"><span class="tag">Transition</span><p class="script">{q(s['transition'])}</p></div>
      <p class="core"><b>{core_label}:</b> {e(s['coreNote'])}</p>
    </div>
  </div>
</section>""")
    prep = "".join(
        f"<h3>{n} &middot; {t}</h3><ul>" + "".join(f"<li>{e(x)}</li>" for x in m["prep"][k]) + "</ul>"
        for n, t, k in [("01", "A week before", "weekBefore"), ("02", "The day before", "dayBefore"),
                        ("03", "30 minutes before", "thirtyMinBefore")])
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Leading with AI &middot; Facilitator guide</title>
<meta name="robots" content="noindex" />
<!-- GENERATED FILE. Edit facilitator/notes.json, then run
     node tools/shoot-slides.mjs && python3 tools/build-facilitator.py -->
<style>{GUIDE_CSS}</style>
</head>
<body>
<div class="gwrap">
  <p class="eyebrow">Facilitator guide &middot; {e(m['program'])}</p>
  <h1>Leading with <em>AI</em>.</h1>
  <p class="lead">The paper packet. Everything before the room, the run of show for both paths, and every
    section script with its page pictured beside the notes.</p>
  <div class="noprint"><button class="pbtn" type="button" onclick="window.print()">Print this guide</button></div>

  <div class="front">
    <h2>Before you teach</h2>
    <dl>
      <dt>Paths</dt><dd>Full {m['paths']['full']} minutes, Core {m['paths']['core']} minutes</dd>
      <dt>Audience</dt><dd>{e(m['audience'])}</dd>
      <dt>Room</dt><dd>{e(m['roomSetup'])}</dd>
      <dt>Framework</dt><dd>{e(m['framework'])}</dd>
      <dt>After</dt><dd>{e(m['postSession'])}</dd>
    </dl>
    {prep}
    <h3>04 &middot; Materials</h3>
    <ul>{"".join(f"<li>{e(x)}</li>" for x in m["materials"])}</ul>
  </div>

  <h2>Run of show</h2>
  <table class="run">
    <thead><tr><th>#</th><th>Section</th><th class="num">Full</th><th class="num">Core</th><th>What Core changes</th></tr></thead>
    <tbody>{rows}</tbody>
    <tfoot><tr><td></td><td>Total</td><td class="num">{m['paths']['full']}</td><td class="num">{m['paths']['core']}</td><td></td></tr></tfoot>
  </table>

  <h2>When things go sideways</h2>
  {"".join(f'<div class="qa"><p>If {e(c["if"])}</p><p>{e(c["then"])}</p></div>' for c in m["contingencies"])}

  <h2>Tough questions</h2>
  {"".join(f'<div class="qa"><p>{e(t["q"])}</p><p>{e(t["a"])}</p></div>' for t in m["toughQuestions"])}

  <h2>Templates</h2>
  {"".join(f'<h3>{e(t["label"])}</h3><div class="tpl">{e(t["body"])}</div>' for t in m["templates"])}

  <h2>The script, section by section</h2>
  {"".join(blocks)}
</div>
</body>
</html>
"""


def build():
    if not BASE.exists():
        sys.exit("classroom/index.html is missing. Run python3 tools/build.py first.")
    d = json.loads(NOTES.read_text(encoding="utf-8"))
    course = BASE.read_text(encoding="utf-8")

    problems = validate(d, course)
    if problems:
        print("facilitator notes failed validation:")
        for p in problems:
            print("  - " + p)
        sys.exit(1)

    m = d["meta"]
    core_label = f"{m['paths']['core']}-min core"
    page = course

    # 1 · identity: title, description, body class, nav badge
    page = re.sub(r"<title>.*?</title>",
                  "<title>Leading with AI (facilitator) &middot; The CHART Program</title>", page, count=1, flags=re.S)
    page = re.sub(r'<meta name="description" content=".*?" />',
                  '<meta name="description" content="The facilitator edition of Leading with AI: the course itself, '
                  'with the Say / Do / Ask / Validate / Transition script beside every page, and a briefing page for '
                  'everything that happens before the room fills." />', page, count=1, flags=re.S)
    page = page.replace('<meta name="theme-color" content="#1C1C1C" />',
                        '<meta name="theme-color" content="#1C1C1C" />\n<meta name="robots" content="noindex" />', 1)
    page = page.replace("<body>", '<body class="fac">', 1)
    page = page.replace('<img src="../assets/img/v-lockup-white@2x.png" alt="Vanderbilt University" width="166" height="36" decoding="async" />',
                        '<img src="../assets/img/v-lockup-white@2x.png" alt="Vanderbilt University" width="166" height="36" decoding="async" />'
                        '<span class="fac__badge">Facilitator Edition</span>', 1)

    # 2 · the rail CSS goes last so it wins over the course's own component rules
    page = page.replace("</style>", FAC_CSS + "\n</style>", 1)

    # 3 · the briefing page, ahead of the learner's welcome
    page = page.replace('<main id="main"><span id="top"></span>',
                        '<main id="main"><span id="top"></span>' + briefing(m), 1)

    # 4 · one rail per section, injected after that section's .wrap
    injected = []
    for s in d["sections"]:
        aside = rail(s, core_label)
        if s["id"] == "home":
            marker = '<section class="hero th-dark" aria-label="Welcome">'
        else:
            marker = re.search(rf'<section id="{re.escape(s["id"])}"[^>]*>', page)
            marker = marker.group(0) if marker else None
        if not marker or marker not in page:
            sys.exit(f"could not find the section for '{s['id']}' in the classroom build")
        start = page.index(marker)
        close = page.index("\n</section>", start)
        page = page[:close] + "\n  " + aside + page[close:]
        injected.append(s["id"])

    # 5 · the briefing joins the pager as page 01
    page = page.replace("""  var PLAN = [
    { sel:'section.hero',  key:'home',       label:'Welcome' },""",
"""  var PLAN = [
    { sel:'#briefing',     key:'briefing',   label:'Facilitator briefing' },
    { sel:'section.hero',  key:'home',       label:'Welcome' },""", 1)
    page = page.replace("""  var TRACKED = [
    ['home','01','Welcome'],""",
"""  var TRACKED = [
    ['briefing','00','Facilitator briefing'], ['home','01','Welcome'],""", 1)
    page = page.replace("""var PROG_SECTIONS = [
  { k:'home',       no:'01', name:'Welcome' },""",
"""var PROG_SECTIONS = [
  { k:'briefing',   no:'00', name:'Facilitator briefing' },
  { k:'home',       no:'01', name:'Welcome' },""", 1)
    page = page.replace("var AUTO_ON_LEAVE = { home:1,", "var AUTO_ON_LEAVE = { briefing:1, home:1,", 1)

    # 6 · the welcome QR must send learners to THEIR edition, never this one
    page = page.replace('<div class="qr-card" id="qrCard">',
                        f'<div class="qr-card" id="qrCard" data-url="{LEARNER_URL}">', 1)

    # 7 · the hide control
    page = page.replace("</body>", f"<script>{FAC_JS}</script>\n</body>", 1)

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(page, encoding="utf-8")

    g = guide(d, m, core_label)
    (ROOT / "facilitator/guide.html").write_text(g, encoding="utf-8")
    shots = ROOT / "facilitator/img"
    missing = [s2["id"] for s2 in d["sections"] if not (shots / f"{s2['id']}.jpg").exists()]
    if missing:
        print("  note: guide images missing for " + ", ".join(missing) +
              " (run: node tools/shoot-slides.mjs)")
    print(f"wrote facilitator/guide.html  ({len(g)/1024:.0f} KB, "
          f"{len(d['sections']) - len(missing)}/{len(d['sections'])} page images)")
    full = sum(s["minutes"] for s in d["sections"])
    core = sum(s["coreMinutes"] for s in d["sections"])
    print(f"wrote {OUT.relative_to(ROOT)}  ({len(page)/1024:.0f} KB, "
          f"{len(injected)} script rails + briefing, Full {full} min, Core {core} min)")


if __name__ == "__main__":
    build()
