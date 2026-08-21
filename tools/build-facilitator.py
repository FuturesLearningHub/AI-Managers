#!/usr/bin/env python3
"""Generate the facilitator runbook from facilitator/notes.json.

    python3 tools/build-facilitator.py

Writes facilitator/index.html: the briefing page ("Before the room fills"),
the run-of-show table with both paths, and one Say / Do / Ask / Debrief /
Transition block per section, in ATD order.

This course reads as a book rather than a horizontal deck, so the runbook is a
single printable document instead of a script rail welded to slides. The
content contract is the same: notes.json is the source, the page is generated,
and the timing has to sum to the advertised paths or the build stops.
"""
import html
import json
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
NOTES = ROOT / "facilitator/notes.json"
OUT = ROOT / "facilitator/index.html"
LEARNER = "../classroom/"


def e(s):
    return html.escape(str(s), quote=True)


def check(d):
    """The invariants that make the advertised lengths true."""
    problems = []
    full = sum(s["minutes"] for s in d["sections"])
    core = sum(s["coreMinutes"] for s in d["sections"])
    if full != d["meta"]["paths"]["full"]:
        problems.append(f"Full path sums to {full}, advertised {d['meta']['paths']['full']}")
    if core != d["meta"]["paths"]["core"]:
        problems.append(f"Core path sums to {core}, advertised {d['meta']['paths']['core']}")
    if full != d["meta"]["totalMinutes"]:
        problems.append(f"totalMinutes is {d['meta']['totalMinutes']}, sections sum to {full}")
    course = (ROOT / "classroom/index.html").read_text(encoding="utf-8")
    for s in d["sections"]:
        if s["id"] == "home":
            continue
        if f'id="{s["id"]}"' not in course:
            problems.append(f"section id '{s['id']}' has no matching page in the course")
    for s in d["sections"]:
        for k, v in s.items():
            if isinstance(v, str) and ("—" in v or "–" in v):
                problems.append(f"section '{s['id']}' field '{k}' contains an em or en dash")
    return problems


def li(items):
    return "\n".join(f"<li>{e(x)}</li>" for x in items)


def build():
    d = json.loads(NOTES.read_text(encoding="utf-8"))
    problems = check(d)
    if problems:
        print("facilitator notes failed validation:")
        for p in problems:
            print("  - " + p)
        sys.exit(1)

    m = d["meta"]
    css = (ROOT / "src/base.css").read_text(encoding="utf-8")
    fonts = "\n".join(
        f"@font-face{{font-family:{fam};font-style:{sty};font-weight:{w};font-display:swap;"
        f"src:url('../assets/fonts/{f}') format('woff2');}}"
        for fam, sty, w, f in [
            ("'Libre Caslon Display'", "normal", 400, "libre-caslon-display-latin-400-normal.woff2"),
            ("'Libre Caslon Display'", "italic", 400, "libre-caslon-text-latin-400-italic.woff2"),
            ("'Libre Caslon Text'", "italic", 400, "libre-caslon-text-latin-400-italic.woff2"),
            ("'Inter'", "normal", 400, "inter-latin-400-normal.woff2"),
            ("'Inter'", "normal", 500, "inter-latin-500-normal.woff2"),
            ("'Inter'", "normal", 600, "inter-latin-600-normal.woff2"),
            ("'Antonio'", "normal", 700, "antonio-latin-700-normal.woff2"),
        ])

    rows = "\n".join(
        f"<tr><td>{i+1:02d}</td><td>{e(s['title'])}</td>"
        f"<td class='num'>{s['minutes'] or ''}</td>"
        f"<td class='num'>{s['coreMinutes'] or ''}</td>"
        f"<td>{e(s.get('coreNote',''))}</td></tr>"
        for i, s in enumerate(d["sections"]))

    blocks = []
    for i, s in enumerate(d["sections"]):
        blocks.append(f"""
<article class="fsec" id="fs-{e(s['id'])}">
  <div class="fsec-head">
    <span class="rno">{i+1:02d} &middot; {e(s['title'])}</span>
    <span class="ftime">Full {s['minutes']} min &middot; Core {s['coreMinutes']} min</span>
  </div>
  <p class="fpurpose">{e(s['purpose'])}</p>
  <div class="ftag"><span class="t-say">Say</span><blockquote>{e(s['say'])}</blockquote></div>
  <div class="ftag"><span class="t-say">Do</span><ul>{li(s['facilitate'])}</ul></div>
  <div class="ftag"><span class="t-say">Ask</span><p>{e(s['ask'])}</p></div>
  <div class="ftag"><span class="t-say">Debrief</span><p>{e(s['validate'])}</p></div>
  <div class="ftag"><span class="t-say">Watch for</span><p>{e(s['watchFor'])}</p></div>
  <div class="ftag"><span class="t-say">Transition</span><p class="ftrans">{e(s['transition'])}</p></div>
</article>""")

    conting = "\n".join(
        f"<div class='rstep'><span class='rno'>If</span><p><b>{e(c['if'])}</b></p>"
        f"<p><span class='cf-l'>Then</span> {e(c['then'])}</p></div>" for c in m["contingencies"])
    tough = "\n".join(
        f"<div class='rstep'><span class='rno'>Q</span><p><b>{e(q['q'])}</b></p><p>{e(q['a'])}</p></div>"
        for q in m["toughQuestions"])
    templates = "\n".join(
        f"<div class='pcard' style='margin-top:14px'><div class='pc-head'><span class='mono'>{e(t['label'])}</span>"
        f"<button type='button' class='btn btn-ghost btn-sm copy-btn' data-copy='tpl{i}'><span>Copy</span></button></div>"
        f"<pre class='pcode' id='tpl{i}'>{e(t['body'])}</pre></div>"
        for i, t in enumerate(m["templates"]))

    page = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Leading with AI &middot; Facilitator runbook</title>
<meta name="description" content="The facilitator runbook for Leading with AI: prep, run of show for both paths, and Say / Do / Ask / Debrief / Transition for every section." />
<meta name="theme-color" content="#1C1C1C" />
<meta name="robots" content="noindex" />
<!-- GENERATED FILE. Edit facilitator/notes.json, then run
     python3 tools/build-facilitator.py -->
<style>
{fonts}
{css}
/* runbook-only layout, on the same tokens as the course */
.fsec{{ border:1px solid var(--bd); border-radius:var(--r); background:var(--card);
  padding:22px 24px; margin-top:16px; break-inside:avoid; }}
.fsec-head{{ display:flex; flex-wrap:wrap; gap:8px 18px; align-items:baseline;
  padding-bottom:10px; margin-bottom:12px; border-bottom:1px solid var(--bd); }}
.ftime{{ font-family:var(--cond); font-weight:700; font-size:.7rem; letter-spacing:.06em;
  text-transform:uppercase; color:var(--tx3); margin-left:auto; }}
.fpurpose{{ color:var(--tx2); font-size:.9rem; font-style:italic; margin-bottom:14px; }}
.ftag{{ display:grid; grid-template-columns:104px minmax(0,1fr); gap:14px; margin-top:12px; }}
@media (max-width:640px){{ .ftag{{ grid-template-columns:1fr; gap:4px; }} }}
.t-say{{ font-family:var(--cond); font-weight:700; font-size:.7rem; letter-spacing:.07em;
  text-transform:uppercase; color:var(--eyebrow); border:1px solid var(--acc);
  border-radius:2px; padding:4px 8px; height:fit-content; text-align:center; }}
.ftag blockquote{{ font-family:var(--serif); font-size:1.02rem; line-height:1.6; color:var(--tx);
  border-left:3px solid var(--acc); padding-left:14px; }}
.ftag p{{ color:var(--tx2); font-size:.92rem; }}
.ftag ul{{ list-style:none; display:flex; flex-direction:column; gap:7px; }}
.ftag li{{ color:var(--tx2); font-size:.92rem; padding-left:18px; position:relative; }}
.ftag li::before{{ content:"\\2713"; position:absolute; left:0; color:var(--eyebrow); font-size:.85em; }}
.ftrans{{ font-family:var(--serif); font-style:italic; color:var(--tx) !important; }}
.runtable{{ width:100%; border-collapse:collapse; margin-top:18px; font-size:.9rem; }}
.runtable th{{ font-family:var(--cond); font-weight:700; font-size:.7rem; letter-spacing:.07em;
  text-transform:uppercase; color:var(--eyebrow); text-align:left;
  border-bottom:2px solid var(--acc); padding:8px 10px; }}
.runtable td{{ border-bottom:1px solid var(--bd); padding:9px 10px; color:var(--tx2); vertical-align:top; }}
.runtable td:nth-child(2){{ color:var(--tx); }}
.runtable .num{{ text-align:right; font-variant-numeric:tabular-nums; white-space:nowrap; }}
.runtable tfoot td{{ font-weight:600; color:var(--tx); border-top:2px solid var(--acc); border-bottom:0; }}
.scroll-x{{ overflow-x:auto; }}
@media print{{
  .noprint{{ display:none !important; }}
  .fsec, .rstep, .pcard{{ break-inside:avoid; }}
  a[href^="http"]::after{{ content:" (" attr(href) ")"; font-size:.75em; color:#555; }}
}}
</style>
</head>
<body class="th-light" style="background:var(--vu-white)">
<a href="#main" class="skip">Skip to content</a>
<main id="main">
<section class="th-dark" aria-label="Facilitator briefing">
  <div class="wrap">
    <div class="sec-head">
      <span class="you-are">You are here: the facilitator prep page. Learners start on the course itself.</span>
      <span class="eyebrow"><span class="tick" aria-hidden="true"></span><span class="mono">Run this course &middot; 00 &middot; Facilitator only</span></span>
      <h2>Before the room <em class="s">fills</em>.</h2>
      <p>{e(m['program'])}. Two paths: <b>Full {m['paths']['full']} minutes</b> and <b>Core {m['paths']['core']} minutes</b>,
        and each section below carries both numbers. Everything here is for you. Learners never see this page.</p>
      <p><b>Audience.</b> {e(m['audience'])}</p>
      <p><b>Room.</b> {e(m['roomSetup'])}</p>
      <p><b>Framework.</b> {e(m['framework'])}</p>
    </div>
    <div class="launch-row noprint">
      <a class="btn btn-gold btn-sm" href="{LEARNER}" target="_blank" rel="noopener">Open the learner edition</a>
      <button type="button" class="btn btn-ghost btn-sm" onclick="window.print()">Print this runbook</button>
      <a class="btn btn-ghost btn-sm" href="https://www.vanderbilt.ai/" target="_blank" rel="noopener">Open Amplify</a>
    </div>
    <div class="rule-strip" role="note" style="margin-top:22px">
      <p class="r">Never cut the commitment round in Module 05. <b>It is the only part that changes anyone's week.</b></p>
    </div>
  </div>
</section>

<section class="th-light" aria-label="Learning objectives and preparation">
  <div class="wrap">
    <div class="sec-head">
      <span class="eyebrow"><span class="tick" aria-hidden="true"></span><span class="mono">01 &middot; Objectives and prep</span></span>
      <h2>What they leave able <em class="s">to do</em>.</h2>
    </div>
    <div class="keepl" style="max-width:820px"><span class="c-label">By the end, managers can</span>
      <ul>{li(m['objectives'])}</ul></div>
    <div class="roadmap three" style="margin-top:20px">
      <div class="rstep"><span class="rno">01 &middot; A week before</span><ul>{li(m['prep']['weekBefore'])}</ul></div>
      <div class="rstep"><span class="rno">02 &middot; The day before</span><ul>{li(m['prep']['dayBefore'])}</ul></div>
      <div class="rstep"><span class="rno">03 &middot; 30 minutes before</span><ul>{li(m['prep']['thirtyMinBefore'])}</ul></div>
    </div>
    <div class="keepl" style="margin-top:16px;max-width:820px"><span class="c-label">04 &middot; Materials</span>
      <ul>{li(m['materials'])}</ul></div>
  </div>
</section>

<section class="th-dark" aria-label="Run of show">
  <div class="wrap">
    <div class="sec-head">
      <span class="eyebrow"><span class="tick" aria-hidden="true"></span><span class="mono">02 &middot; Run of show</span></span>
      <h2>Both paths, minute by <em class="s">minute</em>.</h2>
      <p>The Core column is what survives when you are behind. A blank means the section carries no time on that path.</p>
    </div>
    <!-- the table scrolls inside itself at narrow widths, so the container is
         focusable and named: a keyboard user can reach it and scroll it -->
    <div class="scroll-x" tabindex="0" role="region" aria-label="Run of show table, scrolls sideways on a narrow screen">
      <table class="runtable">
        <caption class="sr">Run of show: every section with its Full and Core minutes</caption>
        <thead><tr><th scope="col">#</th><th scope="col">Section</th>
          <th scope="col" class="num">Full</th><th scope="col" class="num">Core</th>
          <th scope="col">What Core changes</th></tr></thead>
        <tbody>{rows}</tbody>
        <tfoot><tr><td></td><td>Total</td>
          <td class="num">{m['paths']['full']}</td><td class="num">{m['paths']['core']}</td><td></td></tr></tfoot>
      </table>
    </div>
  </div>
</section>

<section class="th-light" aria-label="Section by section script">
  <div class="wrap">
    <div class="sec-head">
      <span class="eyebrow"><span class="tick" aria-hidden="true"></span><span class="mono">03 &middot; The script</span></span>
      <h2>Section by <em class="s">section</em>.</h2>
      <p>Say / Do / Ask / Debrief / Transition, in ATD order. The Say block is written so it can be read aloud as it stands.</p>
    </div>
    {"".join(blocks)}
  </div>
</section>

<section class="th-dark" aria-label="When things go sideways">
  <div class="wrap">
    <div class="sec-head">
      <span class="eyebrow"><span class="tick" aria-hidden="true"></span><span class="mono">04 &middot; When things go sideways</span></span>
      <h2>What to do <em class="s">instead</em>.</h2>
    </div>
    <div class="roadmap three">{conting}</div>
  </div>
</section>

<section class="th-light" aria-label="Tough questions">
  <div class="wrap">
    <div class="sec-head">
      <span class="eyebrow"><span class="tick" aria-hidden="true"></span><span class="mono">05 &middot; Tough questions</span></span>
      <h2>Answers you will <em class="s">need</em>.</h2>
      <p>Every one of these has come up. Read them before you teach, not during.</p>
    </div>
    <div class="roadmap three">{tough}</div>
  </div>
</section>

<section class="th-dark" aria-label="Copy and paste templates">
  <div class="wrap">
    <div class="sec-head">
      <span class="eyebrow"><span class="tick" aria-hidden="true"></span><span class="mono">06 &middot; Templates</span></span>
      <h2>Copy, paste, <em class="s">send</em>.</h2>
      <p><b>After the session.</b> {e(m['postSession'])}</p>
    </div>
    {templates}
  </div>
</section>
</main>
<script>
document.querySelectorAll('.copy-btn').forEach(function(b){{
  b.addEventListener('click', function(){{
    var src = document.getElementById(b.getAttribute('data-copy'));
    var label = b.querySelector('span');
    if(!src || !label) return;
    var orig = label.textContent;
    function done(msg){{ label.textContent = msg; setTimeout(function(){{ label.textContent = orig; }}, 1600); }}
    if(navigator.clipboard && navigator.clipboard.writeText){{
      navigator.clipboard.writeText(src.textContent).then(function(){{ done('Copied'); }},
        function(){{ done('Select and copy manually'); }});
    }} else {{ done('Select and copy manually'); }}
  }});
}});
</script>
</body>
</html>
"""
    OUT.write_text(page, encoding="utf-8")
    full = sum(s["minutes"] for s in d["sections"])
    core = sum(s["coreMinutes"] for s in d["sections"])
    print(f"wrote {OUT.relative_to(ROOT)}  ({len(page)/1024:.0f} KB, "
          f"{len(d['sections'])} sections, Full {full} min, Core {core} min)")


if __name__ == "__main__":
    build()
