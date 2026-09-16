#!/usr/bin/env python3
"""Fetch a YouTube video's transcript as clean plain text.

Usage: fetch_transcript.py <youtube_url>

Writes JSON to stdout: { title, channel, duration, url, transcript }.
Exits non-zero with a stderr message on failure.
"""
import json
import os
import re
import subprocess
import sys
import tempfile
from pathlib import Path


def die(msg: str, code: int = 1) -> None:
    print(f"ERROR: {msg}", file=sys.stderr)
    sys.exit(code)


def run(cmd: list[str], **kw) -> subprocess.CompletedProcess:
    return subprocess.run(cmd, capture_output=True, text=True, **kw)


def get_metadata(url: str) -> dict:
    r = run(["yt-dlp", "--dump-json", "--skip-download", "--no-warnings", url])
    if r.returncode != 0:
        die(f"yt-dlp metadata failed: {r.stderr.strip()[:400]}")
    try:
        data = json.loads(r.stdout)
    except json.JSONDecodeError:
        die("yt-dlp returned non-JSON metadata")
    return {
        "title": data.get("title", "(unknown title)"),
        "channel": data.get("channel") or data.get("uploader") or "(unknown channel)",
        "duration": data.get("duration"),
        "url": data.get("webpage_url", url),
    }


def fetch_subs(url: str, outdir: Path) -> Path | None:
    base = outdir / "sub"
    for args in (
        # Prefer real (human) subtitles first.
        ["--write-sub", "--sub-lang", "en,en-US,en-GB"],
        # Fall back to auto-generated.
        ["--write-auto-sub", "--sub-lang", "en,en-US,en-GB,en-auto"],
    ):
        run([
            "yt-dlp",
            "--skip-download",
            "--sub-format", "vtt",
            *args,
            "--output", str(base) + ".%(ext)s",
            "--no-warnings",
            url,
        ])
        vtts = sorted(outdir.glob("sub*.vtt"))
        if vtts:
            return vtts[0]
    return None


TIMING_LINE = re.compile(r"^\d{2}:\d{2}:\d{2}\.\d{3}\s*-->")
INLINE_TAG = re.compile(r"<[^>]+>")


def parse_vtt(path: Path) -> str:
    """Collapse VTT captions into deduped, readable text."""
    lines_out: list[str] = []
    last = ""
    for raw in path.read_text(encoding="utf-8", errors="ignore").splitlines():
        line = raw.strip()
        if not line:
            continue
        if line in ("WEBVTT",) or line.startswith("Kind:") or line.startswith("Language:"):
            continue
        if TIMING_LINE.match(line):
            continue
        # Strip inline timing tags like <00:00:19.039><c> ... </c>
        clean = INLINE_TAG.sub("", line).strip()
        if not clean or clean == "[Music]":
            continue
        if clean == last:
            continue
        lines_out.append(clean)
        last = clean
    # Join into paragraph-ish blocks; periods stay as-is.
    text = " ".join(lines_out)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def main() -> None:
    if len(sys.argv) < 2 or not sys.argv[1].strip():
        die("usage: fetch_transcript.py <youtube_url>")
    url = sys.argv[1].strip()

    # Accept common sharing forms.
    if "youtube.com" not in url and "youtu.be" not in url:
        die(f"not a YouTube URL: {url}")

    meta = get_metadata(url)

    with tempfile.TemporaryDirectory() as tmp:
        outdir = Path(tmp)
        sub = fetch_subs(url, outdir)
        if sub is None:
            die("no English subtitles (human or auto) available for this video")
        transcript = parse_vtt(sub)

    if not transcript or len(transcript) < 40:
        die("transcript came back empty or too short")

    out = {
        **meta,
        "transcript": transcript,
        "word_count": len(transcript.split()),
    }
    json.dump(out, sys.stdout, ensure_ascii=False)


if __name__ == "__main__":
    main()
