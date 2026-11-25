#!/usr/bin/env bash
# Lädt ein generiertes GLB und optimiert es für Mobilgeräte.
# Aufruf: scripts/fetch-model.sh <name> <url> [texturgröße]
set -euo pipefail
name="$1"; url="$2"; size="${3:-1024}"
raw="$(mktemp -d)/$name.glb"
curl -sfL -o "$raw" "$url"
npx gltf-transform optimize "$raw" "public/models/$name.glb" \
  --texture-compress webp --texture-size "$size" --compress meshopt --simplify false >/dev/null
ls -la "public/models/$name.glb" | awk '{print $5, $9}'
