#!/usr/bin/env python3
"""Fold a built edition into one self-contained file.

    python3 tools/inline.py index.html <out.html>

The published page is served from a single origin with no sibling asset
directory, so the fonts, the two lockups, and the QR library are embedded as
data URIs. Only the assets the page actually references are carried, so the
result stays well under the size cap.
"""
import base64
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
MIME = {".woff2": "font/woff2", ".png": "image/png", ".svg": "image/svg+xml"}


def data_uri(path):
    b = path.read_bytes()
    return f"data:{MIME[path.suffix]};base64," + base64.b64encode(b).decode("ascii")


def main(src, dst, fragment=False):
    html = (ROOT / src).read_text(encoding="utf-8")

    # every assets/... reference, whatever the depth prefix
    # anchored on a real asset extension, so a prose mention of "assets/." in
    # the header comment is not mistaken for a file
    refs = sorted(set(re.findall(
        r"(?:\.\./)?assets/[A-Za-z0-9@._/-]+?\.(?:woff2|png|svg|js)\b", html)))
    embedded = 0
    for ref in refs:
        rel = ref[3:] if ref.startswith("../") else ref
        path = ROOT / rel
        if not path.is_file() or path.suffix == ".js":
            continue
        html = html.replace(ref, data_uri(path))
        embedded += 1

    # the QR library becomes an inline script
    qr = (ROOT / "assets/js/qrcode.js").read_text(encoding="utf-8")
    inline_qr = ("<script>\n/* qrcode.js, inlined: the published page has no sibling "
                 "asset directory */\n" + qr.replace("</script>", "<\\/script>") + "\n</script>")
    html = re.sub(r'<script src="(?:\.\./)?assets/js/qrcode\.js"></script>',
                  lambda _m: inline_qr, html)

    leftovers = re.findall(
        r"(?:\.\./)?assets/[A-Za-z0-9@._/-]+?\.(?:woff2|png|svg|js)\b", html)
    if leftovers:
        sys.exit("assets left unresolved: " + ", ".join(sorted(set(leftovers))))

    if fragment:
        # The Artifact host supplies its own <!doctype>/<head>/<body>, so the
        # published file carries page content only: the title, the stylesheet,
        # and everything that lived inside <body>.
        title = re.search(r"<title>(.*?)</title>", html, re.S).group(1)
        style = re.search(r"<style>.*?</style>", html, re.S).group(0)
        body = re.search(r"<body>(.*)</body>", html, re.S).group(1)
        boot = ('<script>document.documentElement.classList.add("js","paged");'
                "/* arms book mode; the pager removes it if it cannot build */</script>")
        html = f"<title>{title}</title>\n{style}\n{boot}\n{body}\n"

    out = ROOT / dst
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(html, encoding="utf-8")
    print(f"{dst}: {len(html)/1024/1024:.2f} MB, {embedded} asset(s) embedded, qrcode.js inlined")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2], "--fragment" in sys.argv)
