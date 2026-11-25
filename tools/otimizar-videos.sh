#!/usr/bin/env bash
# tools/otimizar-videos.sh — gera, a partir dos seus vídeos ORIGINAIS, os arquivos que o site usa.
#
# Uso:   bash tools/otimizar-videos.sh PASTA_DOS_ORIGINAIS [PASTA_DE_SAIDA]
#        (saída padrão: media/reel)         Precisa do ffmpeg (e do python3 com Pillow para as capas).
#
# Para cada arquivo  nome-do-video.mp4 / .mov  gera:
#   nome-do-video-hd.mp4    vídeo completo em HD (lado maior 1920 px), H.264, até 30 fps, com som → toca no feed e no tela cheia
#   nome-do-video.webp      capa grande (lado maior 1920 px)                                         → feed e tela cheia
#   nome-do-video-sm.webp   capa pequena (lado menor 480 px)                                         → grade e destaques
#
# Qualidade: CRF 23 (preset slow) com teto de 6 Mbps — nítido na tela do celular sem pesar demais.
# Use os ORIGINAIS (exportados do editor ou do celular), não vídeos baixados do WhatsApp/Instagram: eles já vêm comprimidos.
# O nome do arquivo vira o "slug" em data/videos.json (minúsculas, sem acento, hífen no lugar de espaço).
# Depois de gerar, marque hd:true e poster:true no data/videos.json e coloque o bloco na posição certa (os melhores primeiro).
# O formato ORIGINAL é mantido (vertical 9:16, horizontal 16:9, quadrado...): nada é cortado.
set -euo pipefail

IN="${1:-}"; OUT="${2:-media/reel}"
[[ -z "$IN" || ! -d "$IN" ]] && { echo "Uso: bash tools/otimizar-videos.sh PASTA_DOS_ORIGINAIS [PASTA_DE_SAIDA]"; exit 1; }
command -v ffmpeg >/dev/null || { echo "ffmpeg não encontrado. Instale em https://ffmpeg.org/download.html"; exit 1; }
mkdir -p "$OUT"

# nome do arquivo → slug: minúsculas, sem acento, hífen no lugar de espaço/símbolo (ex.: "Casamento Ana & João" → casamento-ana-joao)
slug() {
  echo "$1" | LC_ALL=C.UTF-8 sed 'y/ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑáàâãäéèêëíìîïóòôõöúùûüçñ/AAAAAEEEEIIIIOOOOOUUUUCNaaaaaeeeeiiiiooooouuuucn/' \
    | tr '[:upper:]' '[:lower:]' | sed -E 's/[^a-z0-9]+/-/g; s/^-+|-+$//g'
}

FIT1920="scale=w='if(gte(iw,ih),1920,-2)':h='if(gte(iw,ih),-2,1920)':flags=lanczos"     # lado maior = 1920, sem cortar
shopt -s nullglob nocaseglob
for f in "$IN"/*.mp4 "$IN"/*.mov "$IN"/*.m4v; do
  base="$(basename "${f%.*}")"; s="$(slug "$base")"
  dur=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$f" | cut -d. -f1); dur=${dur:-10}
  cap=$(( dur > 6 ? dur / 4 : 0 ))            # capa: quadro a ~25% do vídeo (troque depois se quiser outro)
  fps=$(ffprobe -v error -select_streams v:0 -show_entries stream=r_frame_rate -of csv=p=0 "$f" | awk -F/ '{printf "%.0f",$1/$2}')
  pf=""; [[ ${fps:-30} -gt 30 ]] && pf=",fps=30"
  echo "▶ $base  →  $s"
  ffmpeg -nostdin -v error -y -i "$f" \
    -vf "$FIT1920$pf,format=yuv420p" \
    -c:v libx264 -profile:v high -level 4.1 -preset slow -crf 23 -maxrate 6M -bufsize 12M -g 60 \
    -c:a aac -b:a 160k -ac 2 -ar 48000 -movflags +faststart "$OUT/$s-hd.mp4"
  ffmpeg -nostdin -v error -y -ss "$cap" -i "$f" -frames:v 1 -vf "$FIT1920" "$OUT/$s-cap.png"
  python3 - "$OUT/$s-cap.png" "$OUT/$s" <<'PY'
import sys
from PIL import Image
im = Image.open(sys.argv[1]).convert('RGB')
im.save(sys.argv[2] + '.webp', quality=72, method=6)
k = 480 / min(im.size)
im.resize((round(im.width * k), round(im.height * k)), Image.LANCZOS).save(sys.argv[2] + '-sm.webp', quality=76, method=6)
PY
  rm -f -- "$OUT/$s-cap.png"
  # formato para o data/videos.json (a partir do vídeo gerado, já com a rotação do celular aplicada)
  wh=$(ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=s=x:p=0 "$OUT/$s-hd.mp4")
  fmt=$(awk -F'x' '{r=$1/$2; if(r>1.7&&r<1.8)print "16:9"; else if(r>.55&&r<.58)print "9:16"; else if(r>.97&&r<1.03)print "1:1";
        else if(r>.78&&r<.82)print "4:5"; else if(r>1.3&&r<1.36)print "4:3"; else if(r>.73&&r<.77)print "3:4"; else print $1":"$2}' <<<"$wh")
  echo "   $wh  →  \"formato\": \"$fmt\", \"hd\": true, \"poster\": true"
done
echo; echo "Pronto. Arquivos em $OUT:"; ls -lh "$OUT" | awk 'NR>1{print "  "$5"  "$9}'
