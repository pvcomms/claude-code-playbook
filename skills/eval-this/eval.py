#!/usr/bin/env -S uv run --script --quiet
# /// script
# requires-python = ">=3.11"
# dependencies = [
#   "anthropic>=0.40",
#   "openai>=1.50",
#   "google-genai>=1.0",
# ]
# ///
"""Run a prompt against Opus 4.7, Sonnet 4.6, Haiku 4.5, GPT-4o, Gemini 2.5 Pro in parallel.
Score outputs with Opus-as-judge. Print a markdown table + full responses."""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import time
from concurrent.futures import ThreadPoolExecutor
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
        v = v.strip().strip("'").strip('"')
        os.environ.setdefault(k.strip(), v)


_load_env_file(Path.home() / ".config" / "inbox-triage.env")


# Pricing per 1M tokens (input, output) USD, as of Apr 2026
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
class Result:
    model: str
    provider: str
    output: str = ""
    latency_s: float = 0.0
    input_tokens: int = 0
    output_tokens: int = 0
    cost_usd: float = 0.0
    error: str | None = None
    scores: dict = field(default_factory=dict)


def _cost(model: str, in_tok: int, out_tok: int) -> float:
    if model not in PRICING:
        return 0.0
    ip, op = PRICING[model]
    return (in_tok * ip + out_tok * op) / 1_000_000


def call_anthropic(model: str, prompt: str) -> Result:
    r = Result(model=model, provider="Anthropic")
    if not os.environ.get("ANTHROPIC_API_KEY"):
        r.error = "no ANTHROPIC_API_KEY"
        return r
    import anthropic

    client = anthropic.Anthropic()
    start = time.time()
    try:
        resp = client.messages.create(
            model=model,
            max_tokens=2048,
            messages=[{"role": "user", "content": prompt}],
        )
        r.output = "".join(b.text for b in resp.content if getattr(b, "type", None) == "text")
        r.input_tokens = resp.usage.input_tokens
        r.output_tokens = resp.usage.output_tokens
    except Exception as e:
        r.error = str(e)[:200]
    r.latency_s = time.time() - start
    r.cost_usd = _cost(model, r.input_tokens, r.output_tokens)
    return r


def call_openai(prompt: str) -> Result:
    model = "gpt-5"
    r = Result(model=model, provider="OpenAI")
    if not os.environ.get("OPENAI_API_KEY"):
        r.error = "no OPENAI_API_KEY"
        return r
    from openai import OpenAI

    client = OpenAI()
    start = time.time()
    try:
        resp = client.chat.completions.create(
            model=model,
            max_completion_tokens=2048,
            messages=[{"role": "user", "content": prompt}],
        )
        r.output = resp.choices[0].message.content or ""
        r.input_tokens = resp.usage.prompt_tokens
        r.output_tokens = resp.usage.completion_tokens
    except Exception as e:
        r.error = str(e)[:200]
    r.latency_s = time.time() - start
    r.cost_usd = _cost(model, r.input_tokens, r.output_tokens)
    return r


def call_gemini(prompt: str) -> Result:
    model = "gemini-2.5-pro"
    r = Result(model=model, provider="Google")
    api_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
    if not api_key:
        r.error = "no GEMINI_API_KEY / GOOGLE_API_KEY"
        return r
    from google import genai

    client = genai.Client(api_key=api_key)
    start = time.time()
    try:
        resp = client.models.generate_content(model=model, contents=prompt)
        r.output = resp.text or ""
        um = resp.usage_metadata
        r.input_tokens = um.prompt_token_count or 0
        r.output_tokens = um.candidates_token_count or 0
    except Exception as e:
        r.error = str(e)[:200]
    r.latency_s = time.time() - start
    r.cost_usd = _cost(model, r.input_tokens, r.output_tokens)
    return r


JUDGE_SYSTEM = (
    "You are a rigorous evaluator of AI-generated responses. "
    "Return ONLY a JSON object. No prose, no markdown fences."
)

JUDGE_TEMPLATE = """Score this response to the prompt on 4 dimensions (integers 1-10):

- accuracy: factual correctness, logical soundness, follows the request
- clarity: structure, readability, coherence
- depth: insight, nuance, thoroughness (not just length)
- style: voice, engagement, craft

Also write a <=12-word verdict summarizing the response's character.

PROMPT:
<<<
{prompt}
>>>

RESPONSE (from {model}):
<<<
{response}
>>>

Output exactly:
{{"accuracy": N, "clarity": N, "depth": N, "style": N, "verdict": "..."}}"""


def _extract_json(text: str) -> dict:
    text = text.strip()
    text = re.sub(r"^```(?:json)?\s*", "", text)
    text = re.sub(r"\s*```$", "", text)
    match = re.search(r"\{.*\}", text, re.DOTALL)
    if not match:
        raise ValueError("no JSON object found")
    return json.loads(match.group(0))


def judge(prompt: str, r: Result) -> None:
    if r.error or not r.output.strip():
        return
    if not os.environ.get("ANTHROPIC_API_KEY"):
        r.scores = {"error": "no ANTHROPIC_API_KEY for judge"}
        return
    import anthropic

    client = anthropic.Anthropic()
    try:
        resp = client.messages.create(
            model="claude-opus-4-7",
            max_tokens=400,
            system=JUDGE_SYSTEM,
            messages=[
                {
                    "role": "user",
                    "content": JUDGE_TEMPLATE.format(
                        prompt=prompt[:4000],
                        model=r.model,
                        response=r.output[:6000],
                    ),
                }
            ],
        )
        text = "".join(b.text for b in resp.content if getattr(b, "type", None) == "text")
        r.scores = _extract_json(text)
    except Exception as e:
        r.scores = {"error": str(e)[:120]}


def _avg(s: dict) -> str:
    try:
        vals = [s["accuracy"], s["clarity"], s["depth"], s["style"]]
        return f"{sum(vals) / len(vals):.1f}"
    except Exception:
        return "—"


def render_table(results: list[Result]) -> str:
    header = "| Model | Latency | Tokens (in/out) | Cost | Acc | Clr | Dep | Sty | Avg | Verdict |"
    sep = "|-------|---------|-----------------|------|-----|-----|-----|-----|-----|---------|"
    rows = [header, sep]
    for r in results:
        name = MODEL_SHORT.get(r.model, r.model)
        if r.error:
            rows.append(f"| {name} | — | — | — | — | — | — | — | — | ERROR: {r.error} |")
            continue
        s = r.scores
        if "error" in s:
            acc = clr = dep = sty = "—"
            avg = "—"
            verdict = f"judge: {s['error']}"
        else:
            acc = s.get("accuracy", "—")
            clr = s.get("clarity", "—")
            dep = s.get("depth", "—")
            sty = s.get("style", "—")
            avg = _avg(s)
            verdict = str(s.get("verdict", "")).replace("|", "/")
        rows.append(
            f"| {name} | {r.latency_s:.1f}s | {r.input_tokens}/{r.output_tokens} "
            f"| ${r.cost_usd:.4f} | {acc} | {clr} | {dep} | {sty} | {avg} | {verdict} |"
        )
    return "\n".join(rows)


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


def dispatch(model: str, prompt: str) -> Result:
    if model == "gpt-5":
        return call_openai(prompt)
    if model == "gemini-2.5-pro":
        return call_gemini(prompt)
    return call_anthropic(model, prompt)


def main() -> int:
    ap = argparse.ArgumentParser(description="Run a prompt against 5 frontier models, score, tabulate.")
    ap.add_argument("prompt", nargs="?", help="Prompt string; if omitted, read from stdin or --file")
    ap.add_argument("--file", help="Read prompt from file path")
    ap.add_argument("--skip-judge", action="store_true", help="Skip Opus-as-judge scoring")
    ap.add_argument("--no-outputs", action="store_true", help="Table only, omit full responses")
    ap.add_argument("--only", help="Comma-separated subset: opus,sonnet,haiku,gpt,gemini (or claude,anthropic,openai,google)")
    args = ap.parse_args()

    if args.file:
        prompt = Path(args.file).read_text().strip()
    elif args.prompt:
        prompt = args.prompt
    elif not sys.stdin.isatty():
        prompt = sys.stdin.read().strip()
    else:
        ap.error("no prompt provided (positional arg, --file, or stdin)")
        return 2

    if not prompt:
        print("empty prompt", file=sys.stderr)
        return 2

    models = resolve_models(args.only)
    print(f"[eval-this] dispatching {len(models)} models in parallel...", file=sys.stderr)

    with ThreadPoolExecutor(max_workers=len(models)) as ex:
        results = list(ex.map(lambda m: dispatch(m, prompt), models))

    if not args.skip_judge:
        print("[eval-this] scoring with Opus 4.7 judge...", file=sys.stderr)
        scorable = [r for r in results if not r.error and r.output.strip()]
        with ThreadPoolExecutor(max_workers=max(1, len(scorable))) as ex:
            list(ex.map(lambda r: judge(prompt, r), scorable))

    preview = prompt.replace("\n", " ")
    if len(preview) > 200:
        preview = preview[:200] + "..."

    print("\n# eval-this results\n")
    print(f"**Prompt:** {preview}\n")
    print(render_table(results))

    if not args.no_outputs:
        print("\n---\n")
        for r in results:
            name = MODEL_SHORT.get(r.model, r.model)
            print(f"\n## {name} ({r.model})\n")
            if r.error:
                print(f"_ERROR: {r.error}_")
            else:
                print(r.output.strip())

    return 0


if __name__ == "__main__":
    sys.exit(main())
