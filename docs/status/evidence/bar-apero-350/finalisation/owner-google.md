# Contrat owner Google restant

R208/R209/R210 restent BLOCKED_OWNER. BarPlaceSearch sait rechercher, vérifier une fiche externe, conserver temporairement sa provenance et matcher strictement googlePlaceId si le DTO le publie. Aucun résultat Google ne devient automatiquement KNOWN.

Frontière : src/domain/phase2/planned-context.ts et projection composer-service ne fournissent pas le mapping Canonical Google requis ; aucun writer d'admission officiel autorisé par cette mission. Les fixtures exact/ambigu/tardif/429 sont des preuves de contrat, pas un appel fournisseur réel.

Contrat demandé au propriétaire des lieux : (1) lecteur authentifié exposant canonicalPlaceId + googlePlaceId exact + génération/provenance admissibles ; (2) méthode serveur d'admission explicite d'une fiche Google vérifiée, contrôle foyer/permissions, idempotence, relecture ; (3) DTO routable seulement après admission validée. Écritures éventuelles uniquement par cet owner, après revue distincte ; aucun stockage ou migration Composer proposé ici.

Critères : exact match conserve l'identité ; ambiguïté refusée ; nouveau lieu jamais KNOWN avant commit ; RAW/Undo et endpoints personnalisés conservés ; invalidation de source respectée. Repli actuel utilisable : lieux Canonical déjà publiés ou repère TEXT explicitement non routable. R345/R346 : appel réel et comparaison avec Déclarer une dépense nécessitent un environnement isolé avec Global préparé et fournisseur configuré.
