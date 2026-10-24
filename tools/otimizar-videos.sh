#!/usr/bin/env bash
# tools/otimizar-videos.sh — gera, a partir dos seus vídeos ORIGINAIS, os arquivos leves que o site usa.
#
# Uso:   bash tools/otimizar-videos.sh PASTA_DOS_ORIGINAIS [PASTA_DE_SAIDA]
#        (saída padrão: media/reel)         Precisa do ffmpeg instalado.
#
# Para cada arquivo  nome-do-video.mp4  gera:
#   nome-do-video-card.mp4      clipe de 10 s, 540x960, 24 fps, sem áudio (~0,3 a 1 MB) → toca no reel
#   nome-do-video.webp          capa 540x960                                              → capa do card e da grade
#   nome-do-video-preview.mp4   (opcional, com --preview) versão 720x1280 com áudio       → tela cheia, se não usar YouTube
#
# O nome do arquivo vira o "slug" em data/videos.json (minúsculas, sem acento, hífen no lugar de espaço).
# Depois de gerar, marque clip/poster/preview como true no data/videos.json.
# Vídeo horizontal é cortado no centro para 9:16 (o site é todo vertical).
set -euo pipefail

PREVIEW=0; ARGS=()
for a in "$@"; do [[ "$a" == "--preview" ]] && PREVIEW=1 || ARGS+=("$a"); done
IN="${ARGS[0]:-}"; OUT="${ARGS[1]:-media/reel}"
[[ -z "$IN" || ! -d "$IN" ]] && { echo "Uso: bash tools/otimizar-videos.sh PASTA_DOS_ORIGINAIS [PASTA_DE_SAIDA] [--preview]"; exit 1; }
command -v ffmpeg >/dev/null || { echo "ffmpeg não encontrado. Instale em https://ffmpeg.org/download.html"; exit 1; }
mkdir -p "$OUT"

# nome do arquivo → slug: minúsculas, sem acento, hífen no lugar de espaço/símbolo (ex.: "Casamento Ana & João" → casamento-ana-joao)
slug() {
  echo "$1" | LC_ALL=C.UTF-8 sed 'y/ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑáàâãäéèêëíìîïóòôõöúùûüçñ/AAAAAEEEEIIIIOOOOOUUUUCNaaaaaeeeeiiiiooooouuuucn/' \
    | tr '[:upper:]' '[:lower:]' | sed -E 's/[^a-z0-9]+/-/g; s/^-+|-+$//g'
}

shopt -s nullglob nocaseglob
for f in "$IN"/*.mp4 "$IN"/*.mov "$IN"/*.m4v; do
  base="$(basename "${f%.*}")"; s="$(slug "$base")"
  dur=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$f" | cut -d. -f1); dur=${dur:-10}
  ini=$(( dur > 14 ? dur / 5 : 0 ))          # começa a ~20% do vídeo (evita a abertura), ou do início se for curto
  echo "▶ $base  →  $s"
  ffmpeg -v error -y -ss "$ini" -t 10 -i "$f" \
    -vf "scale=540:960:force_original_aspect_ratio=increase:flags=lanczos,crop=540:960,fps=24,format=yuv420p" \
    -c:v libx264 -profile:v main -preset slow -crf 28 -maxrate 900k -bufsize 1800k -g 48 -an -movflags +faststart "$OUT/$s-card.mp4"
  ffmpeg -v error -y -ss "$ini" -i "$f" -frames:v 1 \
    -vf "scale=540:960:force_original_aspect_ratio=increase:flags=lanczos,crop=540:960" -c:v libwebp -quality 72 "$OUT/$s.webp"
  if [[ $PREVIEW -eq 1 ]]; then
    ffmpeg -v error -y -i "$f" \
      -vf "scale=720:1280:force_original_aspect_ratio=increase:flags=lanczos,crop=720:1280,fps=30,format=yuv420p" \
      -c:v libx264 -profile:v high -preset slow -crf 25 -maxrate 2500k -bufsize 5000k -c:a aac -b:a 96k -movflags +faststart "$OUT/$s-preview.mp4"
  fi
done
echo; echo "Pronto. Arquivos em $OUT:"; ls -lh "$OUT" | awk 'NR>1{print "  "$5"  "$9}'
