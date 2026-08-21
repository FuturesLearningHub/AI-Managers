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

## Build

The two editions are generated; do not hand-edit `index.html` or
`classroom/index.html`. Edit `src/` and rebuild.

```
python3 tools/build.py
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

## Ship gates

Both must pass before publishing. Serve the site first:

```
python3 -m http.server 8765
```

```
python3 tools/contrast-check.py     # palette and contrast
node    tools/a11y-audit.mjs        # axe over every page, both widths
node    tools/interaction-test.mjs  # every module round-trips
```

**Last run: all three passed, August 2026.** 52 axe scans (2 editions x 13
pages x 1440x900 and 320px): zero critical, zero serious, no horizontal
scroll, clean console.

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
[me5231979/Course_Library](https://github.com/me5231979/Course_Library).
Brand assets are authorized-use Vanderbilt lockups and self-hosted brand faces.

An internal training prototype. Not an official Vanderbilt University site.
Program owner: Matt Estes.
