/* Le nom de l'outil, de sa propriétaire, de l'assistant et le logo : un seul endroit à changer quand Lili aura choisi.
   Les fichiers du logo sont dans assets/marque/ (dessinés par outils/logo/dessiner.py). Penser aussi à
   manifest.webmanifest (« name », « short_name ») et au <title> de index.html, que le navigateur lit avant ce fichier. */
window.MARQUE = {
  outil: "Studio Lili",            // nom de l'application (nom de travail)
  proprietaire: "Lili Rouzier",
  metier: "community manager",
  assistant: "l'assistant",         // nom de l'assistant IA, au choix de Lili
  logo: "assets/marque/logo.svg",
  logoClair: "assets/marque/logo-clair.svg",
  icone: "assets/marque/icone.svg"
};
