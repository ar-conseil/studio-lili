#!/usr/bin/env python3
"""Logo de Lili Rouzier : lettres vectorisées (polices libres OFL), aucune police à charger pour afficher le logo.

    python3 outils/logo/dessiner.py <dossier-des-polices>

Polices attendues dans le dossier (téléchargées depuis github.com/google/fonts, licence OFL) :
  BodoniModa[opsz,wght].ttf, CormorantGaramond-Italic[wght].ttf, Fraunces[SOFT,WONK,opsz,wght].ttf,
  Fraunces-Italic[SOFT,WONK,opsz,wght].ttf, Geist[wght].ttf
Dépendances : fonttools, uharfbuzz (dans un environnement Python à part, jamais dans le dépôt).

Écrit dans assets/marque/ :
  pistes/<piste>-logo.svg, pistes/<piste>-icone.svg   les trois pistes, pour choisir
  logo.svg, logo-clair.svg, icone.svg                  la piste retenue (RETENUE ci-dessous)
"""
import sys, os
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
import uharfbuzz as hb

POLICES = sys.argv[1] if len(sys.argv) > 1 else os.path.expanduser("~/.lili/polices")
RACINE = os.path.join(os.path.dirname(__file__), "..", "..", "assets", "marque")
RETENUE = "didone"   # choisie par Antonin le 21/11/2026

ENCRE, CREME, TERRE = "#1E1A17", "#F4EFE7", "#A9553A"   # encre chaude, papier crème, terre cuite

_cache = {}
def police(nom, loc):
    cle = (nom, tuple(sorted(loc.items())))
    if cle not in _cache:
        chemin = os.path.join(POLICES, nom)
        tt = TTFont(chemin)
        face = hb.Face(hb.Blob.from_file_path(chemin))
        f = hb.Font(face); f.set_variations(loc)
        _cache[cle] = (tt, f, tt.getGlyphSet(location=loc), tt["head"].unitsPerEm)
    return _cache[cle]

def texte(nom, loc, chaine, taille, x=0, y=0, approche=0.0):
    """Chaîne -> (chemin SVG, largeur). y = ligne de base ; approche en em (espacement ajouté entre les lettres)."""
    tt, f, gs, upm = police(nom, loc)
    buf = hb.Buffer(); buf.add_str(chaine); buf.guess_segment_properties()
    hb.shape(f, buf, {"kern": True, "liga": True})
    ordre = tt.getGlyphOrder(); k = taille / upm
    pen = SVGPathPen(gs, ntos=lambda v: ('%.1f' % v).rstrip('0').rstrip('.')); curseur = 0.0
    n = len(buf.glyph_infos)
    for i, (info, pos) in enumerate(zip(buf.glyph_infos, buf.glyph_positions)):
        nomg = ordre[info.codepoint]
        tp = TransformPen(pen, (k, 0, 0, -k, x + (curseur + pos.x_offset) * k, y - pos.y_offset * k))
        gs[nomg].draw(tp)
        curseur += pos.x_advance + (approche * upm if i < n - 1 else 0)
    return pen.getCommands(), curseur * k

def boite(nom, loc, chaine, taille, approche=0.0):
    """Largeur et hauteur de capitale, pour centrer."""
    _, l = texte(nom, loc, chaine, taille, approche=approche)
    tt = police(nom, loc)[0]
    cap = getattr(tt["OS/2"], "sCapHeight", 0) or tt["head"].unitsPerEm * 0.7
    return l, cap * taille / tt["head"].unitsPerEm

def svg(l, h, corps, titre, fond=None):
    f = f'<rect width="{l}" height="{h}" fill="{fond}"/>' if fond else ""
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {l} {h}" width="{l}" height="{h}" role="img" aria-label="{titre}">'
            f'<title>{titre}</title>{f}{corps}</svg>\n')

def chemin(d, couleur): return f'<path d="{d}" fill="{couleur}"/>'

BODONI = "BodoniModa[opsz,wght].ttf"
CORMI = "CormorantGaramond-Italic[wght].ttf"
FRAUN = "Fraunces[SOFT,WONK,opsz,wght].ttf"
FRAUNI = "Fraunces-Italic[SOFT,WONK,opsz,wght].ttf"
GEIST = "Geist[wght].ttf"

# ---------- Piste « didone » : monogramme LR en Didone, filet, nom en capitales espacées ----------
def didone(encre, accent):
    loc = {"opsz": 96, "wght": 500}
    lw, _ = boite(BODONI, loc, "LR", 120, -0.04)
    L, H = 560, 300
    d1, _ = texte(BODONI, loc, "LR", 120, (L - lw) / 2, 130, -0.04)
    nw, _ = boite(BODONI, {"opsz": 11, "wght": 500}, "LILI ROUZIER", 26, 0.32)
    d2, _ = texte(BODONI, {"opsz": 11, "wght": 500}, "LILI ROUZIER", 26, (L - nw) / 2, 208, 0.32)
    sw, _ = boite(GEIST, {"wght": 500}, "COMMUNITY MANAGER", 11.5, 0.34)
    d3, _ = texte(GEIST, {"wght": 500}, "COMMUNITY MANAGER", 11.5, (L - sw) / 2, 246, 0.34)
    filet = f'<rect x="{L/2-28}" y="160" width="56" height="1.4" fill="{accent}"/>'
    logo = svg(L, H, chemin(d1, encre) + filet + chemin(d2, encre) + chemin(d3, encre), "Lili Rouzier")
    # Icône : LR sur papier crème
    iw, _ = boite(BODONI, loc, "LR", 290, -0.04)
    di, _ = texte(BODONI, loc, "LR", 290, (512 - iw) / 2, 348, -0.04)
    icone = svg(512, 512, chemin(di, encre) + f'<rect x="221" y="392" width="70" height="5" fill="{accent}"/>', "Lili Rouzier", CREME)
    return logo, icone

# ---------- Piste « signature » : « Lili » en italique Garamond, point terre cuite, ROUZIER espacé ----------
def signature(encre, accent):
    loc = {"wght": 500}
    L, H = 560, 250
    lw, _ = boite(CORMI, loc, "Lili", 150)
    x0 = (L - lw) / 2 - 10
    d1, w1 = texte(CORMI, loc, "Lili", 150, x0, 132)
    point = f'<circle cx="{x0 + w1 + 12}" cy="126" r="7.5" fill="{accent}"/>'
    nw, _ = boite(GEIST, {"wght": 500}, "ROUZIER", 17, 0.62)
    d2, _ = texte(GEIST, {"wght": 500}, "ROUZIER", 17, (L - nw) / 2, 186, 0.62)
    sw, _ = boite(CORMI, {"wght": 600}, "community manager", 22)
    d3, _ = texte(CORMI, {"wght": 600}, "community manager", 22, (L - sw) / 2, 222)
    logo = svg(L, H, chemin(d1, encre) + point + chemin(d2, encre) + chemin(d3, encre), "Lili Rouzier")
    # Icône : L italique et son point, sur papier crème
    iw, _ = boite(CORMI, loc, "L", 330)
    xi = (512 - iw) / 2 - 22
    di, wi = texte(CORMI, loc, "L", 330, xi, 372)
    icone = svg(512, 512, chemin(di, encre) + f'<circle cx="{xi + wi + 18}" cy="363" r="15" fill="{accent}"/>', "Lili Rouzier", CREME)
    return logo, icone

# ---------- Piste « arche » : L italique dans une arche fine, nom en Fraunces ----------
def arche(encre, accent):
    L, H = 560, 210
    ax, ay, aw, ah = 24, 22, 120, 166
    r = aw / 2
    arc = (f'<path d="M{ax} {ay+ah} V{ay+r} A{r} {r} 0 0 1 {ax+aw} {ay+r} V{ay+ah} Z" fill="none" stroke="{accent}" stroke-width="2"/>')
    locl = {"opsz": 144, "wght": 380, "SOFT": 100, "WONK": 0}
    lw, _ = boite(FRAUNI, locl, "L", 104)
    dl, _ = texte(FRAUNI, locl, "L", 104, ax + (aw - lw) / 2 - 4, ay + ah - 34)
    d2, _ = texte(FRAUN, {"opsz": 72, "wght": 400, "SOFT": 50, "WONK": 0}, "Lili Rouzier", 50, 176, 112, -0.01)
    d3, _ = texte(FRAUNI, {"opsz": 14, "wght": 400, "SOFT": 50, "WONK": 0}, "community manager", 20, 178, 148)
    logo = svg(L, H, arc + chemin(dl, encre) + chemin(d2, encre) + chemin(d3, encre), "Lili Rouzier")
    s = 512; aw2, ah2 = 250, 340; ax2, ay2 = (s - aw2) / 2, (s - ah2) / 2 + 6; r2 = aw2 / 2
    arc2 = f'<path d="M{ax2} {ay2+ah2} V{ay2+r2} A{r2} {r2} 0 0 1 {ax2+aw2} {ay2+r2} V{ay2+ah2} Z" fill="none" stroke="{accent}" stroke-width="5"/>'
    lw2, _ = boite(FRAUNI, locl, "L", 215)
    dl2, _ = texte(FRAUNI, locl, "L", 215, ax2 + (aw2 - lw2) / 2 - 8, ay2 + ah2 - 70)
    icone = svg(s, s, arc2 + chemin(dl2, encre), "Lili Rouzier", CREME)
    return logo, icone

PISTES = {"didone": didone, "signature": signature, "arche": arche}

def ecrire(nom, contenu):
    os.makedirs(os.path.dirname(nom), exist_ok=True)
    with open(nom, "w") as f: f.write(contenu)

for nom, fn in PISTES.items():
    logo, icone = fn(ENCRE, TERRE)
    ecrire(os.path.join(RACINE, "pistes", nom + "-logo.svg"), logo)
    ecrire(os.path.join(RACINE, "pistes", nom + "-icone.svg"), icone)
    if nom == RETENUE:
        ecrire(os.path.join(RACINE, "logo.svg"), logo)
        ecrire(os.path.join(RACINE, "logo-clair.svg"), fn(CREME, "#D98B6E")[0])  # sur fond sombre
        ecrire(os.path.join(RACINE, "icone.svg"), icone)
        # Bureau (Mac, Windows) : coins arrondis comme les apps du système, avec une marge transparente
        corps = icone.split("</title>", 1)[1].replace(f'<rect width="512" height="512" fill="{CREME}"/>', "")
        ecrire(os.path.join(RACINE, "icone-bureau.svg"), svg(512, 512,
            f'<rect x="26.5" y="26.5" width="459" height="459" rx="104" fill="{CREME}" stroke="#1E1A17" stroke-opacity=".1"/><g transform="translate(26 26) scale(.8984)">' + corps.replace("</svg>", "") + "</g>",
            "Lili Rouzier"))
print("Logos écrits dans", os.path.normpath(RACINE), "· piste retenue :", RETENUE)
