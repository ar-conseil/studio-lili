// Images de la signature de mail (photo dans son anneau, carte, bouton « avis Google »), servies sans connexion pour
// que Gmail et les autres messageries les affichent chez le destinataire.
//   GET ?k=<clé>  -> l'image (JPEG ou PNG), ou 404
// Seule la table signature_images est lue, une ligne à la fois, par sa clé aléatoire (64 caractères hexadécimaux,
// impossible à deviner). Rien d'autre n'est servi : pas de liste, pas de recherche, aucune donnée client.
import { base } from "../_partage/commun.ts";

const ENTETES = { "Access-Control-Allow-Origin": "*", "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "default-src 'none'" };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: { ...ENTETES, "Access-Control-Allow-Methods": "GET" } });
  if (req.method !== "GET" && req.method !== "HEAD") return new Response("non", { status: 405, headers: ENTETES });
  const cle = new URL(req.url).searchParams.get("k") ?? "";
  if (!/^[0-9a-f]{64}$/.test(cle)) return new Response("introuvable", { status: 404, headers: ENTETES });
  const { data } = await base().from("signature_images").select("type, contenu").eq("cle", cle).maybeSingle();
  if (!data || !["image/jpeg", "image/png"].includes(data.type)) return new Response("introuvable", { status: 404, headers: ENTETES });
  const octets = Uint8Array.from(atob(data.contenu), (c) => c.charCodeAt(0));
  // La clé change à chaque nouvelle version : l'image peut être gardée en cache un an
  return new Response(req.method === "HEAD" ? null : octets, { headers: { ...ENTETES, "Content-Type": data.type, "Cache-Control": "public, max-age=31536000, immutable" } });
});
