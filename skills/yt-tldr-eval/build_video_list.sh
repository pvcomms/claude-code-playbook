#!/bin/bash
# Generate 100-video seed list from 20 curated channels (5 recent each).
# Usage: ./build_video_list.sh > videos.json

set -e

CHANNELS=(
  "https://www.youtube.com/@lexfridman/videos"
  "https://www.youtube.com/@DwarkeshPatel/videos"
  "https://www.youtube.com/@aiexplained-official/videos"
  "https://www.youtube.com/@TwoMinutePapers/videos"
  "https://www.youtube.com/@MachineLearningStreetTalk/videos"
  "https://www.youtube.com/@ycombinator/videos"
  "https://www.youtube.com/@20VC/videos"
  "https://www.youtube.com/@a16z/videos"
  "https://www.youtube.com/@AllInPodcast/videos"
  "https://www.youtube.com/@veritasium/videos"
  "https://www.youtube.com/@kurzgesagt/videos"
  "https://www.youtube.com/@3blue1brown/videos"
  "https://www.youtube.com/@CGPGrey/videos"
  "https://www.youtube.com/@mkbhd/videos"
  "https://www.youtube.com/@Wendoverproductions/videos"
  "https://www.youtube.com/@PhilosophyTube/videos"
  "https://www.youtube.com/@HowMoneyWorks/videos"
  "https://www.youtube.com/@Vox/videos"
  "https://www.youtube.com/@smartereveryday/videos"
  "https://www.youtube.com/@TomScottGo/videos"
)

urls=()
for ch in "${CHANNELS[@]}"; do
  echo "  fetching: $ch" >&2
  while IFS= read -r id; do
    [ -n "$id" ] && urls+=("https://www.youtube.com/watch?v=$id")
  done < <(yt-dlp --flat-playlist --playlist-end 5 --print "%(id)s" "$ch" 2>/dev/null)
done

echo "{"
echo "  \"generated_at\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\","
echo "  \"videos\": ["
for i in "${!urls[@]}"; do
  if [ $((i+1)) -eq ${#urls[@]} ]; then
    echo "    \"${urls[$i]}\""
  else
    echo "    \"${urls[$i]}\","
  fi
done
echo "  ]"
echo "}"
