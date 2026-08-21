#!/usr/bin/env python3
"""Build both editions of Leading with AI from the sources in src/.

    python3 tools/build.py

Writes:
    index.html            self-paced edition, opens in mode "web"
    classroom/index.html  instructor-led edition, opens in mode "class"

The two editions are the same course. They differ only in which default mode
they open in, the asset path depth, the title, and the cross-link in the
footer. body[data-mode] does the rest, so the classroom-only layer (the QR
panel and the gold Together cards) never renders in the self-paced build.
"""
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT / "src"

SECTIONS = [
    "sec-01-hero.html",
    "sec-03-tools.html",
    "sec-04-anchors.html",
    "sec-05-clarity.html",
    "sec-06-coach.html",
    "sec-07-decide.html",
    "sec-08-hours.html",
    "sec-09-guardrails.html",
    "sec-11-check.html",
    "sec-13-sources.html",
]

BASE_URL = "me5231979.github.io/AI-Managers"

# The hero montage: three clips and a poster still, hosted on the CDN the
# library already streams from. Empty string = not yet hosted; the hero then
# stands on its black ground with no video layer (the js checks for https).
# Generated with Runway (stills: nano-banana-pro; motion: seedance-2), then
# imported to the program's media store; these URLs are permanent hosted
# copies, not the expiring Runway task URLs.
HERO_POSTER = "https://d2ol7oe51mr4n9.cloudfront.net/user_3CCurpI0FW75YAnAl4Hbz3vPdBv/21038734-9807-4b2c-a37d-3c25719ba0ac.png"
HERO_CLIPS = [
    # the team at work, manager standing
    "https://d2ol7oe51mr4n9.cloudfront.net/user_3CCurpI0FW75YAnAl4Hbz3vPdBv/b663e1b3-d357-413c-bb37-8d46559a383d.mp4",
    # the 1:1 coaching conversation
    "https://d2ol7oe51mr4n9.cloudfront.net/user_3CCurpI0FW75YAnAl4Hbz3vPdBv/65ed1df4-d219-467a-99b7-aa9e364874f6.mp4",
    # hands typing, notes, coffee
    "https://d2ol7oe51mr4n9.cloudfront.net/user_3CCurpI0FW75YAnAl4Hbz3vPdBv/be8b0512-940c-4770-b83f-3b36f354a24b.mp4",
]

EDITIONS = [
    {
        "out": "index.html",
        "assets": "assets",
        "mode": "web",
        "title": "Leading with AI (self-paced) · The CHART Program",
        "desc": ("Part of Vanderbilt's CHART Program: a 15-minute course for managers. "
                 "Choose the right tool, write clearer messages, prepare stronger coaching "
                 "conversations, test a decision before you make it, and install one habit."),
        "timechip": "About 15 minutes, self-paced",
        "otherhref": "classroom/",
        "othertext": "Use the classroom edition",
        "otherprompt": "Teaching this live?",
        "url": BASE_URL,
    },
    {
        "out": "classroom/index.html",
        "assets": "../assets",
        "mode": "class",
        "title": "Leading with AI (classroom) · The CHART Program",
        "desc": ("Part of Vanderbilt's CHART Program: the instructor-led edition of the "
                 "15-minute manager course, with a QR welcome, paired activities, and a "
                 "printable discussion-notes takeaway."),
        "timechip": "A live session, guided by your instructor",
        "otherhref": "../",
        "othertext": "Use the self-paced edition",
        "otherprompt": "Taking it on your own?",
        "url": BASE_URL + "/classroom",
    },
]


def read(name):
    return (SRC / name).read_text(encoding="utf-8")


def build(ed):
    css = read("base.css")
    body = "".join(read(s) for s in SECTIONS)
    page = (
        read("head.html")
        + body
        + read("footer.html")
        + "\n"
        + read("bookbar.html")
        + "<script>\n"
        + read("pager.js")
        + "</script>\n\n"
        + '<script src="{{A}}/js/qrcode.js"></script>\n'
        + "<script>\n"
        + "/* build-time constants: the edition's default mode and its own URL */\n"
        + 'var DEFAULT_MODE = "{{MODE}}";\n'
        + 'var COURSE_URL = "{{URL}}";\n'
        + read("app.js")
          .replace("__HERO_POSTER__", HERO_POSTER)
          .replace("__HERO_CLIP_1__", HERO_CLIPS[0])
          .replace("__HERO_CLIP_2__", HERO_CLIPS[1])
          .replace("__HERO_CLIP_3__", HERO_CLIPS[2])
        + "</script>\n</body>\n</html>\n"
    )
    page = page.replace("{{CSS}}", css)
    for token, key in [
        ("{{A}}", "assets"), ("{{MODE}}", "mode"), ("{{TITLE}}", "title"),
        ("{{DESC}}", "desc"), ("{{TIMECHIP}}", "timechip"),
        ("{{OTHERHREF}}", "otherhref"), ("{{OTHERTEXT}}", "othertext"),
        ("{{OTHERPROMPT}}", "otherprompt"), ("{{URL}}", "url"),
    ]:
        page = page.replace(token, ed[key])

    leftover = re.findall(r"\{\{[A-Z_]+\}\}", page)
    if leftover:
        sys.exit("unfilled placeholder(s): " + ", ".join(sorted(set(leftover))))

    out = ROOT / ed["out"]
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(page, encoding="utf-8")
    return out, len(page)


if __name__ == "__main__":
    for ed in EDITIONS:
        out, size = build(ed)
        print(f"wrote {out.relative_to(ROOT)}  ({size/1024:.0f} KB, mode={ed['mode']})")
