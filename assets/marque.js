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
  icone: "assets/marque/icone.svg",
  // Mentions légales (page confidentialite.html#mentions) : informations publiques de l'entreprise de Lili.
  // Vides = la ligne n'est pas affichée. Communiquées par Lili le 21/11/2026 pour être publiées.
  mentions: { statut: "Entrepreneuse individuelle (micro-entreprise)", siret: "519 399 273 00050", adresse: "33 rue Jean Jaurès, 59510 Hem", email: "lilivergote@gmail.com" }
};
