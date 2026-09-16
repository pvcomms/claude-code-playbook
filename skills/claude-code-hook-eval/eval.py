#!/usr/bin/env -S uv run --script --quiet
# /// script
# requires-python = ">=3.11"
# dependencies = []
# ///
"""claude-code-hook-eval: measure wall-clock time saved per hook.

For each hook in ~/.claude/settings.json (and --extra settings files):
  1. Parse matcher + command. Classify (formatter, guard, notify, custom).
  2. Mine recent ~/.claude/projects/**/*.jsonl transcripts to count how often the
     matcher fired over the last N days.
  3. Benchmark actual execution latency with a synthetic stdin payload (repeated K times).
  4. Apply a savings model per class:
        formatter    → (probability of would-need-format) × (manual-format seconds per file)
        guard        → (historical near-miss count) × (cost of a disaster in seconds)
        notify       → (expected context-switch savings per fire)
        custom       → user-supplied seconds/fire via --assume
  5. Print a markdown report: per-hook latency, weekly frequency, seconds saved / week,
     ROI (saved / spent), and a verdict (keep / tune / drop).

Intentionally non-magical: show the assumptions, let the user override.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import statistics
import subprocess
import sys
import tempfile
import time
from dataclasses import dataclass, field
from pathlib import Path

HOME = Path.home()
DEFAULT_SETTINGS = HOME / ".claude" / "settings.json"
PROJECTS_DIR = HOME / ".claude" / "projects"


@dataclass
class Hook:
    event: str
    matcher: str
    command: str
    hook_type: str = "command"
    index: int = 0
    kind: str = "custom"
    fires_per_week: float = 0.0
    latency_ms_samples: list[float] = field(default_factory=list)
    bench_error: str | None = None
    assumptions: dict = field(default_factory=dict)
    seconds_saved_per_fire: float = 0.0
    seconds_spent_per_fire: float = 0.0

    @property
    def latency_ms_mean(self) -> float:
        return statistics.mean(self.latency_ms_samples) if self.latency_ms_samples else 0.0

    @property
    def latency_ms_p95(self) -> float:
        if not self.latency_ms_samples:
            return 0.0
        s = sorted(self.latency_ms_samples)
        idx = max(0, int(len(s) * 0.95) - 1)
        return s[idx]

    @property
    def saved_per_week_s(self) -> float:
        return self.seconds_saved_per_fire * self.fires_per_week

    @property
    def spent_per_week_s(self) -> float:
        return self.seconds_spent_per_fire * self.fires_per_week

    @property
    def net_per_week_s(self) -> float:
        return self.saved_per_week_s - self.spent_per_week_s

    @property
    def roi(self) -> float:
        if self.spent_per_week_s <= 0:
            return float("inf") if self.saved_per_week_s > 0 else 0.0
        return self.saved_per_week_s / self.spent_per_week_s

    def label(self) -> str:
        m = self.matcher or "*"
        cmd_preview = re.sub(r"\s+", " ", self.command)
        if len(cmd_preview) > 50:
            cmd_preview = cmd_preview[:47] + "..."
        return f"{self.event}[{m}] #{self.index} — {cmd_preview}"


def load_hooks(settings_files: list[Path]) -> list[Hook]:
    hooks: list[Hook] = []
    for f in settings_files:
        if not f.exists():
            print(f"[warn] missing settings: {f}", file=sys.stderr)
            continue
        try:
            data = json.loads(f.read_text())
        except Exception as e:
            print(f"[warn] failed to parse {f}: {e}", file=sys.stderr)
            continue
        for event, entries in (data.get("hooks") or {}).items():
            for entry in entries or []:
                matcher = entry.get("matcher", "") or ""
                for i, h in enumerate(entry.get("hooks") or []):
                    hooks.append(
                        Hook(
                            event=event,
                            matcher=matcher,
                            command=h.get("command", ""),
                            hook_type=h.get("type", "command"),
                            index=i,
                        )
                    )
    return hooks


def classify(h: Hook) -> str:
    cmd = h.command.lower()
    if "prettier" in cmd or "eslint --fix" in cmd or "biome" in cmd or "ruff format" in cmd or "rubocop -a" in cmd:
        return "formatter"
    if "blocked" in cmd or "exit 2" in cmd or "rm -rf" in cmd or "drop table" in cmd or "force" in cmd:
        return "guard"
    if "afplay" in cmd or "osascript -e 'display notification" in cmd or "say " in cmd or "terminal-notifier" in cmd:
        return "notify"
    if "append" in cmd or "> " in cmd and ".log" in cmd:
        return "logger"
    return "custom"


# Matcher pattern -> tool_name regex (Claude Code uses pipe-separated or plain tool names)
def matcher_to_tools(matcher: str) -> list[str]:
    if not matcher or matcher == "*":
        return ["*"]
    return [m.strip() for m in matcher.split("|") if m.strip()]


def mine_frequency(hooks: list[Hook], days: int, projects_dir: Path) -> None:
    """Scan transcripts from the last `days` days to estimate fires/week per hook."""
    cutoff = time.time() - days * 86400
    # Counters: event -> tool_name -> count
    event_counts: dict[str, dict[str, int]] = {"PreToolUse": {}, "PostToolUse": {}, "Stop": {}, "UserPromptSubmit": {}, "SubagentStop": {}, "SessionStart": {}}
    jsonls = list(projects_dir.rglob("*.jsonl")) if projects_dir.exists() else []
    sessions_seen = 0
    messages_scanned = 0
    for jf in jsonls:
        try:
            if jf.stat().st_mtime < cutoff:
                continue
        except Exception:
            continue
        session_had_assistant = False
        try:
            with jf.open("r", encoding="utf-8") as fh:
                for line in fh:
                    try:
                        d = json.loads(line)
                    except Exception:
                        continue
                    ts = d.get("timestamp")
                    if ts:
                        try:
                            t = time.mktime(time.strptime(ts[:19], "%Y-%m-%dT%H:%M:%S"))
                            if t < cutoff:
                                continue
                        except Exception:
                            pass
                    if d.get("type") != "assistant":
                        continue
                    messages_scanned += 1
                    session_had_assistant = True
                    msg = d.get("message") or {}
                    for block in msg.get("content") or []:
                        if isinstance(block, dict) and block.get("type") == "tool_use":
                            name = block.get("name", "")
                            event_counts["PreToolUse"][name] = event_counts["PreToolUse"].get(name, 0) + 1
                            event_counts["PostToolUse"][name] = event_counts["PostToolUse"].get(name, 0) + 1
                    sr = msg.get("stop_reason")
                    if sr and sr != "tool_use":
                        event_counts["Stop"]["*"] = event_counts["Stop"].get("*", 0) + 1
        except Exception:
            continue
        if session_had_assistant:
            sessions_seen += 1

    print(
        f"[hook-eval] scanned {len(jsonls)} transcripts, {sessions_seen} active within {days}d, "
        f"{messages_scanned} assistant messages",
        file=sys.stderr,
    )

    week_factor = 7.0 / max(1, days)
    for h in hooks:
        tools = matcher_to_tools(h.matcher)
        total = 0
        bucket = event_counts.get(h.event, {})
        if tools == ["*"]:
            total = sum(bucket.values())
        else:
            for t in tools:
                total += bucket.get(t, 0)
        h.fires_per_week = total * week_factor


SYNTHETIC_PAYLOADS = {
    "Write": {"tool_input": {"file_path": None, "content": "export const x = 1;\n"}},
    "Edit": {"tool_input": {"file_path": None, "old_string": "", "new_string": ""}},
    "Bash": {"tool_input": {"command": "echo hello"}},
    "*": {"tool_input": {}},
}


def build_payload(h: Hook) -> str:
    tools = matcher_to_tools(h.matcher)
    tmp_file = None
    if h.event == "PostToolUse" and "Write" in tools or "Edit" in tools:
        fd, name = tempfile.mkstemp(suffix=".js")
        os.close(fd)
        Path(name).write_text("export const x=1;const y=2;\n")
        tmp_file = name
    base = SYNTHETIC_PAYLOADS.get(tools[0], SYNTHETIC_PAYLOADS["*"]).copy()
    if tmp_file:
        base = {"tool_input": {"file_path": tmp_file, "content": "export const x=1;\n"}}
    base["event"] = h.event
    base["tool_name"] = tools[0] if tools and tools[0] != "*" else "Unknown"
    return json.dumps(base)


def benchmark(h: Hook, runs: int = 5) -> None:
    if h.hook_type != "command" or not h.command:
        h.bench_error = f"non-command hook type: {h.hook_type}"
        return
    payload = build_payload(h)
    env = os.environ.copy()
    for _ in range(runs):
        start = time.time()
        try:
            proc = subprocess.run(
                ["bash", "-lc", h.command],
                input=payload,
                text=True,
                capture_output=True,
                timeout=30,
                env=env,
            )
        except subprocess.TimeoutExpired:
            h.bench_error = "timeout >30s"
            return
        except Exception as e:
            h.bench_error = str(e)[:120]
            return
        h.latency_ms_samples.append((time.time() - start) * 1000.0)
        _ = proc.returncode  # ignore non-zero; guards exit 2 by design


# Savings model — surface every assumption
DEFAULTS = {
    # How much time the user would spend manually doing what the hook automates, per fire:
    "formatter_save_s": 15.0,  # "run prettier, wait, continue" — user-visible seconds per file
    "guard_save_s": 120.0,  # average cost of a near-miss disaster avoided (seconds equivalent)
    "guard_hit_rate": 0.02,  # % of matched tool uses that would have been destructive without the guard
    "notify_save_s": 8.0,  # switching cost reduction when notified audibly vs checking window
    "notify_rate": 0.6,  # fraction of "Stop" events where the user was away and benefits
    "logger_save_s": 0.0,  # loggers themselves don't save time, they enable later auditing
    "custom_save_s": 0.0,
}


def apply_savings(h: Hook, over: dict[str, float]) -> None:
    d = {**DEFAULTS, **over}
    if h.kind == "formatter":
        h.seconds_saved_per_fire = d["formatter_save_s"]
        h.assumptions = {"manual format seconds": d["formatter_save_s"]}
    elif h.kind == "guard":
        per = d["guard_save_s"] * d["guard_hit_rate"]
        h.seconds_saved_per_fire = per
        h.assumptions = {
            "disaster cost (s)": d["guard_save_s"],
            "hit rate": d["guard_hit_rate"],
        }
    elif h.kind == "notify":
        h.seconds_saved_per_fire = d["notify_save_s"] * d["notify_rate"]
        h.assumptions = {
            "switch save (s)": d["notify_save_s"],
            "away rate": d["notify_rate"],
        }
    elif h.kind == "logger":
        h.seconds_saved_per_fire = d["logger_save_s"]
        h.assumptions = {"note": "logging only, no direct time savings"}
    else:
        h.seconds_saved_per_fire = d["custom_save_s"]
        h.assumptions = {"assumed save/fire (s)": d["custom_save_s"]}

    h.seconds_spent_per_fire = h.latency_ms_mean / 1000.0


def verdict(h: Hook) -> str:
    if h.bench_error:
        return f"broken: {h.bench_error}"
    if h.kind == "custom" and h.seconds_saved_per_fire == 0:
        return "unknown — pass --assume-save-s to score"
    if h.net_per_week_s >= 60:
        return "keep — clear time-save"
    if h.net_per_week_s > 0:
        return "keep — modest"
    if h.seconds_saved_per_fire > 0 and h.fires_per_week == 0:
        return "dormant — no fires in window"
    if h.kind == "guard" and h.fires_per_week > 0:
        return "keep — risk insurance"
    return "tune — cost > savings"


def fmt_time(seconds: float) -> str:
    if seconds >= 60:
        return f"{seconds/60:.1f}m"
    if seconds >= 1:
        return f"{seconds:.1f}s"
    return f"{seconds*1000:.0f}ms"


def render(hooks: list[Hook], days: int) -> str:
    lines: list[str] = []
    lines.append("# claude-code-hook-eval\n")
    lines.append(f"**Window:** last {days} days of transcripts  ")
    lines.append(f"**Hooks measured:** {len(hooks)}\n")
    lines.append("## Summary\n")
    lines.append("| Hook | Kind | Fires/wk | Latency mean | p95 | Saved/fire | Spent/wk | Saved/wk | Net/wk | Verdict |")
    lines.append("|------|------|---------:|-------------:|----:|-----------:|---------:|---------:|-------:|---------|")
    for h in hooks:
        lines.append(
            f"| {h.label()} | {h.kind} | {h.fires_per_week:.1f} | "
            f"{h.latency_ms_mean:.0f}ms | {h.latency_ms_p95:.0f}ms | "
            f"{fmt_time(h.seconds_saved_per_fire)} | {fmt_time(h.spent_per_week_s)} | "
            f"{fmt_time(h.saved_per_week_s)} | {fmt_time(h.net_per_week_s)} | {verdict(h)} |"
        )
    total_saved = sum(h.saved_per_week_s for h in hooks)
    total_spent = sum(h.spent_per_week_s for h in hooks)
    total_net = total_saved - total_spent
    lines.append(
        f"\n**Totals per week** — saved {fmt_time(total_saved)}, spent {fmt_time(total_spent)}, "
        f"net {fmt_time(total_net)}.\n"
    )

    lines.append("## Per-hook detail\n")
    for h in hooks:
        lines.append(f"### {h.label()}\n")
        lines.append(f"- **Event:** `{h.event}` · **Matcher:** `{h.matcher or '*'}` · **Kind:** `{h.kind}`")
        lines.append(f"- **Command:** `{h.command[:200]}{'...' if len(h.command)>200 else ''}`")
        if h.bench_error:
            lines.append(f"- **Benchmark:** ERROR — {h.bench_error}")
        else:
            samples = ", ".join(f"{s:.0f}ms" for s in h.latency_ms_samples)
            lines.append(f"- **Latency samples:** {samples} (mean {h.latency_ms_mean:.0f}ms, p95 {h.latency_ms_p95:.0f}ms)")
        lines.append(f"- **Fires/week:** {h.fires_per_week:.1f} (from transcript history)")
        if h.assumptions:
            lines.append(f"- **Assumptions:** {h.assumptions}")
        lines.append(f"- **Savings:** {fmt_time(h.seconds_saved_per_fire)} per fire × {h.fires_per_week:.1f}/wk = {fmt_time(h.saved_per_week_s)}/wk")
        lines.append(f"- **Cost:** {h.latency_ms_mean:.0f}ms per fire × {h.fires_per_week:.1f}/wk = {fmt_time(h.spent_per_week_s)}/wk")
        lines.append(f"- **Net:** {fmt_time(h.net_per_week_s)}/wk · **ROI:** {h.roi:.1f}x · **Verdict:** {verdict(h)}\n")

    lines.append("## Methodology & caveats\n")
    lines.append(
        "Frequency is mined from `~/.claude/projects/**/*.jsonl` by counting assistant-message "
        "tool_use blocks whose tool name matches the hook matcher. Matcher semantics approximate "
        "Claude Code's matcher (pipe-separated tool names); complex regex matchers may under-count."
    )
    lines.append("")
    lines.append(
        "Latency is measured by running the hook command against a synthetic JSON payload that "
        "mirrors what Claude Code sends on stdin. For formatter hooks the payload includes a "
        "temporary scratch file so prettier/eslint actually run end-to-end."
    )
    lines.append("")
    lines.append(
        "Savings are *estimates*, not ground truth. Override the defaults with flags like "
        "`--formatter-save-s 30` or `--guard-hit-rate 0.005` and re-run. The point of this eval "
        "is not the final number — it's to make every assumption explicit so you can argue with it."
    )
    return "\n".join(lines)


def main() -> int:
    ap = argparse.ArgumentParser(description="Measure wall-clock time saved per Claude Code hook.")
    ap.add_argument("--settings", default=str(DEFAULT_SETTINGS), help="Path to settings.json (default ~/.claude/settings.json)")
    ap.add_argument("--extra", action="append", default=[], help="Additional settings file(s) to merge in")
    ap.add_argument("--days", type=int, default=7, help="Transcript lookback window (default 7)")
    ap.add_argument("--runs", type=int, default=5, help="Benchmark runs per hook (default 5)")
    ap.add_argument("--formatter-save-s", type=float, default=DEFAULTS["formatter_save_s"])
    ap.add_argument("--guard-save-s", type=float, default=DEFAULTS["guard_save_s"])
    ap.add_argument("--guard-hit-rate", type=float, default=DEFAULTS["guard_hit_rate"])
    ap.add_argument("--notify-save-s", type=float, default=DEFAULTS["notify_save_s"])
    ap.add_argument("--notify-rate", type=float, default=DEFAULTS["notify_rate"])
    ap.add_argument("--custom-save-s", type=float, default=DEFAULTS["custom_save_s"])
    ap.add_argument("--save", help="Write report to this markdown file")
    ap.add_argument("--no-bench", action="store_true", help="Skip latency benchmarking")
    args = ap.parse_args()

    settings_files = [Path(args.settings)] + [Path(p) for p in args.extra]
    hooks = load_hooks(settings_files)
    if not hooks:
        print("[error] no hooks found in provided settings", file=sys.stderr)
        return 2

    for h in hooks:
        h.kind = classify(h)

    print(f"[hook-eval] {len(hooks)} hooks across {len(settings_files)} file(s)", file=sys.stderr)
    mine_frequency(hooks, args.days, PROJECTS_DIR)

    if not args.no_bench:
        for h in hooks:
            print(f"[hook-eval] benchmarking {h.event}[{h.matcher}] x{args.runs}", file=sys.stderr)
            benchmark(h, runs=args.runs)

    overrides = {
        "formatter_save_s": args.formatter_save_s,
        "guard_save_s": args.guard_save_s,
        "guard_hit_rate": args.guard_hit_rate,
        "notify_save_s": args.notify_save_s,
        "notify_rate": args.notify_rate,
        "custom_save_s": args.custom_save_s,
    }
    for h in hooks:
        apply_savings(h, overrides)

    report = render(hooks, args.days)
    print(report)

    if args.save:
        out = Path(args.save).expanduser()
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(report + "\n")
        print(f"\n[hook-eval] saved to {out}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
