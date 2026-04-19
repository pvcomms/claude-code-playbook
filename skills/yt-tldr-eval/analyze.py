#!/usr/bin/env python3
"""Deeper analysis of yt-tldr-eval run outputs. Uses only cached data — zero new spend.

Produces report_v2.md with:
  - Leaderboard with cost-adjusted rank
  - Per-channel breakdown (who wins which content type)
  - Per-video winners (consistency check)
  - Agreement matrix (which videos stump everyone)
  - Hallucination gallery (grouped by severity hint)
  - Latency/quality Pareto
  - Duration-bucket × model heatmap

Usage: analyze.py /path/to/run_dir
"""
from __future__ import annotations

import json
import sys
from collections import defaultdict
from pathlib import Path
from statistics import mean, stdev


MODEL_SHORT = {
    "claude-opus-4-7": "opus",
    "claude-sonnet-4-6": "sonnet",
    "claude-haiku-4-5-20251001": "haiku",
    "gpt-5": "gpt",
    "gemini-2.5-pro": "gemini",
}


def load_run(run_dir: Path) -> tuple[dict, list]:
    videos = {}
    for f in (run_dir / "transcripts").glob("*.json"):
        d = json.loads(f.read_text())
        if d.get("transcript") and not d.get("error"):
            videos[d["id"]] = d
    summaries = []
    for f in (run_dir / "summaries").glob("*.json"):
        d = json.loads(f.read_text())
        d["_short"] = MODEL_SHORT.get(d["model"], d["model"])
        vid = d["video_id"]
        score_path = run_dir / "scores" / f"{vid}__{d['_short']}.json"
        if score_path.exists():
            sc = json.loads(score_path.read_text())
            d["scores"] = sc.get("scores", {})
            d["judge_cost_usd"] = sc.get("judge_cost_usd", 0)
        summaries.append(d)
    return videos, summaries


def fmt_row(cells: list, widths: list) -> str:
    return "| " + " | ".join(str(c).ljust(w) for c, w in zip(cells, widths)) + " |"


def bar(n: float, max_n: float, width: int = 20) -> str:
    if max_n == 0:
        return " " * width
    filled = int(round(n / max_n * width))
    return "█" * filled + "░" * (width - filled)


def analyze(run_dir: Path) -> str:
    videos, summaries = load_run(run_dir)
    out = []

    # Index summaries by (vid, model)
    by_vm = {(s["video_id"], s["_short"]): s for s in summaries if s.get("scores") and "faithfulness" in s["scores"]}

    models = sorted({s["_short"] for s in summaries if s.get("scores") and "faithfulness" in s["scores"]})

    out.append(f"# yt-tldr-eval — deep analysis\n")
    out.append(f"Videos: **{len(videos)}** · Models: **{len(models)}** · Scored summaries: **{len(by_vm)}**\n")

    # ------------------------------------------------------------------
    # 1. Headline leaderboard with cost-adjusted score
    # ------------------------------------------------------------------
    out.append("## 1. Leaderboard — quality, cost, value\n")
    stats = {}
    for m in models:
        rs = [s for (v, mm), s in by_vm.items() if mm == m]
        sc = [s["scores"] for s in rs]
        stats[m] = {
            "n": len(rs),
            "faith": mean(x.get("faithfulness", 0) for x in sc if "faithfulness" in x) if sc else 0,
            "compr": mean(x.get("compression", 0) for x in sc if "compression" in x) if sc else 0,
            "cover": mean(x.get("coverage", 0) for x in sc if "coverage" in x) if sc else 0,
            "style": mean(x.get("style", 0) for x in sc if "style" in x) if sc else 0,
            "halluc": mean(len(x.get("hallucinations", [])) for x in sc) if sc else 0,
            "missed": mean(len(x.get("missed", [])) for x in sc) if sc else 0,
            "cost_per": mean(s.get("cost_usd", 0) for s in rs) if rs else 0,
            "latency": mean(s.get("latency_s", 0) for s in rs) if rs else 0,
        }
        stats[m]["avg"] = mean([stats[m]["faith"], stats[m]["compr"], stats[m]["cover"], stats[m]["style"]])
        stats[m]["value"] = stats[m]["avg"] / max(stats[m]["cost_per"], 0.0001)

    out.append("| Model | Faith | Compr | Cover | Style | Avg | Halluc | Latency | $/video | Quality/$ |")
    out.append("|-------|-------|-------|-------|-------|-----|--------|---------|---------|-----------|")
    for m, s in sorted(stats.items(), key=lambda x: -x[1]["avg"]):
        out.append(
            f"| **{m}** | {s['faith']:.2f} | {s['compr']:.2f} | {s['cover']:.2f} | "
            f"{s['style']:.2f} | **{s['avg']:.2f}** | {s['halluc']:.2f} | "
            f"{s['latency']:.1f}s | ${s['cost_per']:.3f} | **{s['value']:.1f}** |"
        )

    out.append("\n**Quality/$ winner** — highest quality-per-dollar. A model scoring 7.0 at $0.01/video beats a 7.5 at $0.05/video on this metric.\n")

    # ------------------------------------------------------------------
    # 2. Per-video winners
    # ------------------------------------------------------------------
    out.append("## 2. Per-video winners (faithfulness)\n")
    wins = defaultdict(int)
    ties = 0
    for vid in videos:
        scores = {m: by_vm[(vid, m)]["scores"].get("faithfulness", 0) for m in models if (vid, m) in by_vm}
        if not scores:
            continue
        top = max(scores.values())
        winners = [m for m, s in scores.items() if s == top]
        if len(winners) == 1:
            wins[winners[0]] += 1
        else:
            ties += 1
            for w in winners:
                wins[w] += 1 / len(winners)

    total_judged = sum(1 for vid in videos if any((vid, m) in by_vm for m in models))
    out.append(f"Videos with scored summaries: {total_judged}. Ties: {ties}.\n")
    out.append("| Model | Wins | Win rate |")
    out.append("|-------|------|----------|")
    for m, w in sorted(wins.items(), key=lambda x: -x[1]):
        out.append(f"| {m} | {w:.1f} | {w/total_judged*100:.0f}% |")

    # ------------------------------------------------------------------
    # 3. Per-channel breakdown
    # ------------------------------------------------------------------
    out.append("\n## 3. Per-channel breakdown (avg faithfulness)\n")
    by_channel = defaultdict(lambda: defaultdict(list))
    for vid, v in videos.items():
        for m in models:
            if (vid, m) in by_vm:
                f = by_vm[(vid, m)]["scores"].get("faithfulness")
                if f is not None:
                    by_channel[v["channel"]][m].append(f)

    channels = sorted(by_channel.keys(), key=lambda c: -len(by_channel[c][models[0]] if models[0] in by_channel[c] else []))
    out.append("| Channel | n | " + " | ".join(models) + " | Best |")
    out.append("|---------|---|" + "|".join(["---"] * (len(models) + 1)) + "|")
    for ch in channels:
        if not any(by_channel[ch][m] for m in models):
            continue
        n = max(len(by_channel[ch][m]) for m in models)
        if n < 2:
            continue
        row = [ch[:30], str(n)]
        avgs = {m: mean(by_channel[ch][m]) if by_channel[ch][m] else 0 for m in models}
        for m in models:
            row.append(f"{avgs[m]:.1f}" if by_channel[ch][m] else "—")
        best = max(avgs.items(), key=lambda x: x[1])[0]
        row.append(best)
        out.append("| " + " | ".join(row) + " |")

    # ------------------------------------------------------------------
    # 4. Hardest videos (low scores across ALL models)
    # ------------------------------------------------------------------
    out.append("\n## 4. Hardest videos (low faithfulness across all models)\n")
    vid_mean = {}
    for vid in videos:
        scores = [by_vm[(vid, m)]["scores"].get("faithfulness", 0) for m in models if (vid, m) in by_vm]
        if len(scores) >= 3:
            vid_mean[vid] = mean(scores)

    out.append("| Video | Channel | Avg faith | Duration |")
    out.append("|-------|---------|-----------|----------|")
    for vid, avg in sorted(vid_mean.items(), key=lambda x: x[1])[:10]:
        v = videos[vid]
        dur = v.get("duration") or 0
        dur_str = f"{dur//60}m" if dur < 3600 else f"{dur//3600}h{(dur%3600)//60}m"
        out.append(f"| {v['title'][:45]} | {v['channel'][:20]} | {avg:.2f} | {dur_str} |")

    # ------------------------------------------------------------------
    # 5. Easiest videos
    # ------------------------------------------------------------------
    out.append("\n## 5. Easiest videos (high agreement, high score)\n")
    out.append("| Video | Channel | Avg faith | Duration |")
    out.append("|-------|---------|-----------|----------|")
    for vid, avg in sorted(vid_mean.items(), key=lambda x: -x[1])[:10]:
        v = videos[vid]
        dur = v.get("duration") or 0
        dur_str = f"{dur//60}m" if dur < 3600 else f"{dur//3600}h{(dur%3600)//60}m"
        out.append(f"| {v['title'][:45]} | {v['channel'][:20]} | {avg:.2f} | {dur_str} |")

    # ------------------------------------------------------------------
    # 6. Duration-bucket heatmap
    # ------------------------------------------------------------------
    out.append("\n## 6. Faithfulness by duration\n")
    buckets = {"shorts (<5m)": [], "short (5-15m)": [], "medium (15-40m)": [], "long (40-90m)": [], "epic (>90m)": []}

    def bucket_name(d):
        if d < 300: return "shorts (<5m)"
        if d < 900: return "short (5-15m)"
        if d < 2400: return "medium (15-40m)"
        if d < 5400: return "long (40-90m)"
        return "epic (>90m)"

    buckets_m = defaultdict(lambda: defaultdict(list))
    for vid, v in videos.items():
        if not v.get("duration"):
            continue
        b = bucket_name(v["duration"])
        for m in models:
            if (vid, m) in by_vm:
                f = by_vm[(vid, m)]["scores"].get("faithfulness")
                if f is not None:
                    buckets_m[b][m].append(f)

    out.append("| Bucket | n | " + " | ".join(models) + " |")
    out.append("|--------|---|" + "|".join(["---"] * len(models)) + "|")
    for b in ["shorts (<5m)", "short (5-15m)", "medium (15-40m)", "long (40-90m)", "epic (>90m)"]:
        if not buckets_m[b]:
            continue
        n = max(len(buckets_m[b][m]) for m in models) if buckets_m[b] else 0
        if n == 0:
            continue
        row = [b, str(n)]
        for m in models:
            if buckets_m[b][m]:
                row.append(f"{mean(buckets_m[b][m]):.1f}")
            else:
                row.append("—")
        out.append("| " + " | ".join(row) + " |")

    # ------------------------------------------------------------------
    # 7. Agreement / disagreement
    # ------------------------------------------------------------------
    out.append("\n## 7. Where models disagree (variance per video)\n")
    disagreement = {}
    for vid in videos:
        scores = [by_vm[(vid, m)]["scores"].get("faithfulness") for m in models if (vid, m) in by_vm]
        scores = [s for s in scores if s is not None]
        if len(scores) >= 3:
            disagreement[vid] = stdev(scores)

    out.append("High disagreement = models see the video very differently → judge may be unreliable or content is ambiguous.\n")
    out.append("| Video | σ | Range |")
    out.append("|-------|---|-------|")
    for vid, sd in sorted(disagreement.items(), key=lambda x: -x[1])[:8]:
        scores = {m: by_vm[(vid, m)]["scores"].get("faithfulness", 0) for m in models if (vid, m) in by_vm}
        out.append(f"| {videos[vid]['title'][:50]} | {sd:.2f} | {min(scores.values())}-{max(scores.values())} |")

    # ------------------------------------------------------------------
    # 8. Latency leaderboard (what are you paying for?)
    # ------------------------------------------------------------------
    out.append("\n## 8. Latency vs quality (Pareto)\n")
    out.append("```")
    out.append(f"{'Model':<8} {'Avg':<6} {'Lat':<7} {'$/vid':<8} Speed bar (slower →)")
    max_lat = max(s["latency"] for s in stats.values())
    for m, s in sorted(stats.items(), key=lambda x: x[1]["latency"]):
        out.append(f"{m:<8} {s['avg']:<6.2f} {s['latency']:<6.1f}s ${s['cost_per']:<7.3f} {bar(s['latency'], max_lat)}")
    out.append("```")

    # ------------------------------------------------------------------
    # 9. Hallucination gallery
    # ------------------------------------------------------------------
    out.append("\n## 9. Sharpest hallucinations by model\n")
    halls_by_m = defaultdict(list)
    for (vid, m), s in by_vm.items():
        for h in s["scores"].get("hallucinations", []):
            halls_by_m[m].append((videos[vid]["channel"], videos[vid]["title"][:50], h))

    for m in sorted(halls_by_m.keys()):
        out.append(f"\n### {m} — {len(halls_by_m[m])} flagged across {stats[m]['n']} videos ({stats[m]['halluc']:.1f}/video)\n")
        for ch, title, h in halls_by_m[m][:5]:
            out.append(f"- *{title}* ({ch}) — {h[:150]}")

    # ------------------------------------------------------------------
    # 10. Verdict
    # ------------------------------------------------------------------
    out.append("\n## 10. Verdict\n")
    top = sorted(stats.items(), key=lambda x: -x[1]["avg"])[0]
    value = sorted(stats.items(), key=lambda x: -x[1]["value"])[0]
    fastest = sorted(stats.items(), key=lambda x: x[1]["latency"])[0]
    cleanest = sorted(stats.items(), key=lambda x: x[1]["halluc"])[0]
    out.append(f"- **Quality leader:** `{top[0]}` ({top[1]['avg']:.2f} avg)")
    out.append(f"- **Value leader:** `{value[0]}` ({value[1]['value']:.1f} quality/$)")
    out.append(f"- **Speed leader:** `{fastest[0]}` ({fastest[1]['latency']:.1f}s avg)")
    out.append(f"- **Fewest hallucinations:** `{cleanest[0]}` ({cleanest[1]['halluc']:.2f}/video)")

    n_videos_scored = sum(1 for vid in videos if any((vid, m) in by_vm for m in models))
    n_summaries_scored = len(by_vm)
    out.append(f"\n*{n_videos_scored} videos, {n_summaries_scored} scored summaries. Judge: Haiku 4.5 (tight-budget mode).*")
    out.append(f"*Caveat: Haiku-as-judge is faster/cheaper than Opus but may be less discriminating. Scores cluster more tightly than Opus would produce.*")

    return "\n".join(out) + "\n"


def main():
    if len(sys.argv) < 2:
        print("usage: analyze.py <run_dir>", file=sys.stderr)
        sys.exit(1)
    run_dir = Path(sys.argv[1]).expanduser()
    if not (run_dir / "summaries").exists():
        print(f"no summaries/ in {run_dir}", file=sys.stderr)
        sys.exit(1)
    report = analyze(run_dir)
    out_path = run_dir / "report_v2.md"
    out_path.write_text(report)
    print(f"Wrote {out_path}")
    print("\n" + report)


if __name__ == "__main__":
    main()
