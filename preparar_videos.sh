#!/bin/sh
# Uso: ./preparar_videos.sh video_original.mp4 nombre
[ $# -eq 2 ] || { echo "Uso: $0 video_original nombre"; exit 1; }
out="$(dirname "$0")/assets/video"
ffmpeg -y -i "$1" -an -vf "crop=ih*4/3:ih,scale=960:720" -c:v libx264 -preset veryfast -crf 26 -pix_fmt yuv420p -movflags +faststart "$out/$2.mp4"
ffmpeg -y -i "$1" -an -vf "crop=ih:ih,scale=480:480" -c:v libx264 -preset veryfast -crf 28 -pix_fmt yuv420p -movflags +faststart "$out/$2_card.mp4"
