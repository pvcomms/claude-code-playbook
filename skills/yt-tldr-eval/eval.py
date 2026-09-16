#!/usr/bin/env -S uv run --script --quiet
# /// script
# requires-python = ">=3.11"
# dependencies = [
#   "anthropic>=0.40",
#   "openai>=1.50",
#   "google-generativeai>=0.8",
# ]
# ///
"""yt-tldr-eval: multi-model YouTube summarization bake-off.

For each video:
  1. Fetch transcript via yt-dlp
  2. Generate TLDR via Opus 4.7, Sonnet 4.6, Haiku 4.5, GPT-5, Gemini 2.5 Pro
  3. Judge each summary with Opus 4.7 on faithfulness / compression / coverage / style
Aggregate into a leaderboard report.

Everything is resumable: transcripts, summaries, and scores are checkpointed to
disk so a crash just restarts from the last completed artifact.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys
import tempfile
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any


# ---------------------------------------------------------------------------
# env loading (same pattern as eval-this)
# ---------------------------------------------------------------------------
def _load_env_file(path: Path) -> None:
    if not path.exists():
        return
    for line in path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        if line.startswith("export "):
            line = line[len("export ") :]
        if "=" not in line:
            continue
        k, v = line.split("=", 1)
        v = v.strip().strip("'").strip('"')
        os.environ.setdefault(k.strip(), v)


_load_env_file(Path.home() / ".config" / "inbox-triage.env")


# ---------------------------------------------------------------------------
# constants
# ---------------------------------------------------------------------------
PRICING = {
    "claude-opus-4-7": (15.0, 75.0),
    "claude-sonnet-4-6": (3.0, 15.0),
    "claude-haiku-4-5-20251001": (1.0, 5.0),
    "gpt-5": (1.25, 10.0),
    "gemini-2.5-pro": (1.25, 10.0),
}

MODEL_SHORT = {
    "claude-opus-4-7": "opus",
    "claude-sonnet-4-6": "sonnet",
    "claude-haiku-4-5-20251001": "haiku",
    "gpt-5": "gpt",
    "gemini-2.5-pro": "gemini",
}

DEFAULT_MODELS = list(PRICING.keys())

JUDGE_MODEL = "claude-haiku-4-5-20251001"

TLDR_SYSTEM = (
    "You are a tight, intelligent summarizer. You condense YouTube transcripts "
    "without losing content or inventing claims. Preserve numbers and named entities. "
    "No preamble. No meta-commentary. No hedging filler."
)

TLDR_TEMPLATE = """Produce a digest of this YouTube transcript in exactly this structure:

**{title}** — {channel} · {duration}

### TL;DR
<1-2 sentences. The single sharpest takeaway. No hedging.>

### ELI5
<2-4 sentences in plain language. Use a concrete analogy if abstract. No jargon.>

### Summary
<5-9 bullets tracing the video's arc. Each bullet = one idea, <=20 words. Preserve speaker claims and numbers. Do not editorialize.>

### Key takeaways
<3-5 bullets: what to remember / what to do. Actionable > descriptive.>

### Worth watching?
<One line. Who should watch vs. who can stop here. Honest — flag padding or shallowness.>

Transcript:
<<<
{transcript}
>>>"""

JUDGE_SYSTEM = (
    "You are a rigorous evaluator of AI-generated video summaries. "
    "You have the transcript as ground truth. Score faithfulness first. "
    "Return ONLY a JSON object. No prose, no markdown fences."
)

JUDGE_TEMPLATE = """Evaluate this summary of a YouTube video. You have the full transcript.

Score on 4 integer dimensions (1-10):

- faithfulness: does the summary accurately represent the transcript? Penalize any claim in the summary not supported by the transcript. Penalize missing critical content. 10 = zero hallucination, all load-bearing points covered. 1 = heavily fabricated.
- compression: is it well-condensed? Does it hit the signal and drop the noise? 10 = ruthlessly sharp. 1 = bloated filler or so terse it's useless.
- coverage: does it follow the video's actual arc? Does it catch the key numbers, named entities, and turning points? 10 = complete. 1 = misses half the video.
- style: is the prose crisp and non-generic? Does it follow the requested structure? 10 = excellent craft. 1 = slop.

Also return:
- hallucinations: array of strings naming each invented or unsupported claim (empty [] if none)
- missed: array of 0-3 short strings naming key points the summary dropped
- verdict: <=15-word character sketch of this summary

TRANSCRIPT (ground truth):
<<<
{transcript}
>>>

SUMMARY (from {model}):
<<<
{summary}
>>>

Output exactly:
{{"faithfulness": N, "compression": N, "coverage": N, "style": N, "hallucinations": [...], "missed": [...], "verdict": "..."}}"""


# ---------------------------------------------------------------------------
# dataclasses
# ---------------------------------------------------------------------------
@dataclass
class Video:
    id: str
    url: str
    title: str = ""
    channel: str = ""
    duration: int | None = None  # seconds
    transcript: str = ""
    word_count: int = 0
    error: str | None = None


@dataclass
class Summary:
    video_id: str
    model: str
    output: str = ""
    latency_s: float = 0.0
    input_tokens: int = 0
    output_tokens: int = 0
    cost_usd: float = 0.0
    error: str | None = None
    scores: dict = field(default_factory=dict)
    judge_latency_s: float = 0.0
    judge_cost_usd: float = 0.0


# ---------------------------------------------------------------------------
# transcript fetching (inline so this script stays self-contained)
# ---------------------------------------------------------------------------
TIMING_LINE = re.compile(r"^\d{2}:\d{2}:\d{2}\.\d{3}\s*-->")
INLINE_TAG = re.compile(r"<[^>]+>")
YT_ID = re.compile(r"(?:v=|/shorts/|/live/|/embed/|youtu\.be/)([A-Za-z0-9_-]{11})")


def extract_video_id(url: str) -> str | None:
    m = YT_ID.search(url)
    return m.group(1) if m else None


def fmt_duration(secs: int | None) -> str:
    if not secs:
        return "?"
    h, rem = divmod(secs, 3600)
    m, s = divmod(rem, 60)
    return f"{h}:{m:02d}:{s:02d}" if h else f"{m}:{s:02d}"


def parse_vtt(path: Path) -> str:
    out: list[str] = []
    last = ""
    for raw in path.read_text(encoding="utf-8", errors="ignore").splitlines():
        line = raw.strip()
        if not line or line == "WEBVTT" or line.startswith(("Kind:", "Language:")):
            continue
        if TIMING_LINE.match(line):
            continue
        clean = INLINE_TAG.sub("", line).strip()
        if not clean or clean == "[Music]":
            continue
        if clean == last:
            continue
        out.append(clean)
        last = clean
    return re.sub(r"\s+", " ", " ".join(out)).strip()


def fetch_transcript(url: str, log) -> Video:
    vid_id = extract_video_id(url) or url.split("/")[-1][:11]
    v = Video(id=vid_id, url=url)

    # Metadata
    r = subprocess.run(
        ["yt-dlp", "--dump-json", "--skip-download", "--no-warnings", url],
        capture_output=True, text=True,
    )
    if r.returncode != 0:
        v.error = f"metadata: {r.stderr.strip()[:200]}"
        log(f"  [meta-fail] {vid_id}: {v.error}")
        return v
    try:
        md = json.loads(r.stdout)
    except json.JSONDecodeError:
        v.error = "metadata JSON parse failed"
        return v
    v.title = md.get("title", "(unknown)")
    v.channel = md.get("channel") or md.get("uploader") or "(unknown)"
    v.duration = md.get("duration")

    # Subtitles
    with tempfile.TemporaryDirectory() as tmp:
        outdir = Path(tmp)
        base = outdir / "sub"
        for args in (
            ["--write-sub", "--sub-lang", "en,en-US,en-GB"],
            ["--write-auto-sub", "--sub-lang", "en,en-US,en-GB,en-auto"],
        ):
            subprocess.run(
                ["yt-dlp", "--skip-download", "--sub-format", "vtt",
                 *args, "--output", str(base) + ".%(ext)s",
                 "--no-warnings", url],
                capture_output=True, text=True,
            )
            vtts = sorted(outdir.glob("sub*.vtt"))
            if vtts:
                v.transcript = parse_vtt(vtts[0])
                break
    if not v.transcript or len(v.transcript) < 80:
        v.error = "no usable English transcript"
        return v
    v.word_count = len(v.transcript.split())
    return v


# ---------------------------------------------------------------------------
# model dispatch
# ---------------------------------------------------------------------------
def _cost(model: str, in_tok: int, out_tok: int) -> float:
    if model not in PRICING:
        return 0.0
    ip, op = PRICING[model]
    return (in_tok * ip + out_tok * op) / 1_000_000


def _truncate_transcript(t: str, max_words: int) -> str:
    words = t.split()
    if len(words) <= max_words:
        return t
    head = words[: max_words * 2 // 3]
    tail = words[-max_words // 3 :]
    return " ".join(head) + " [...TRUNCATED...] " + " ".join(tail)


def call_anthropic(model: str, prompt: str) -> tuple[str, int, int, float, str | None]:
    import anthropic
    if not os.environ.get("ANTHROPIC_API_KEY"):
        return "", 0, 0, 0.0, "no ANTHROPIC_API_KEY"
    client = anthropic.Anthropic()
    start = time.time()
    try:
        resp = client.messages.create(
            model=model,
            max_tokens=1500,
            system=TLDR_SYSTEM,
            messages=[{"role": "user", "content": prompt}],
        )
        text = "".join(b.text for b in resp.content if getattr(b, "type", None) == "text")
        return text, resp.usage.input_tokens, resp.usage.output_tokens, time.time() - start, None
    except Exception as e:
        return "", 0, 0, time.time() - start, str(e)[:200]


def call_openai(prompt: str) -> tuple[str, int, int, float, str | None]:
    from openai import OpenAI
    if not os.environ.get("OPENAI_API_KEY"):
        return "", 0, 0, 0.0, "no OPENAI_API_KEY"
    client = OpenAI()
    start = time.time()
    try:
        resp = client.chat.completions.create(
            model="gpt-5",
            max_completion_tokens=6000,
            messages=[
                {"role": "system", "content": TLDR_SYSTEM},
                {"role": "user", "content": prompt},
            ],
        )
        text = resp.choices[0].message.content or ""
        return text, resp.usage.prompt_tokens, resp.usage.completion_tokens, time.time() - start, None
    except Exception as e:
        return "", 0, 0, time.time() - start, str(e)[:200]


def call_gemini(prompt: str) -> tuple[str, int, int, float, str | None]:
    import google.generativeai as genai
    api_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
    if not api_key:
        return "", 0, 0, 0.0, "no GEMINI_API_KEY"
    genai.configure(api_key=api_key)
    start = time.time()
    try:
        gm = genai.GenerativeModel("gemini-2.5-pro", system_instruction=TLDR_SYSTEM)
        resp = gm.generate_content(prompt)
        um = resp.usage_metadata
        return resp.text or "", um.prompt_token_count, um.candidates_token_count, time.time() - start, None
    except Exception as e:
        return "", 0, 0, time.time() - start, str(e)[:200]


def dispatch_summary(model: str, video: Video) -> Summary:
    # Tight cap: 5k words (~6.5k tokens) to bound cost. Truncation marker in place for long vids.
    transcript = _truncate_transcript(video.transcript, 5000)
    prompt = TLDR_TEMPLATE.format(
        title=video.title,
        channel=video.channel,
        duration=fmt_duration(video.duration),
        transcript=transcript,
    )
    s = Summary(video_id=video.id, model=model)
    if model == "gpt-5":
        out, in_tok, out_tok, lat, err = call_openai(prompt)
    elif model == "gemini-2.5-pro":
        out, in_tok, out_tok, lat, err = call_gemini(prompt)
    else:
        out, in_tok, out_tok, lat, err = call_anthropic(model, prompt)
    s.output = out
    s.input_tokens = in_tok
    s.output_tokens = out_tok
    s.latency_s = lat
    s.error = err
    s.cost_usd = _cost(model, in_tok, out_tok)
    return s


# ---------------------------------------------------------------------------
# judge
# ---------------------------------------------------------------------------
def _extract_json(text: str) -> dict:
    text = text.strip()
    text = re.sub(r"^```(?:json)?\s*", "", text)
    text = re.sub(r"\s*```$", "", text)
    m = re.search(r"\{.*\}", text, re.DOTALL)
    if not m:
        raise ValueError("no JSON object in judge output")
    return json.loads(m.group(0))


def judge(video: Video, s: Summary) -> None:
    if s.error or not s.output.strip():
        return
    if not os.environ.get("ANTHROPIC_API_KEY"):
        s.scores = {"error": "no ANTHROPIC_API_KEY for judge"}
        return
    import anthropic
    client = anthropic.Anthropic()
    # Cap transcript for judge to 3k words — tight budget mode
    transcript = _truncate_transcript(video.transcript, 3000)
    start = time.time()
    try:
        resp = client.messages.create(
            model=JUDGE_MODEL,
            max_tokens=800,
            system=JUDGE_SYSTEM,
            messages=[{
                "role": "user",
                "content": JUDGE_TEMPLATE.format(
                    transcript=transcript,
                    model=s.model,
                    summary=s.output[:8000],
                ),
            }],
        )
        text = "".join(b.text for b in resp.content if getattr(b, "type", None) == "text")
        s.scores = _extract_json(text)
        s.judge_cost_usd = _cost(JUDGE_MODEL, resp.usage.input_tokens, resp.usage.output_tokens)
    except Exception as e:
        s.scores = {"error": str(e)[:200]}
    s.judge_latency_s = time.time() - start


# ---------------------------------------------------------------------------
# orchestration — resumable on disk
# ---------------------------------------------------------------------------
def make_logger(path: Path):
    def log(msg: str) -> None:
        stamp = time.strftime("%H:%M:%S")
        line = f"[{stamp}] {msg}"
        print(line, flush=True)
        with path.open("a") as f:
            f.write(line + "\n")
    return log


def load_videos(path: Path) -> list[str]:
    data = json.loads(path.read_text())
    if isinstance(data, list):
        return [x if isinstance(x, str) else x["url"] for x in data]
    if isinstance(data, dict) and "videos" in data:
        return [x if isinstance(x, str) else x["url"] for x in data["videos"]]
    raise ValueError("videos.json must be a list or {videos: [...]}")


def load_or_fetch_transcript(url: str, tdir: Path, log) -> Video:
    vid_id = extract_video_id(url)
    if not vid_id:
        v = Video(id="invalid", url=url, error="could not extract video id")
        return v
    path = tdir / f"{vid_id}.json"
    if path.exists():
        d = json.loads(path.read_text())
        return Video(**d)
    v = fetch_transcript(url, log)
    path.write_text(json.dumps(v.__dict__, ensure_ascii=False))
    return v


def load_or_generate_summary(video: Video, model: str, sdir: Path) -> Summary:
    path = sdir / f"{video.id}__{MODEL_SHORT[model]}.json"
    if path.exists():
        d = json.loads(path.read_text())
        cached = Summary(**d)
        # Retry cached errors on re-run — only the successful summaries stay pinned.
        if not cached.error and cached.output.strip():
            return cached
    s = dispatch_summary(model, video)
    if not s.error and s.output.strip():
        path.write_text(json.dumps(s.__dict__, ensure_ascii=False))
    return s


def load_or_judge(video: Video, s: Summary, jdir: Path) -> Summary:
    path = jdir / f"{video.id}__{MODEL_SHORT[s.model]}.json"
    if path.exists():
        d = json.loads(path.read_text())
        s.scores = d.get("scores", {})
        s.judge_latency_s = d.get("judge_latency_s", 0.0)
        s.judge_cost_usd = d.get("judge_cost_usd", 0.0)
        return s
    if s.error or not s.output.strip() or not video.transcript:
        return s
    judge(video, s)
    path.write_text(json.dumps({
        "scores": s.scores,
        "judge_latency_s": s.judge_latency_s,
        "judge_cost_usd": s.judge_cost_usd,
    }, ensure_ascii=False))
    return s


# ---------------------------------------------------------------------------
# reporting
# ---------------------------------------------------------------------------
def _avg(vals: list[float]) -> float:
    return sum(vals) / len(vals) if vals else 0.0


def aggregate(summaries: list[Summary], videos: dict[str, Video]) -> dict:
    by_model: dict[str, list[Summary]] = {}
    for s in summaries:
        by_model.setdefault(s.model, []).append(s)

    per_model = {}
    for model, rs in by_model.items():
        good = [r for r in rs if not r.error and r.output.strip() and not r.scores.get("error")]
        per_model[model] = {
            "n_total": len(rs),
            "n_ok": len(good),
            "n_error": sum(1 for r in rs if r.error),
            "n_judge_err": sum(1 for r in rs if not r.error and r.scores.get("error")),
            "faithfulness": _avg([r.scores.get("faithfulness", 0) for r in good if "faithfulness" in r.scores]),
            "compression":  _avg([r.scores.get("compression",  0) for r in good if "compression"  in r.scores]),
            "coverage":     _avg([r.scores.get("coverage",     0) for r in good if "coverage"     in r.scores]),
            "style":        _avg([r.scores.get("style",        0) for r in good if "style"        in r.scores]),
            "latency":      _avg([r.latency_s for r in good]),
            "tokens_in":    _avg([r.input_tokens for r in good]),
            "tokens_out":   _avg([r.output_tokens for r in good]),
            "cost":         sum(r.cost_usd for r in rs),
            "judge_cost":   sum(r.judge_cost_usd for r in rs),
            "halluc_per":   _avg([len(r.scores.get("hallucinations", [])) for r in good]),
            "missed_per":   _avg([len(r.scores.get("missed", [])) for r in good]),
        }
        per_model[model]["avg"] = _avg([
            per_model[model]["faithfulness"],
            per_model[model]["compression"],
            per_model[model]["coverage"],
            per_model[model]["style"],
        ])
    return per_model


def render_report(per_model: dict, videos: dict[str, Video], summaries: list[Summary], out_dir: Path) -> str:
    lines = ["# yt-tldr-eval — results\n"]
    lines.append(f"Videos processed: **{len(videos)}**  ·  Models: **{len(per_model)}**  ·  Judge: `{JUDGE_MODEL}`\n")

    # Main leaderboard
    lines.append("## Leaderboard (Claude-as-judge)\n")
    lines.append("| Model | Faith | Compr | Cover | Style | Avg | Halluc/vid | Missed/vid | Latency | Tok in/out | Cost |")
    lines.append("|-------|-------|-------|-------|-------|-----|------------|------------|---------|------------|------|")
    sorted_models = sorted(per_model.items(), key=lambda kv: -kv[1]["avg"])
    for model, m in sorted_models:
        short = MODEL_SHORT.get(model, model)
        lines.append(
            f"| {short} | {m['faithfulness']:.2f} | {m['compression']:.2f} | "
            f"{m['coverage']:.2f} | {m['style']:.2f} | **{m['avg']:.2f}** | "
            f"{m['halluc_per']:.2f} | {m['missed_per']:.2f} | "
            f"{m['latency']:.1f}s | {m['tokens_in']:.0f}/{m['tokens_out']:.0f} | "
            f"${m['cost']:.2f} |"
        )

    # Error accounting
    lines.append("\n## Reliability\n")
    lines.append("| Model | OK | Model err | Judge err |")
    lines.append("|-------|----|-----------|-----------|")
    for model, m in sorted_models:
        short = MODEL_SHORT.get(model, model)
        lines.append(f"| {short} | {m['n_ok']}/{m['n_total']} | {m['n_error']} | {m['n_judge_err']} |")

    # Cost
    total_model = sum(m["cost"] for m in per_model.values())
    total_judge = sum(m["judge_cost"] for m in per_model.values())
    lines.append(f"\n**Total model cost:** ${total_model:.2f}  ·  **Judge cost:** ${total_judge:.2f}  ·  **Grand total:** ${total_model + total_judge:.2f}\n")

    # Duration-bucket breakdown (short <10m, medium 10-40m, long >40m)
    buckets = {"short (<10m)": [], "medium (10-40m)": [], "long (>40m)": []}
    for s in summaries:
        v = videos.get(s.video_id)
        if not v or not v.duration:
            continue
        if s.error or s.scores.get("error") or not s.scores:
            continue
        d = v.duration
        key = "short (<10m)" if d < 600 else "medium (10-40m)" if d < 2400 else "long (>40m)"
        buckets[key].append(s)

    lines.append("## Faithfulness by video length\n")
    lines.append("| Model | " + " | ".join(buckets.keys()) + " |")
    lines.append("|-------|" + "|".join(["---"] * len(buckets)) + "|")
    for model, _ in sorted_models:
        short = MODEL_SHORT.get(model, model)
        row = [short]
        for bk, bs in buckets.items():
            vals = [s.scores.get("faithfulness", 0) for s in bs if s.model == model and "faithfulness" in s.scores]
            row.append(f"{_avg(vals):.2f}" if vals else "—")
        lines.append("| " + " | ".join(row) + " |")

    # Hallucination samples
    lines.append("\n## Sample hallucinations flagged by judge\n")
    count = 0
    for s in sorted(summaries, key=lambda x: -len(x.scores.get("hallucinations", []))):
        halls = s.scores.get("hallucinations", [])
        if not halls:
            break
        v = videos.get(s.video_id)
        if not v:
            continue
        lines.append(f"\n**{MODEL_SHORT.get(s.model, s.model)}** — *{v.title[:70]}* ({v.channel})")
        for h in halls[:3]:
            lines.append(f"- {h}")
        count += 1
        if count >= 12:
            break

    # Per-video score table (compact)
    lines.append("\n## Per-video faithfulness (first 40)\n")
    lines.append("| Video | " + " | ".join(MODEL_SHORT[m] for m, _ in sorted_models) + " |")
    lines.append("|-------|" + "|".join(["---"] * len(sorted_models)) + "|")
    seen = 0
    for vid, v in videos.items():
        if not v.transcript or v.error:
            continue
        row = [f"{v.title[:50]}"]
        for model, _ in sorted_models:
            hit = next((s for s in summaries if s.video_id == vid and s.model == model), None)
            f = hit.scores.get("faithfulness") if hit and hit.scores and "faithfulness" in hit.scores else None
            row.append(str(f) if f is not None else "—")
        lines.append("| " + " | ".join(row) + " |")
        seen += 1
        if seen >= 40:
            break

    return "\n".join(lines) + "\n"


# ---------------------------------------------------------------------------
# main
# ---------------------------------------------------------------------------
def main() -> int:
    ap = argparse.ArgumentParser(description="Multi-model YouTube summarization bake-off")
    ap.add_argument("--videos", required=True, help="Path to videos.json (list of URLs or {videos:[...]})")
    ap.add_argument("--out", required=True, help="Output dir for transcripts/summaries/scores/report")
    ap.add_argument("--limit", type=int, help="Cap N videos (for smoke tests)")
    ap.add_argument("--models", help="Comma-separated short names (opus,sonnet,haiku,gpt,gemini)")
    ap.add_argument("--skip-judge", action="store_true")
    ap.add_argument("--transcripts-only", action="store_true", help="Phase 1 only: fetch all transcripts and stop")
    ap.add_argument("--transcript-workers", type=int, default=4)
    ap.add_argument("--summary-workers", type=int, default=5)
    ap.add_argument("--judge-workers", type=int, default=5)
    args = ap.parse_args()

    out = Path(args.out).expanduser()
    tdir = out / "transcripts"
    sdir = out / "summaries"
    jdir = out / "scores"
    for d in (out, tdir, sdir, jdir):
        d.mkdir(parents=True, exist_ok=True)
    log = make_logger(out / "run.log")

    urls = load_videos(Path(args.videos).expanduser())
    if args.limit:
        urls = urls[: args.limit]
    log(f"loaded {len(urls)} videos from {args.videos}")

    if args.models:
        short_to_full = {v: k for k, v in MODEL_SHORT.items()}
        models = [short_to_full[m.strip()] for m in args.models.split(",") if m.strip() in short_to_full]
    else:
        models = list(DEFAULT_MODELS)
    log(f"models: {[MODEL_SHORT[m] for m in models]}")

    # Phase 1: transcripts
    log(f"=== Phase 1: transcripts ({args.transcript_workers} workers) ===")
    videos: dict[str, Video] = {}
    with ThreadPoolExecutor(max_workers=args.transcript_workers) as ex:
        futures = {ex.submit(load_or_fetch_transcript, u, tdir, log): u for u in urls}
        for i, fut in enumerate(as_completed(futures), 1):
            v = fut.result()
            videos[v.id] = v
            status = "ERROR" if v.error else f"{v.word_count}w"
            log(f"  [{i}/{len(urls)}] {v.id} {status} — {v.title[:60]}")

    usable = {vid: v for vid, v in videos.items() if v.transcript and not v.error}
    log(f"transcripts ok: {len(usable)}/{len(videos)}")

    # Phase 2: summaries
    log(f"=== Phase 2: summaries ({args.summary_workers} workers × {len(models)} models) ===")
    summaries: list[Summary] = []
    jobs = [(v, m) for v in usable.values() for m in models]
    with ThreadPoolExecutor(max_workers=args.summary_workers) as ex:
        futures = {ex.submit(load_or_generate_summary, v, m, sdir): (v, m) for v, m in jobs}
        for i, fut in enumerate(as_completed(futures), 1):
            s = fut.result()
            summaries.append(s)
            tag = "ERROR" if s.error else f"{s.output_tokens}tok ${s.cost_usd:.3f}"
            if i % 10 == 0 or i == len(jobs):
                log(f"  [{i}/{len(jobs)}] {s.video_id} {MODEL_SHORT[s.model]} {tag}")

    # Phase 3: judge
    if not args.skip_judge:
        log(f"=== Phase 3: judge ({args.judge_workers} workers) ===")
        scorable = [s for s in summaries if not s.error and s.output.strip()]
        with ThreadPoolExecutor(max_workers=args.judge_workers) as ex:
            futures = {ex.submit(load_or_judge, usable[s.video_id], s, jdir): s for s in scorable if s.video_id in usable}
            for i, fut in enumerate(as_completed(futures), 1):
                s = fut.result()
                sc = s.scores
                tag = f"err={sc['error']}" if "error" in sc else f"F{sc.get('faithfulness','-')}/C{sc.get('compression','-')}/Cv{sc.get('coverage','-')}/S{sc.get('style','-')}"
                if i % 25 == 0 or i == len(futures):
                    log(f"  [{i}/{len(futures)}] {s.video_id} {MODEL_SHORT[s.model]} {tag}")

    # Phase 4: report
    log("=== Phase 4: aggregating ===")
    per_model = aggregate(summaries, videos)
    report = render_report(per_model, usable, summaries, out)
    (out / "report.md").write_text(report)
    (out / "summary.json").write_text(json.dumps({
        "per_model": {
            m: {k: (v if not isinstance(v, float) else round(v, 4)) for k, v in d.items()}
            for m, d in per_model.items()
        },
        "n_videos": len(usable),
        "n_summaries": len(summaries),
    }, indent=2))

    log(f"report written: {out / 'report.md'}")
    print("\n" + report)
    return 0


if __name__ == "__main__":
    sys.exit(main())
