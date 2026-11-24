# Leading with AI

A 15-minute web course for Vanderbilt managers. Part of the CHART Program
(Cultivating Human-AI Readiness and Thinking) and the Managers Voyage series.

Five short moves, one frame, three tools. Managers finish able to choose the
right tool for the moment, write clearer messages in half the time, prepare a
stronger coaching conversation, pressure-test a decision before making it, and
install one habit that gives time back.

## The two editions

Both are the same course, built from the same source.

| Edition | File | Opens in | Carries |
| --- | --- | --- | --- |
| Self-paced | `index.html` | mode `web` | Pause and reflect beats, the commitment note |
| Classroom | `classroom/index.html` | mode `class` | QR welcome panel, the gold Together cards, discussion-notes takeaway |

| Facilitator | `facilitator/index.html` | mode `class` | Everything the classroom edition has, plus a briefing page and a script rail on every page |

The facilitator edition **is** the course. It is the classroom build with the
Say / Do / Ask / Validate / Watch for / Transition script in a sticky rail
beside each page, so you teach from the same pages the room is looking at.
A Hide control folds the rail away when you want to project the page clean,
and the choice is remembered. `facilitator/guide.html` is the paper version:
the same script with each page pictured beside its notes.

`body[data-mode]` decides which `.mode-web` / `.mode-class` blocks render, on
screen and in the print takeaway. The bottom bar can switch modes, so a learner
who lands on the wrong edition is never stuck with the wrong instructions.

## Course spine

Thirteen pages. Five numbered teaching modules, plus the shell the pattern asks for.

1. Welcome
2. The Chancellor's charge
3. Which tool, which moment (60 seconds, with a three-case drill)
4. **Module 01** The four anchors: Authority, Purpose, Accountability, Truth
5. **Module 02** Clear communication: Role, Context, Task, Constraints, Format
6. **Module 03** Coaching prep: 1:1 preparation and feedback drafting
7. **Module 04** Sharper decisions: options, tradeoffs, and the premortem
8. **Module 05** Three habits: meeting recap, Friday triage, weekly synthesis
9. Guardrails, the four rules
10. Practice now, the learner's own prompt
11. Knowledge check, four questions
12. Recap and next steps
13. Appendix: nine cited sources and a plain-language glossary

## Interactive modules

Every teaching page has something to do, not just something to read.

- **Tool drill** (page 3) three cases, pick the tool, reasoning revealed, running score.
- **Anchor drill** (page 4) three near misses, name the anchor that would have caught it.
- **Prompt builder** (page 5) five fields, a live preview, three loadable worked scenarios, copy to clipboard.
- **Feedback drill** (page 6) two drafts came back; which one do you send.
- **Decision drill** (page 7) what to do with a confident recommendation, and what a premortem finding becomes.
- **Habit picker** (page 8) single choice; the pick drives the prompt block, the recap line, the printed takeaway, and the calendar reminder.
- **Practice builder** (page 10) the same builder, for something the learner actually owes someone.
- **Knowledge check** (page 11) four questions with scored feedback.

## The hero montage

The welcome page plays a three-clip ambient montage behind the live headline:
the team at work, a 1:1 coaching conversation, and hands typing, all in the
course's black and gold grade. Generated with Runway (stills with
nano-banana-pro, motion with seedance-2, 10s per clip, 1080p, no audio) and
hosted on the program's media CDN; the URLs live in `tools/build.py`.

The montage is strictly progressive enhancement, and
`tools/hero-montage-test.mjs` holds it to that:

- The title and value statement are live HTML over a scrim, never burned into
  the video, so contrast, brand type, and screen readers are unaffected.
- Nothing is fetched until the welcome page is the visible page; leaving the
  page pauses it; a visible chip pauses and resumes it (WCAG 2.2.2).
- `prefers-reduced-motion` swaps the motion for the still.
- An unreachable CDN (an embedded viewer, an offline room) leaves the black
  hero exactly as designed, with no errors and no half-loaded layers.

## Build

The two editions are generated; do not hand-edit `index.html` or
`classroom/index.html`. Edit `src/` and rebuild.

```
python3 tools/build.py              # the two editions
python3 tools/build-facilitator.py  # the facilitator runbook
```

| Source | What it is |
| --- | --- |
| `src/head.html` | Head, fonts, nav, mobile menu |
| `src/base.css` | The full brand system and every component |
| `src/sec-*.html` | One file per section, in course order |
| `src/footer.html` | Footer and the printable one-page takeaway |
| `src/bookbar.html` | Bottom book bar and the page-change live region |
| `src/pager.js` | Book mode: the scroll page becomes turnable pages |
| `src/app.js` | Every interaction, progress, storage, print, calendar |
| `facilitator/notes.json` | The facilitator content: prep, run of show, and Say / Do / Ask / Validate / Transition per section |
| `facilitator/img/` | One image per page, for the printable guide. Re-shoot after any visual change |

## The facilitator edition

Generated from `facilitator/notes.json` and the classroom build. Edit the JSON
or the course sources, never `facilitator/index.html`.

```
python3 tools/build.py              # the learner editions first
node    tools/shoot-slides.mjs      # page images for the printable guide
python3 tools/build-facilitator.py  # the facilitator edition and the guide
```

Two paths, and the generator refuses to build if either is wrong:

| Path | Length | What it cuts |
| --- | --- | --- |
| Full | 45 minutes | Nothing |
| Core | 30 minutes | The knowledge check, one drill per module, the second paired activity |

The commitment round in Module 05 is never cut on either path. It is the only
part that changes anyone's week, and it is the program's Kirkpatrick Level 3
measure.

`tools/build-facilitator.py` validates before it writes: per-section minutes
must sum exactly to each advertised path, `totalMinutes` must agree, every
section id must exist as a page in the course, and no string anywhere in the
notes may contain an em or en dash.

The welcome QR in the facilitator edition encodes the **learner** URL, never
its own. A room that scans it lands on the classroom edition.

## Ship gates

Both must pass before publishing. Serve the site first:

```
python3 -m http.server 8765
```

```
python3 tools/contrast-check.py       # palette and contrast
node    tools/a11y-audit.mjs          # axe over every page, both widths
node    tools/interaction-test.mjs    # every module round-trips
node    tools/hero-montage-test.mjs   # the hero video behaves, and fails safe
```

**Last run: all three passed, August 2026.** 82 axe scans (3 editions across
every page, at 1440x900 and 320px, plus the printable guide): zero critical,
zero serious, no horizontal scroll, clean console. The interaction suite runs
58 checks across all three editions.

`tools/inline.py` folds an edition into a single self-contained file with the
fonts and lockups as data URIs, for hosting somewhere with no sibling asset
directory. Add `--fragment` to emit page content only, for a host that
supplies its own document skeleton.

### What the gates enforce

- **Palette.** Only the approved Vanderbilt FLH colors. Gold `#CFAE70` carries accents on black; Oak `#946E24` carries them on white, because gold measures 2.11:1 on a white ground. Oak measures 4.20:1 on cream, so cream is never a ground in this course, only a fill behind VU Black. Brand tints are scoped to the dark ground for the same reason. There is no approved red, so a wrong answer is marked with a word ("Not this one") and a dashed edge, never with color.
- **Component discipline.** Anything that can appear in either theme scope resolves color through `--tx` / `--eyebrow` / `--acc` / `--link`, never a raw `--vu-*` token. Permanently-dark chrome (hero, menu, footer, book bar) is exempt and measured directly.
- **Accessibility.** WCAG 2.2 AA. Keyboard reachable throughout, non-current pages are `inert` so Tab cannot enter them, page changes announce through a polite live region, scrollable pages join the tab order, motion respects `prefers-reduced-motion`, and the layout reflows to 320px and 200% zoom with no horizontal scrolling.

## What the course stores

Six kinds of thing, all `leading-*` keys in the learner's own browser, none of
it ever sent anywhere:

- which pages were marked done
- the last page open
- the mode (class or web)
- the habit picked in Module 05
- the five prompt-builder fields, twice (Module 02 and Practice)
- the commitment note

Reset in the footer clears all of it. Quiz answers are never stored.

## Copy rules

- Zero em or en dashes anywhere: HTML, JS strings, CSS comments.
- Headlines italicize exactly one word and end with a period.
- Unnamed people in scenarios are they/them.
- Every claim carries a cited, linked source with a named author and a year. Where a number is this course's own estimate rather than a research finding (the two hours a week), the page says so.
- Every technical term is explained on first use and again in the glossary.

## Data rule

One rule, stated the same way everywhere in the course:

> Data classification decides. Level 4, PHI, and HIPAA data go into none of
> these tools, information about children goes into none of them either, and
> when you are unsure, it goes to Amplify.

Where this course and Vanderbilt's official policy pages differ, the policy
pages are correct. See `#src2` in the appendix.

## Credits

Built on the Working Smarter pattern from
[FuturesLearningHub/FLH-Learning-Library-](https://github.com/FuturesLearningHub/FLH-Learning-Library-).
Brand assets are authorized-use Vanderbilt lockups and self-hosted brand faces.

An internal training prototype. Not an official Vanderbilt University site.
Program owner: Matt Estes.
