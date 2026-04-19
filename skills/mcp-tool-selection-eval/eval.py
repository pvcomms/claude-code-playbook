#!/usr/bin/env -S uv run --script --quiet
# /// script
# requires-python = ">=3.11"
# dependencies = [
#   "anthropic>=0.40",
#   "openai>=1.50",
#   "google-genai>=1.0",
#   "rich>=13",
# ]
# ///
"""MCP tool-selection eval: does a model pick the right tool from a crowded menu?

Pipeline:
  For each (model, testcase): send {system, tools: menu, user: utterance} via the
  native tool-use API. Record what the model did — tool called, args, or text-only.
  Score per-category:
    direct     → exact-match against expected_tool
    semantic   → exact-match against expected_tool
    ambiguous  → Opus-4.7 judge given menu + expected + notes
    negative   → reward no_tool (text response, not a call)
  Output: markdown report with a category × model accuracy table plus per-failure
  inspector rows.
"""

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

SKILL_DIR = Path(__file__).resolve().parent
DEFAULT_TOOLS = SKILL_DIR / "tools.json"
DEFAULT_CASES = SKILL_DIR / "testcases.jsonl"

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

SYSTEM_PROMPT = (
    "You are a tool-selection assistant. Given a user utterance and a menu of tools, "
    "call the single best tool that directly serves the user's intent. If no tool in "
    "the menu fits, do NOT call any tool — respond in plain text explaining that no "
    "tool applies. Pick exactly one tool when you do call, and do not chain calls."
)


@dataclass
class ToolCall:
    name: str
    arguments: dict = field(default_factory=dict)


@dataclass
class Attempt:
    model: str
    case_id: str
    tool_call: ToolCall | None = None
    text: str = ""
    latency_s: float = 0.0
    input_tokens: int = 0
    output_tokens: int = 0
    cost_usd: float = 0.0
    error: str | None = None
    verdict: str | None = None  # "pass" | "fail"
    judge_reason: str | None = None


def _cost(model: str, in_tok: int, out_tok: int) -> float:
    if model not in PRICING:
        return 0.0
    ip, op = PRICING[model]
    return (in_tok * ip + out_tok * op) / 1_000_000


def _anthropic_tool_schema(tools: list[dict]) -> list[dict]:
    # Anthropic requires input_schema; our fixtures are name+description only,
    # so synthesize an empty object schema that accepts any fields.
    out = []
    for t in tools:
        out.append(
            {
                "name": t["name"],
                "description": t["description"],
                "input_schema": {"type": "object", "properties": {}, "additionalProperties": True},
            }
        )
    return out


def _openai_tool_schema(tools: list[dict]) -> list[dict]:
    out = []
    for t in tools:
        out.append(
            {
                "type": "function",
                "function": {
                    "name": t["name"],
                    "description": t["description"],
                    "parameters": {"type": "object", "properties": {}, "additionalProperties": True},
                },
            }
        )
    return out


def _gemini_tool_schema(tools: list[dict]):
    # google-genai FunctionDeclaration
    from google.genai import types as gt

    decls = []
    for t in tools:
        # Gemini rejects empty parameter schemas — pass None to omit.
        decls.append(
            gt.FunctionDeclaration(
                name=t["name"].replace("-", "_"),  # Gemini prefers snake_case
                description=t["description"],
            )
        )
    return [gt.Tool(function_declarations=decls)]


def _gemini_name_map(tools: list[dict]) -> dict[str, str]:
    return {t["name"].replace("-", "_"): t["name"] for t in tools}


def call_anthropic(model: str, case: dict, tools: list[dict]) -> Attempt:
    a = Attempt(model=model, case_id=case["id"])
    if not os.environ.get("ANTHROPIC_API_KEY"):
        a.error = "no ANTHROPIC_API_KEY"
        return a
    import anthropic

    client = anthropic.Anthropic()
    start = time.time()
    try:
        resp = client.messages.create(
            model=model,
            max_tokens=1024,
            system=SYSTEM_PROMPT,
            tools=_anthropic_tool_schema(tools),
            messages=[{"role": "user", "content": case["utterance"]}],
        )
        for block in resp.content:
            if getattr(block, "type", None) == "tool_use":
                a.tool_call = ToolCall(name=block.name, arguments=dict(block.input or {}))
                break
            if getattr(block, "type", None) == "text":
                a.text += block.text
        a.input_tokens = resp.usage.input_tokens
        a.output_tokens = resp.usage.output_tokens
    except Exception as e:
        a.error = str(e)[:220]
    a.latency_s = time.time() - start
    a.cost_usd = _cost(model, a.input_tokens, a.output_tokens)
    return a


def call_openai(case: dict, tools: list[dict]) -> Attempt:
    model = "gpt-5"
    a = Attempt(model=model, case_id=case["id"])
    if not os.environ.get("OPENAI_API_KEY"):
        a.error = "no OPENAI_API_KEY"
        return a
    from openai import OpenAI

    client = OpenAI()
    start = time.time()
    try:
        resp = client.chat.completions.create(
            model=model,
            max_completion_tokens=1024,
            tools=_openai_tool_schema(tools),
            tool_choice="auto",
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": case["utterance"]},
            ],
        )
        msg = resp.choices[0].message
        if msg.tool_calls:
            first = msg.tool_calls[0]
            try:
                args = json.loads(first.function.arguments or "{}")
            except Exception:
                args = {}
            a.tool_call = ToolCall(name=first.function.name, arguments=args)
        a.text = msg.content or ""
        a.input_tokens = resp.usage.prompt_tokens
        a.output_tokens = resp.usage.completion_tokens
    except Exception as e:
        a.error = str(e)[:220]
    a.latency_s = time.time() - start
    a.cost_usd = _cost(model, a.input_tokens, a.output_tokens)
    return a


def call_gemini(case: dict, tools: list[dict]) -> Attempt:
    model = "gemini-2.5-pro"
    a = Attempt(model=model, case_id=case["id"])
    key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
    if not key:
        a.error = "no GEMINI_API_KEY / GOOGLE_API_KEY"
        return a
    from google import genai
    from google.genai import types as gt

    client = genai.Client(api_key=key)
    name_map = _gemini_name_map(tools)
    start = time.time()
    try:
        resp = client.models.generate_content(
            model=model,
            contents=case["utterance"],
            config=gt.GenerateContentConfig(
                system_instruction=SYSTEM_PROMPT,
                tools=_gemini_tool_schema(tools),
            ),
        )
        # Inspect function calls in the response
        fn_call = None
        text_parts: list[str] = []
        for cand in resp.candidates or []:
            if not getattr(cand, "content", None):
                continue
            for part in cand.content.parts or []:
                if getattr(part, "function_call", None):
                    fn_call = part.function_call
                    break
                if getattr(part, "text", None):
                    text_parts.append(part.text)
            if fn_call:
                break
        if fn_call:
            orig = name_map.get(fn_call.name, fn_call.name)
            a.tool_call = ToolCall(name=orig, arguments=dict(fn_call.args or {}))
        a.text = "".join(text_parts)
        um = resp.usage_metadata
        a.input_tokens = getattr(um, "prompt_token_count", 0) or 0
        a.output_tokens = getattr(um, "candidates_token_count", 0) or 0
    except Exception as e:
        a.error = str(e)[:220]
    a.latency_s = time.time() - start
    a.cost_usd = _cost(model, a.input_tokens, a.output_tokens)
    return a


def dispatch(model: str, case: dict, tools: list[dict]) -> Attempt:
    if model == "gpt-5":
        return call_openai(case, tools)
    if model == "gemini-2.5-pro":
        return call_gemini(case, tools)
    return call_anthropic(model, case, tools)


# ---------- scoring ----------

JUDGE_SYSTEM = (
    "You are a rigorous tool-selection judge. Given the user utterance, the tool "
    "menu, the expected tool (or expected behavior), judging notes, and what the "
    "model actually did, return a JSON verdict. No prose outside JSON."
)

JUDGE_TEMPLATE = """UTTERANCE:
{utterance}

EXPECTED TOOL: {expected_tool}
EXPECTED BEHAVIOR: {expected_behavior}
NOTES: {notes}

MODEL ACTION:
tool_called: {called_name}
tool_args: {called_args}
text_response: {text}

TOOL MENU (name — description):
{menu}

Decide pass/fail. A pass means the model's action matches the expected tool OR
satisfies the expected behavior for the stated reason in notes. A near-miss that
picks a plausibly-similar wrong tool (e.g. list vs filter, fetch vs search, close
vs delete, create-event vs create-task) is a FAIL — we are measuring
disambiguation.

Output exactly:
{{"verdict": "pass" | "fail", "reason": "<=20 words"}}"""


def _extract_json(text: str) -> dict:
    text = text.strip()
    text = re.sub(r"^```(?:json)?\s*", "", text)
    text = re.sub(r"\s*```$", "", text)
    m = re.search(r"\{.*\}", text, re.DOTALL)
    if not m:
        raise ValueError("no JSON object found")
    return json.loads(m.group(0))


def score_deterministic(case: dict, a: Attempt) -> None:
    """Direct/semantic/negative categories score without judge."""
    cat = case["category"]
    if a.error:
        a.verdict = "fail"
        a.judge_reason = f"api error: {a.error[:60]}"
        return
    if cat == "negative":
        if a.tool_call is None:
            a.verdict = "pass"
            a.judge_reason = "no tool called (correct)"
        else:
            a.verdict = "fail"
            a.judge_reason = f"hallucinated tool: {a.tool_call.name}"
        return
    # direct + semantic → exact match
    expected = case.get("expected_tool")
    if a.tool_call and a.tool_call.name == expected:
        a.verdict = "pass"
        a.judge_reason = f"matched {expected}"
    elif a.tool_call is None:
        a.verdict = "fail"
        a.judge_reason = f"no tool called; expected {expected}"
    else:
        a.verdict = "fail"
        a.judge_reason = f"picked {a.tool_call.name}; expected {expected}"


def score_with_judge(case: dict, a: Attempt, tools: list[dict]) -> None:
    if a.error:
        a.verdict = "fail"
        a.judge_reason = f"api error: {a.error[:60]}"
        return
    if not os.environ.get("ANTHROPIC_API_KEY"):
        a.verdict = "fail"
        a.judge_reason = "no ANTHROPIC_API_KEY for judge"
        return
    import anthropic

    client = anthropic.Anthropic()
    menu_str = "\n".join(f"- {t['name']} — {t['description']}" for t in tools)
    called_name = a.tool_call.name if a.tool_call else "(none — text response)"
    called_args = json.dumps(a.tool_call.arguments)[:300] if a.tool_call else "—"
    prompt = JUDGE_TEMPLATE.format(
        utterance=case["utterance"],
        expected_tool=case.get("expected_tool", "—"),
        expected_behavior=case.get("expected_behavior", "—"),
        notes=case.get("notes", "—"),
        called_name=called_name,
        called_args=called_args,
        text=(a.text or "")[:400],
        menu=menu_str,
    )
    try:
        resp = client.messages.create(
            model="claude-opus-4-7",
            max_tokens=300,
            system=JUDGE_SYSTEM,
            messages=[{"role": "user", "content": prompt}],
        )
        text = "".join(b.text for b in resp.content if getattr(b, "type", None) == "text")
        j = _extract_json(text)
        a.verdict = "pass" if str(j.get("verdict", "")).lower() == "pass" else "fail"
        a.judge_reason = str(j.get("reason", ""))[:160]
    except Exception as e:
        a.verdict = "fail"
        a.judge_reason = f"judge error: {str(e)[:80]}"


# ---------- IO ----------


def load_tools(path: Path) -> list[dict]:
    data = json.loads(path.read_text())
    if not isinstance(data, list):
        raise ValueError("tools.json must be a list")
    return data


def load_cases(path: Path) -> list[dict]:
    cases: list[dict] = []
    for line in path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("//"):
            continue
        cases.append(json.loads(line))
    return cases


# ---------- rendering ----------


def render_accuracy_table(attempts: list[Attempt], cases_by_id: dict[str, dict], models: list[str]) -> str:
    cats = ["direct", "semantic", "ambiguous", "negative"]
    # counts[model][cat] = (pass, total)
    counts: dict[str, dict[str, list[int]]] = {m: {c: [0, 0] for c in cats + ["all"]} for m in models}
    for a in attempts:
        case = cases_by_id[a.case_id]
        cat = case["category"]
        counts[a.model][cat][1] += 1
        counts[a.model]["all"][1] += 1
        if a.verdict == "pass":
            counts[a.model][cat][0] += 1
            counts[a.model]["all"][0] += 1

    header = "| Model | Direct | Semantic | Ambiguous | Negative | Overall |"
    sep = "|-------|--------|----------|-----------|----------|---------|"
    rows = [header, sep]
    for m in models:
        name = MODEL_SHORT.get(m, m)
        cells = [name]
        for c in cats + ["all"]:
            p, t = counts[m][c]
            pct = f"{100*p/t:.0f}%" if t else "—"
            cells.append(f"{p}/{t} ({pct})")
        rows.append("| " + " | ".join(cells) + " |")
    return "\n".join(rows)


def render_perf_table(attempts: list[Attempt], models: list[str]) -> str:
    header = "| Model | Calls | Avg latency | Total tokens (in/out) | Total cost |"
    sep = "|-------|-------|-------------|-----------------------|------------|"
    rows = [header, sep]
    for m in models:
        xs = [a for a in attempts if a.model == m]
        if not xs:
            continue
        n = len(xs)
        avg_lat = sum(a.latency_s for a in xs) / n
        in_tok = sum(a.input_tokens for a in xs)
        out_tok = sum(a.output_tokens for a in xs)
        cost = sum(a.cost_usd for a in xs)
        rows.append(
            f"| {MODEL_SHORT.get(m, m)} | {n} | {avg_lat:.1f}s | {in_tok}/{out_tok} | ${cost:.4f} |"
        )
    return "\n".join(rows)


def render_failures(attempts: list[Attempt], cases_by_id: dict[str, dict]) -> str:
    fails = [a for a in attempts if a.verdict == "fail"]
    if not fails:
        return "_All tests passed._"
    lines = ["| Model | Case | Category | Expected | Got | Reason |",
             "|-------|------|----------|----------|-----|--------|"]
    for a in fails:
        c = cases_by_id[a.case_id]
        expected = c.get("expected_tool") or c.get("expected_behavior", "—")
        got = a.tool_call.name if a.tool_call else "(no tool)"
        reason = (a.judge_reason or "").replace("|", "/")[:100]
        lines.append(
            f"| {MODEL_SHORT.get(a.model, a.model)} | `{a.case_id}` | {c['category']} "
            f"| `{expected}` | `{got}` | {reason} |"
        )
    return "\n".join(lines)


# ---------- model selection ----------

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
    for k in only.split(","):
        k = k.strip().lower()
        for m in MODEL_ALIASES.get(k, [k]):
            if m not in seen:
                picks.append(m)
                seen.add(m)
    return picks or default


def main() -> int:
    ap = argparse.ArgumentParser(description="MCP tool-selection eval across frontier models.")
    ap.add_argument("--tools", default=str(DEFAULT_TOOLS), help="Path to tools.json menu")
    ap.add_argument("--cases", default=str(DEFAULT_CASES), help="Path to testcases.jsonl")
    ap.add_argument("--only", help="Comma-separated model subset: opus,sonnet,haiku,gpt,gemini")
    ap.add_argument(
        "--categories",
        help="Comma-separated category filter: direct,semantic,ambiguous,negative",
    )
    ap.add_argument("--ids", help="Comma-separated case IDs to run (for smoke-test)")
    ap.add_argument("--limit", type=int, help="Max cases per category")
    ap.add_argument("--no-judge", action="store_true", help="Skip Opus judge (ambiguous cases fail-fast)")
    ap.add_argument("--save", help="Write markdown report to this path")
    args = ap.parse_args()

    tools = load_tools(Path(args.tools))
    cases = load_cases(Path(args.cases))

    if args.ids:
        wanted = {x.strip() for x in args.ids.split(",")}
        cases = [c for c in cases if c["id"] in wanted]
    if args.categories:
        wanted_cats = {x.strip() for x in args.categories.split(",")}
        cases = [c for c in cases if c["category"] in wanted_cats]
    if args.limit:
        by_cat: dict[str, list[dict]] = {}
        for c in cases:
            by_cat.setdefault(c["category"], []).append(c)
        capped = []
        for v in by_cat.values():
            capped.extend(v[: args.limit])
        cases = capped

    if not cases:
        print("[error] no testcases selected", file=sys.stderr)
        return 2

    models = resolve_models(args.only)
    jobs = [(m, c) for m in models for c in cases]
    print(
        f"[mcp-eval] tools: {len(tools)}  cases: {len(cases)}  models: "
        f"{[MODEL_SHORT.get(m,m) for m in models]}  jobs: {len(jobs)}",
        file=sys.stderr,
    )

    t0 = time.time()
    with ThreadPoolExecutor(max_workers=min(8, max(1, len(jobs)))) as ex:
        attempts = list(ex.map(lambda j: dispatch(j[0], j[1], tools), jobs))
    print(f"[mcp-eval] dispatch done ({time.time()-t0:.1f}s)", file=sys.stderr)

    cases_by_id = {c["id"]: c for c in cases}

    # Deterministic scoring first
    judge_queue: list[Attempt] = []
    for a in attempts:
        case = cases_by_id[a.case_id]
        if case["category"] == "ambiguous" and not args.no_judge:
            judge_queue.append(a)
        else:
            score_deterministic(case, a)

    if judge_queue:
        print(f"[mcp-eval] judging {len(judge_queue)} ambiguous attempts with Opus-4.7...", file=sys.stderr)
        with ThreadPoolExecutor(max_workers=min(6, len(judge_queue))) as ex:
            list(ex.map(lambda a: score_with_judge(cases_by_id[a.case_id], a, tools), judge_queue))
    elif args.no_judge:
        for a in attempts:
            if cases_by_id[a.case_id]["category"] == "ambiguous":
                score_deterministic(cases_by_id[a.case_id], a)

    lines: list[str] = []
    lines.append("# mcp-tool-selection-eval\n")
    lines.append(f"**Tool menu:** {len(tools)} tools  ")
    lines.append(f"**Testcases:** {len(cases)}  ")
    lines.append(f"**Models:** {', '.join(MODEL_SHORT.get(m,m) for m in models)}\n")
    lines.append("## Accuracy by category\n")
    lines.append(render_accuracy_table(attempts, cases_by_id, models))
    lines.append("\n## Performance\n")
    lines.append(render_perf_table(attempts, models))
    lines.append("\n## Failures — per-case inspector\n")
    lines.append(render_failures(attempts, cases_by_id))

    report = "\n".join(lines)
    print(report)
    if args.save:
        out = Path(args.save).expanduser()
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(report + "\n")
        print(f"\n[mcp-eval] saved report to {out}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
