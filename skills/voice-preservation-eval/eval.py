#!/usr/bin/env -S uv run --script --quiet
# /// script
# requires-python = ">=3.11"
# dependencies = [
#   "anthropic>=0.40",
#   "openai>=1.50",
#   "google-generativeai>=0.8",
# ]
# ///
"""Voice-preservation eval: rewrite a Param essay N times through a model, score drift per iteration.

Pipeline:
  gen_0 = seed essay (from the 12-essay corpus)
  gen_i = model.rewrite(gen_(i-1), "rewrite preserving voice exactly")
  For each i in 1..N, Opus-4.7 judges gen_i vs gen_0 on five dimensions.

Each model runs in its own thread. Within a thread iterations are sequential (N+1 depends on N).
Output: markdown report with per-model drift table, leakage log, and final pull-quotes.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass, field
from pathlib import Path


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
        os.environ.setdefault(k.strip(), v.strip().strip("'").strip('"'))


_load_env_file(Path.home() / ".config" / "inbox-triage.env")

CORPUS_PATH = Path.home() / ".claude" / "skills" / "param-voice" / "references" / "corpus.md"
VOICE_RULES_PATH = Path.home() / ".claude" / "skills" / "param-voice" / "references" / "voice-rules.md"

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


@dataclass
class Iteration:
    n: int
    text: str = ""
    latency_s: float = 0.0
    input_tokens: int = 0
    output_tokens: int = 0
    cost_usd: float = 0.0
    error: str | None = None
    scores: dict = field(default_factory=dict)


@dataclass
class ModelRun:
    model: str
    iterations: list[Iteration] = field(default_factory=list)


def _cost(model: str, in_tok: int, out_tok: int) -> float:
    if model not in PRICING:
        return 0.0
    ip, op = PRICING[model]
    return (in_tok * ip + out_tok * op) / 1_000_000


REWRITE_SYSTEM = (
    "You are rewriting prose while preserving the author's voice exactly. "
    "Paraphrase meaningfully — change sentence structure, word choice, and order — "
    "but keep the author's signature moves: coined phrases, rhythm, punctuation "
    "fingerprint, argument shape, opening pattern, closing pattern. "
    "Do not add or remove ideas. Do not summarize. Output the rewritten prose and "
    "nothing else — no headers, no commentary, no quotes around the text."
)

REWRITE_USER = """Rewrite the following text. Every sentence must be different prose,
but the voice must be indistinguishable from the original to a regular reader.

ORIGINAL:
<<<
{text}
>>>"""


def rewrite_anthropic(model: str, text: str) -> tuple[str, float, int, int, str | None]:
    if not os.environ.get("ANTHROPIC_API_KEY"):
        return "", 0.0, 0, 0, "no ANTHROPIC_API_KEY"
    import anthropic

    client = anthropic.Anthropic()
    start = time.time()
    try:
        resp = client.messages.create(
            model=model,
            max_tokens=4096,
            system=REWRITE_SYSTEM,
            messages=[{"role": "user", "content": REWRITE_USER.format(text=text)}],
        )
        out = "".join(b.text for b in resp.content if getattr(b, "type", None) == "text").strip()
        return out, time.time() - start, resp.usage.input_tokens, resp.usage.output_tokens, None
    except Exception as e:
        return "", time.time() - start, 0, 0, str(e)[:200]


def rewrite_openai(text: str) -> tuple[str, float, int, int, str | None]:
    if not os.environ.get("OPENAI_API_KEY"):
        return "", 0.0, 0, 0, "no OPENAI_API_KEY"
    from openai import OpenAI

    client = OpenAI()
    start = time.time()
    try:
        resp = client.chat.completions.create(
            model="gpt-5",
            max_completion_tokens=4096,
            messages=[
                {"role": "system", "content": REWRITE_SYSTEM},
                {"role": "user", "content": REWRITE_USER.format(text=text)},
            ],
        )
        out = (resp.choices[0].message.content or "").strip()
        return out, time.time() - start, resp.usage.prompt_tokens, resp.usage.completion_tokens, None
    except Exception as e:
        return "", time.time() - start, 0, 0, str(e)[:200]


def rewrite_gemini(text: str) -> tuple[str, float, int, int, str | None]:
    key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
    if not key:
        return "", 0.0, 0, 0, "no GEMINI_API_KEY"
    import google.generativeai as genai

    genai.configure(api_key=key)
    start = time.time()
    try:
        gm = genai.GenerativeModel("gemini-2.5-pro", system_instruction=REWRITE_SYSTEM)
        resp = gm.generate_content(REWRITE_USER.format(text=text))
        um = resp.usage_metadata
        return (resp.text or "").strip(), time.time() - start, um.prompt_token_count, um.candidates_token_count, None
    except Exception as e:
        return "", time.time() - start, 0, 0, str(e)[:200]


def rewrite(model: str, text: str) -> tuple[str, float, int, int, str | None]:
    if model == "gpt-5":
        return rewrite_openai(text)
    if model == "gemini-2.5-pro":
        return rewrite_gemini(text)
    return rewrite_anthropic(model, text)


JUDGE_SYSTEM = (
    "You are a voice-preservation judge. You score whether a rewrite preserves "
    "the author's voice compared to the original. Return ONLY a JSON object. No prose."
)

JUDGE_TEMPLATE = """Score the REWRITE against the ORIGINAL on voice preservation.

Author voice fingerprint (from the author's style guide):
- Opens with person/number/quote/scene — never abstract thesis
- Thesis lands in paragraph 3-4, not paragraph 1
- Coins a phrase early, repeats 3+ times
- Evidence climbs hierarchy: anecdote -> history -> data -> philosophy
- Em-dashes for pivots, parentheses for hesitation, italics for sarcasm
- Short confident closing, no question, no summary
- Contrarian Kerouac/Bukowski/HST energy — nerve, specificity, restraint

Banned in this voice (if any of these appear in REWRITE, note it):
"navigate the complexities", "in today's fast-paced world", "leverage",
"synergy", "actionable insights", "at the intersection of", "delve into",
"deep dive", "unpack", "game-changer", "paradigm shift", "disruptive",
"thought leader", "ecosystem" (non-biological), "robust", "seamless",
"holistic", "furthermore", "additionally", "moreover", "in conclusion",
"to sum up", "it could be argued", "one might say", "on one hand... on the other",
exclamation marks, emoji, "..." trailing off, "What do you think?",
"Time will tell", "Stay tuned".

Score integers 1-10 (10 = perfect preservation):
- fingerprint: sentence rhythm, punctuation use, paragraph shape
- coined_phrases: are the author's signature phrases (quoted or paraphrased) still present and load-bearing?
- banned_phrase_avoidance: 10 if zero banned phrases, -1 per banned phrase found, floor 1
- swap_test: would a regular reader notice this is a different author? 10 = no, 1 = obvious
- overall: weighted voice preservation

Also list:
- banned_found: array of banned phrases/moves you saw in REWRITE (empty if none)
- leaks: array of up to 3 concrete examples of voice drift, each a short pull-quote from REWRITE with a <=12-word diagnosis

ORIGINAL:
<<<
{original}
>>>

REWRITE (iteration {n}, from {model}):
<<<
{rewrite}
>>>

Output exactly:
{{"fingerprint": N, "coined_phrases": N, "banned_phrase_avoidance": N, "swap_test": N, "overall": N, "banned_found": [...], "leaks": [{{"quote": "...", "diagnosis": "..."}}]}}"""


def _extract_json(text: str) -> dict:
    text = text.strip()
    text = re.sub(r"^```(?:json)?\s*", "", text)
    text = re.sub(r"\s*```$", "", text)
    m = re.search(r"\{.*\}", text, re.DOTALL)
    if not m:
        raise ValueError("no JSON object found")
    return json.loads(m.group(0))


def judge(original: str, it: Iteration, model_name: str) -> None:
    if it.error or not it.text.strip():
        return
    if not os.environ.get("ANTHROPIC_API_KEY"):
        it.scores = {"error": "no ANTHROPIC_API_KEY"}
        return
    import anthropic

    client = anthropic.Anthropic()
    try:
        resp = client.messages.create(
            model="claude-opus-4-7",
            max_tokens=1200,
            system=JUDGE_SYSTEM,
            messages=[
                {
                    "role": "user",
                    "content": JUDGE_TEMPLATE.format(
                        original=original[:8000],
                        rewrite=it.text[:8000],
                        n=it.n,
                        model=model_name,
                    ),
                }
            ],
        )
        text = "".join(b.text for b in resp.content if getattr(b, "type", None) == "text")
        it.scores = _extract_json(text)
    except Exception as e:
        it.scores = {"error": str(e)[:160]}


def run_chain(model: str, seed: str, n: int) -> ModelRun:
    run = ModelRun(model=model)
    run.iterations.append(Iteration(n=0, text=seed))
    current = seed
    for i in range(1, n + 1):
        out, lat, in_tok, out_tok, err = rewrite(model, current)
        cost = _cost(model, in_tok, out_tok)
        it = Iteration(n=i, text=out, latency_s=lat, input_tokens=in_tok, output_tokens=out_tok, cost_usd=cost, error=err)
        run.iterations.append(it)
        if err or not out.strip():
            break
        current = out
    return run


def _avg(s: dict) -> float | None:
    try:
        vals = [s["fingerprint"], s["coined_phrases"], s["banned_phrase_avoidance"], s["swap_test"], s["overall"]]
        return sum(vals) / len(vals)
    except Exception:
        return None


def render_drift_table(run: ModelRun) -> str:
    header = "| It | Fing | Coin | Banned | Swap | Overall | Avg | Latency | Cost | Banned found |"
    sep = "|----|------|------|--------|------|---------|-----|---------|------|--------------|"
    rows = [header, sep]
    for it in run.iterations:
        if it.n == 0:
            rows.append("| 0 | — | — | — | — | — | — | — | — | _seed_ |")
            continue
        if it.error:
            rows.append(f"| {it.n} | — | — | — | — | — | — | {it.latency_s:.1f}s | — | ERROR: {it.error} |")
            continue
        s = it.scores
        if "error" in s:
            rows.append(f"| {it.n} | — | — | — | — | — | — | {it.latency_s:.1f}s | ${it.cost_usd:.4f} | judge: {s['error']} |")
            continue
        avg = _avg(s)
        avg_s = f"{avg:.1f}" if avg is not None else "—"
        banned = ", ".join(s.get("banned_found") or []) or "—"
        if len(banned) > 40:
            banned = banned[:37] + "..."
        rows.append(
            f"| {it.n} | {s.get('fingerprint','—')} | {s.get('coined_phrases','—')} | "
            f"{s.get('banned_phrase_avoidance','—')} | {s.get('swap_test','—')} | "
            f"{s.get('overall','—')} | {avg_s} | {it.latency_s:.1f}s | ${it.cost_usd:.4f} | {banned} |"
        )
    return "\n".join(rows)


def render_summary(runs: list[ModelRun]) -> str:
    header = "| Model | Start | End | Drop | Half-life | First leak | Total cost |"
    sep = "|-------|-------|-----|------|-----------|------------|------------|"
    rows = [header, sep]
    for run in runs:
        name = MODEL_SHORT.get(run.model, run.model)
        scored = [it for it in run.iterations if it.n > 0 and "error" not in (it.scores or {}) and it.scores]
        if not scored:
            rows.append(f"| {name} | — | — | — | — | — | — |")
            continue
        first = scored[0].scores.get("overall", "—")
        last = scored[-1].scores.get("overall", "—")
        try:
            drop = f"{int(first) - int(last):+d}"
        except Exception:
            drop = "—"
        half = "—"
        for it in scored:
            if isinstance(it.scores.get("overall"), int) and it.scores["overall"] < 7:
                half = f"iter {it.n}"
                break
        first_leak = "—"
        for it in scored:
            if it.scores.get("banned_found"):
                first_leak = f"iter {it.n}: {it.scores['banned_found'][0]}"
                break
        total_cost = sum(it.cost_usd for it in run.iterations)
        rows.append(f"| {name} | {first} | {last} | {drop} | {half} | {first_leak} | ${total_cost:.4f} |")
    return "\n".join(rows)


def load_corpus_pieces() -> dict[str, str]:
    if not CORPUS_PATH.exists():
        return {}
    text = CORPUS_PATH.read_text()
    pieces: dict[str, str] = {}
    current_key: str | None = None
    buf: list[str] = []
    for line in text.splitlines():
        m = re.match(r"^## (\d+)\.\s+(.+)$", line)
        if m:
            if current_key and buf:
                pieces[current_key] = "\n".join(buf).strip()
            current_key = f"{int(m.group(1))}. {m.group(2).strip()}"
            buf = []
            continue
        if current_key:
            buf.append(line)
    if current_key and buf:
        pieces[current_key] = "\n".join(buf).strip()
    return pieces


def extract_opening_paragraph(piece_text: str) -> str:
    m = re.search(r"\*\*Opening:\*\*\s*\n\n> (.+?)(?:\n\n|\Z)", piece_text, re.DOTALL)
    if not m:
        return piece_text[:1200]
    return m.group(1).strip()


def resolve_seed(args) -> tuple[str, str]:
    if args.file:
        p = Path(args.file)
        return (p.name, p.read_text().strip())
    pieces = load_corpus_pieces()
    if not pieces:
        print("[error] could not load corpus from param-voice skill", file=sys.stderr)
        sys.exit(2)
    keys = list(pieces.keys())
    if args.essay:
        for k in keys:
            if k.lower().startswith(f"{args.essay}.") or args.essay.lower() in k.lower():
                return (k, extract_opening_paragraph(pieces[k]))
        print(f"[error] no corpus piece matches '{args.essay}'. Available: {keys}", file=sys.stderr)
        sys.exit(2)
    import random

    key = random.choice(keys)
    return (key, extract_opening_paragraph(pieces[key]))


MODEL_ALIASES = {
    "opus": ["claude-opus-4-7"],
    "sonnet": ["claude-sonnet-4-6"],
    "haiku": ["claude-haiku-4-5-20251001"],
    "claude": ["claude-opus-4-7", "claude-sonnet-4-6", "claude-haiku-4-5-20251001"],
    "anthropic": ["claude-opus-4-7", "claude-sonnet-4-6", "claude-haiku-4-5-20251001"],
    "gpt": ["gpt-5"],
    "openai": ["gpt-5"],
    "gemini": ["gemini-2.5-pro"],
    "google": ["gemini-2.5-pro"],
}


def resolve_models(only: str | None) -> list[str]:
    default = [
        "claude-opus-4-7",
        "claude-sonnet-4-6",
        "claude-haiku-4-5-20251001",
        "gpt-5",
        "gemini-2.5-pro",
    ]
    if not only:
        return default
    picks: list[str] = []
    seen = set()
    for key in only.split(","):
        key = key.strip().lower()
        for m in MODEL_ALIASES.get(key, [key]):
            if m not in seen:
                picks.append(m)
                seen.add(m)
    return picks or default


def main() -> int:
    ap = argparse.ArgumentParser(description="Voice-preservation eval: N-generation rewrite chain, scored against the original.")
    ap.add_argument("-n", "--iterations", type=int, default=5, help="Rewrite chain length (default 5)")
    ap.add_argument("--essay", help="Seed essay number from corpus (e.g. '1' or 'oracle')")
    ap.add_argument("--file", help="Seed text file path (overrides --essay)")
    ap.add_argument("--only", help="Comma-separated subset: opus,sonnet,haiku,gpt,gemini")
    ap.add_argument("--save", help="Write full markdown report to this path")
    ap.add_argument("--no-texts", action="store_true", help="Skip final pull-quotes section")
    args = ap.parse_args()

    key, seed = resolve_seed(args)
    if not seed:
        print("empty seed", file=sys.stderr)
        return 2

    models = resolve_models(args.only)
    n = args.iterations

    print(f"[voice-eval] seed: {key} ({len(seed)} chars)", file=sys.stderr)
    print(f"[voice-eval] chain length: {n}; models: {[MODEL_SHORT.get(m,m) for m in models]}", file=sys.stderr)
    t0 = time.time()
    with ThreadPoolExecutor(max_workers=len(models)) as ex:
        futs = {ex.submit(run_chain, m, seed, n): m for m in models}
        runs: list[ModelRun] = []
        for fut in as_completed(futs):
            runs.append(fut.result())
            print(f"[voice-eval] chain done: {MODEL_SHORT.get(futs[fut], futs[fut])} ({time.time()-t0:.1f}s elapsed)", file=sys.stderr)
    runs.sort(key=lambda r: models.index(r.model))

    print("[voice-eval] judging all iterations with Opus-4.7...", file=sys.stderr)
    judge_jobs: list[tuple[str, Iteration, str]] = []
    for run in runs:
        for it in run.iterations:
            if it.n > 0 and not it.error and it.text.strip():
                judge_jobs.append((seed, it, run.model))
    with ThreadPoolExecutor(max_workers=min(8, max(1, len(judge_jobs)))) as ex:
        list(ex.map(lambda job: judge(*job), judge_jobs))

    # Render report
    lines: list[str] = []
    lines.append(f"# voice-preservation-eval\n")
    lines.append(f"**Seed:** {key}  ")
    lines.append(f"**Chain length:** {n}  ")
    lines.append(f"**Models:** {', '.join(MODEL_SHORT.get(m,m) for m in models)}\n")
    lines.append("## Summary — drift across models\n")
    lines.append(render_summary(runs))
    lines.append("")
    for run in runs:
        name = MODEL_SHORT.get(run.model, run.model)
        lines.append(f"\n## {name} ({run.model})\n")
        lines.append(render_drift_table(run))
        leaks: list[str] = []
        for it in run.iterations:
            if it.scores and "leaks" in it.scores:
                for leak in it.scores["leaks"] or []:
                    q = leak.get("quote", "").strip().replace("\n", " ")
                    d = leak.get("diagnosis", "").strip()
                    if q and d:
                        leaks.append(f"- _iter {it.n}_ — \"{q[:160]}\" — **{d}**")
        if leaks:
            lines.append(f"\n### Leak log — {name}\n")
            lines.extend(leaks[:10])

    if not args.no_texts:
        lines.append("\n---\n")
        lines.append("## Final-iteration texts\n")
        lines.append(f"### Seed (iter 0)\n")
        lines.append(seed)
        for run in runs:
            name = MODEL_SHORT.get(run.model, run.model)
            last = next((it for it in reversed(run.iterations) if it.text.strip() and not it.error), None)
            if last:
                lines.append(f"\n### {name} — iter {last.n}\n")
                lines.append(last.text)

    report = "\n".join(lines)
    print(report)

    if args.save:
        out_path = Path(args.save).expanduser()
        out_path.parent.mkdir(parents=True, exist_ok=True)
        out_path.write_text(report + "\n")
        print(f"\n[voice-eval] saved report to {out_path}", file=sys.stderr)

    return 0


if __name__ == "__main__":
    sys.exit(main())
