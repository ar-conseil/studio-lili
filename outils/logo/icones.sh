#!/bin/zsh
# Icônes PNG de l'application, rendues par Chrome sans écran à partir des SVG de assets/marque/ (après dessiner.py).
#   icone-bureau.svg (coins arrondis, marge transparente) -> icone-192.png, icone-512.png  (Mac, Windows, Android « any »)
#   icone.svg (carré plein)                              -> icone-180.png (iPhone), icone-512-masque.png (Android « maskable »),
#                                                           icone-32.png, icone-64.png (onglet du navigateur)
set -euo pipefail
cd "$(dirname "$0")/../../assets/marque"
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
TMP=$(mktemp -d); trap 'rm -rf "$TMP"' EXIT
rendre() { # source taille sortie
  printf '<!doctype html><html><body style="margin:0;background:transparent"><img src="file://%s" width="%s" height="%s" style="display:block"></body></html>' \
    "$PWD/$1" "$2" "$2" > "$TMP/page.html"
  "$CHROME" --headless=new --disable-gpu --hide-scrollbars --default-background-color=00000000 --force-device-scale-factor=1 \
    --allow-file-access-from-files --window-size="$2,$2" --screenshot="$PWD/$3" "file://$TMP/page.html" >/dev/null 2>&1
  echo "   $3"
}
rendre icone-bureau.svg 192 icone-192.png
rendre icone-bureau.svg 512 icone-512.png
rendre icone.svg 512 icone-512-masque.png
rendre icone.svg 180 icone-180.png
rendre icone.svg 64 icone-64.png
rendre icone.svg 32 icone-32.png
