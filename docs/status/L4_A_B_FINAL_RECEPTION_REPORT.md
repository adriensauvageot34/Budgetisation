# L4-A / L4-B — Réception finale avant intégration

17 octobre 2026 — **VERDICT = NOT_READY**.

Les corrections ciblées, les contrôles financiers et le build complet passent. Le gate restant concerne les confirmations natives : leur réponse Accepter/Annuler n’a pas été certifiée de bout en bout dans le navigateur intégré. Aucun GO de fusion n’est déduit. Aucun changement Production.

## Références exactes

- Branche : `codex/composer-v3-l4-b-all-assets-interactive`.
- Point de départ publié #55 : `3eb481a61f524ca7f01208178d9cfeb1acee74a4` ; produit précédent `b7c3127d3db1f808108ab5422631523359939af1`.
- Dépendance #54 conservée : `eb8e671c46334e2a5931cb04e1699d0a769a8a5d`, PR ouverte et non fusionnée.
- **SHA produit final réellement testé : `11ac9d7e83704ae587e24b9479a23518a905f455`.** Le dernier commit documentaire ne change pas ce code.
- [PR #55](https://github.com/adriensauvageot34/Budgetisation/pull/55), empilée sur [#54](https://github.com/adriensauvageot34/Budgetisation/pull/54), sans réécriture des SHA publiés.
- [Preview de réception](https://budgetisation-7edbax5bi-adriensauvageot34-6137s-projects.vercel.app) : `dpl_9fdLcufQsmGhVpKaj19vz8m4eLdA`, **READY**, SHA `11ac9d7`, target `null` (Preview). Aucun changement de configuration globale ni promotion.

La première correction est `004a665` ; `11ac9d7` ajoute trois raccordements ciblés dans Restaurant (callbacks personne/lieu et « Décider plus tard »). Les 15 groupes contractuels, la parité 198, Restaurant, C8, TypeScript et le build complet ont été exécutés sur `11ac9d7`. Les autres régressions et les preuves UX approfondies sont conservées à `004a665` ; leurs chemins financiers sont inchangés. Le sélecteur Restaurant a été rejoué sur `11ac9d7`.

## Anomalies et corrections

### RAW perdu lors d’un changement de question — correctif implémenté, abandon natif à certifier

Sur le point de départ : Restaurant → montant manuel 60 → Retour au résumé → réouverture. Les 60 disparaissaient sans confirmation ; le champ redevenait UNKNOWN. Ce FAIL navigateur est conservé dans [ux-reception.json](evidence/l4-final-reception/ux-reception.json).

Les ateliers hors Soirée ne signalaient pas tous leurs buffers au registre RAW. Certaines fermetures du shell ne consultaient ce registre que pour Soirée. Correction limitée à la présentation :

- Raccordement au **registre InlineEditRegistry existant**, avec un petit hook de cycle de vie ; aucune deuxième file de sauvegarde, aucune admission automatique.
- Cadeau, catalogue, visite et postes du séjour enregistrent leurs buffers RAW. Leurs questions peuvent changer sans perdre les valeurs en mémoire.
- Restaurant garde une confirmation d’abandon avant les transitions qui remplacent son buffer. Les champs contrôlés et les choix de prix signalent RAW ; une erreur ne le supprime pas.
- Fermeture, changement de carte, ouverture d’un autre éditeur et Undo utilisent le garde existant pour tous les ateliers. Les formulaires d’équipement génériques y participent également.
- Une admission explicite, y compris après normalisation sans changement sémantique, remet correctement le buffer à l’état admis ; une édition suivante réarme RAW.

Preuve exécutée sur `004a665` (code Cadeau identique au SHA final) : Cadeau prix 26 → Occasion → Prix conserve 26 et « Saisie non validée » ; validation normalisée sans changement sémantique retire le signal, puis une modification d’objet le rétablit. Visite amis conserve un repère souple entre deux questions. **Le parcours d’abandon natif lui-même reste non certifié**, voir le gate ci-dessous.

### Sens de « budget » — clarifié

Restaurant/Activité/Achat indiquent explicitement « Budget = coût économique prévu, pas un plafond ». La liaison Achat est nommée « Enveloppe liée ». Séjour affiche « Coût total prévu » ou « Tarif par nuit ». Les composants affichent un prix unitaire prévu ou un coût par lot. Soirée précise que le budget principal est le coût prévu des entrées.

Aucun plafond n’a été créé ni valorisé comme une dépense. Le Compiler, Finance V2 et les contrats de liaison d’enveloppe restent inchangés.

### Échec de préparation du nouveau test — corrigé dans le test

Le premier lancement du script de réception utilisait un slot `extras` inexistant sur les visites : `CONTEXT_SLOT_UNKNOWN`. Le poste propriétaire est `hospitality`. Le test a été corrigé pour utiliser ce vrai contrat, sans élargir l’owner. Le journal initial est conservé ; il ne prouve pas une régression produit. Les clés de presets ont également été vérifiées dans le registre réel.

## Résultats par scénario V5

Le nouveau script exécute **15 groupes pour les 14 scénarios**, avec deux branches distinctes pour V1. Chaque groupe termine par Apply C0 sur PGlite → READ officiel → modification d’un prix isolé → nouvelle application/relecture, en comparant les identités, champs et composants indépendants. Ce ne sont pas des sessions JWT.

| Scénario | Branches réellement vérifiées dans cette réception | Résultat et limite |
|---|---|---|
| S1 | Bouteille SHARED, poste UNKNOWN, aller/retour indépendants, retour remplacé seul ; régressions Soirée riches | PASS contractuel ; V5 global PARTIAL |
| S2 | Variante domicile, aucune date imposée, composants partagés/UNKNOWN et ajout volontaire de trajet ; réédition | PASS contractuel ; hôte structuré non publié |
| A1 | Tarif PERSON explicitement prouvé, deux personnes, parking ajouté ultérieurement ; réédition | PASS contractuel ; pas de certification fournisseur réel |
| A2 | Entrée UNKNOWN, parking connu 4, conservation de l’incertitude ; réédition | PASS contractuel ; matériel enfant non publié inchangé |
| R1 | Total 60 remplacé par 45+15, ajout UNKNOWN, champ de canal invalide refusé ; prix isolé | PASS contractuel ; confirmation native total/détail NOT_RUN_TOOL |
| R2 | Total 15 remplacé par 12+3 ; canal inventé refusé, date non imposée | PASS contractuel ; canal hors capacité conservé hors UI |
| R3 | Total 35 remplacé par 30+5 ; ajout ultérieur UNKNOWN sans double total | PASS contractuel ; confirmation native des frais NOT_RUN_TOOL |
| V1 | **family-visit et friend-visit séparés** ; contribution `hospitality`, destination indépendante, voiture→train conserve contribution et identités | PASS contractuel des deux ; RAW amis et changement de mode Famille PASS navigateur |
| W1 | Hébergement TOTAL 240 et activité enfant 12, aucun total parent ajouté ; relecture et prix hébergement seul | PASS contractuel ; contrôles P11 rejoués ; intermois exclu |
| P1 | Achat Vêtements quantité 2, complément UNKNOWN ; domaine conservé et prix isolé | PASS contractuel ; liaison d’enveloppe et anti-double compte couverts par régressions |
| P2 | Amazon, montant et frais distincts, aucune catégorie Vêtements déduite | PASS contractuel ; ventilation multi-domaines non publiée |
| P3 | Livre `gift:book`, destinataire changé seul, occasion/classification/emballage conservés ; prix 20+5 | PASS contractuel ; RAW, erreur/reprise et Reload navigateur ciblés |
| B1 | Deux produits dont un UNKNOWN, prix manuel, aucun lien Renewal inventé ; un prix change seul | PASS contractuel ; adoption exacte Renewal non publiée |
| M1 | Lessive via `purchase`, deux paquets, frais UNKNOWN ; quantité et domaine Maison conservés | PASS contractuel ; aucun stock ni conditionnement comparable inventé |

**112 cas V5 = NOT_CERTIFIED.** Les 15 groupes approfondis complètent la couverture précédente 47 presets / 13 génériques ; ils ne valent pas 112 PASS. Les invariants de provenance des suggestions sont rejoués par L4-A ; un refus visuel explicite de suggestion contact/lieu n’a pas été exécuté dans cette campagne, les lieux synthétiques ne possédant pas le lien contact propriétaire. Aucun lien n’a été fabriqué pour le faire passer.

### Différences entre templates

`friend-visit` conserve l’éditeur de champs publiés, ses sockets et son template ; le writer spécialisé Famille le refuse avec `COMPOSER_FAMILY_VISIT_TARGET_INVALID`. Famille conserve son éditeur de trajet enrichi. Les tests appliquent leurs opérations réelles sans convertir l’un dans l’autre. Les deux utilisent `hospitality`, et le changement de mode ne supprime pas cette contribution.

Les achats simples et les presets Maison utilisent tous deux `purchase`. Le test distingue Vêtements, Amazon et Lessive : pas de participants forcés, pas de domaine Vêtements injecté sur Amazon/Maison, mêmes quantités et conservation des frais. Une enveloppe est une liaison admissible, distincte du prix de l’article.

## Réception UX exécutée

Environnement : vrais composants React minifiés de production, hôte local isolé, Compiler/V2, fournisseurs synthétiques et HTTP Draft en mémoire. Aucun profil personnel ou Supabase réel utilisé.

- RAW Restaurant et montant 60 signalé ; sauvegarde explicite et fermeture après admission.
- Cadeau : objet RAW → occasion → objet conservé ; prix invalide -1 gardé avec message, Apply désactivé, correction 25 ; après Reload, objet/occasion/25 fidèles ; modification du prix seul à 26 sur le SHA final.
- Cadeau : admission sans changement sémantique puis nouveau changement, registre RAW correctement réarmé.
- Visite amis : repère « Un dimanche, encore à préciser », changement de question, sauvegarde fidèle.
- Famille : parking manuel 4 dans Voiture → Train → sauvegarde ; relecture HTTP confirme `parking=UNKNOWN`, `fare=UNKNOWN`, route absente et aucune date inventée.
- Données HTTP finales : version 11, digest `c5e46c2008b49cba1c80a292b6b4205fd9db15d77e2f2a998cf3df89d9b223f4`, cinq contextes synthétiques. Plans=0, revisions=0, RPC Apply=0, écritures distantes et canaris=0.

La géométrie du prix Cadeau sur `004a665` (présentation inchangée dans le SHA final) a été **mesurée**, avec largeur effective 1440×900, 1728×900 et 1920×1080 : panneau client/scroll 511/511, formulaire 438/438, bas du panneau 636,8, dock à 740,8 ou 920,8 ; aucun débordement horizontal. Ce n’est pas une nouvelle certification géométrique exhaustive de chaque branche. Les mesures sont dans [ux-reception.json](evidence/l4-final-reception/ux-reception.json). Aucune capture image archivée n’est revendiquée.

## Gate natif restant — réellement bloquant pour cette réception

Le clic « Retour au résumé » avec RAW a ouvert une confirmation native. L’outil a ensuite échoué sur `Input.dispatchMouseEvent` puis `Emulation.setFocusEmulationEnabled`, y compris pour `getJsDialog` et fermer l’onglet. L’utilisateur a répondu « Annulé ». À la reprise, le panneau était au résumé sans le montant RAW : la réponse effective et l’ordre des commandes ne sont pas établis. **Ce cas n’est ni PASS ni une preuve permettant d’attribuer un nouveau défaut produit ; statut INCONCLUSIVE_TOOL.** Aucune écriture financière n’a eu lieu. Les boucles de relance ont été arrêtées.

Les branches Accepter/Annuler total↔détail et frais inclus restent `NOT_RUN_TOOL`. Les calculs de remplacement sont testés via les vraies opérations, et le registre refuse l’abandon lorsque son callback de confirmation répond false ; cela ne remplace pas la réception du dialogue natif.

**Protocole manuel ciblé restant**, sur fixture uniquement :

1. Restaurant total admis 60 ; saisir 61 sans valider ; Retour au résumé → **Annuler** : 61 doit rester ; fermer → Annuler : panneau et 61 restent ; valider : un seul poste 61.
2. Repartir du total 60 ; Détailler → Annuler : total 60 inchangé ; accepter puis renseigner 45 et complément 15 : 60, pas 120. Sans valider le détail RAW, le Plan et le Draft admis restent inchangés.
3. Depuis le détail 45+15, Montant total → Annuler : détail intact ; accepter, saisir 60, confirmer le remplacement : compléments retirés une seule fois ; Undo restitue le détail.
4. Livraison total 35 frais compris ; ajout frais → Annuler : 35 ; détail 30+5 après confirmation : 35. Un ajout explicitement déclaré hors total peut être additionnel et ne doit pas être présenté comme « inclus ».

Une [fixture locale prête](http://127.0.0.1:3203/?scenario=L1_RECEPTION_PICKER&durable=1&delayRead=1000) reste ouverte avec un seul Restaurant, Alice fictive et un total 60 admis ; aucun Plan créé. Aucun script à lancer par l’utilisateur.

Ces confirmations n’ont pas été remplacées par des faux boutons ni une fonction `window.confirm` désactivée. Fermer ce gate suffit ; aucune nouvelle tournée générale d’audit n’est recommandée.

## Régressions et build

| Contrôle exécuté | Statut |
|---|---|
| `node scripts/check-l4-final-reception.mjs` | PASS : 15 groupes / 14 scénarios, Apply/relecture/prix seul sur PGlite |
| `node scripts/check-planner-performance-parity.mjs` sur le SHA final | **PASS 22 × 9 = 198**, golden strictement inchangé |
| L4-A, Restaurant L1, P05-B, P10, P11, P12 | PASS, codes de sortie 0 |
| P03 interaction/ordre des réponses, P13 Apply/CAS/idempotence, Draft HTTP | PASS, codes de sortie 0 |
| C8 source, dont C8-017 | PASS, contrôle conservé |
| TypeScript final `--noEmit --incremental false` | PASS local, sortie 0 |
| Build Next complet du SHA `11ac9d7` | **PASS Vercel Preview READY** : compilation, TypeScript, génération statique et déploiement des sorties |

Journaux et commandes dans [l4-reception-checks.json](evidence/l4-final-reception/l4-reception-checks.json) et [contrôles du SHA final](evidence/l4-final-reception/l4-reception-final-checks.json), [parité](evidence/l4-final-reception/l4-reception-final-parity.log), [build](evidence/l4-final-reception/l4-reception-final-vercel-build.log), [déploiement](evidence/l4-final-reception/l4-reception-final-deployment.json). Aucun nouvel essai local Next sur les dépendances liées : son blocage déjà documenté n’a pas été maquillé en succès.

## Authentification, limites et décision

- `AUTH_SUPABASE_SAVE_NEW_SESSION = NOT_RUN_AUTH` : aucun environnement authentifié isolé autorisé identifié pour ce cycle. Le projet principal et le compte personnel n’ont pas servi de substitut. Cette limite est explicitement permise dans la mission.
- `APPLY_CONTROLLED_FIXTURE = EXECUTED_PASS_PGLITE_SYNTHETIC_ONLY` ; `APPLY_AUTHENTICATED = NOT_RUN`.
- `NATIVE_INTERACTIONS = PARTIAL / INCONCLUSIVE_TOOL` ; total/détail Accepter/Annuler `NOT_RUN_TOOL` : réserve **non clôturée**, non implicitement acceptée.
- Capacités non publiées et intermois inchangés ; aucun choix trompeur ajouté. SNAP-3, owners, migrations, goldens et sources financières inchangés.
- `PRODUCTION_MERGED = NO` ; `PRODUCTION_DEPLOYED = NO` ; #54 et #55 non fusionnées.

**NOT_READY** signifie ici : correctif publié pour revue, preuves locales et build réussis, mais pas de certification finale des confirmations natives. La sauvegarde authentifiée reste une limite explicite distincte ; elle n’est pas présentée comme le blocage à résoudre par de nouvelles écritures. Après le protocole ciblé ci-dessus, une décision d’intégration peut être prise sans rejouer les campagnes déjà PASS. Aucun GO automatique n’est demandé ou appliqué.

Rollback des correctifs : revert `11ac9d7` puis `004a665` ; aucun rollback SQL ni effacement de Draft. Les commits antérieurs et la dépendance #54 sont conservés.
