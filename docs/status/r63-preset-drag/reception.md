# R6.3 — transport exact du preset dans le drag natif

Base main réelle0a4cd6ba1d70700f9575d6a5704796003a539e04 vérifiée par fetch. Branche codex/composer-r6-3-preset-drag-fix. Le relevé R6.2 local68520b5 reste conservé sur son ancienne branche ; outputs/ antérieur hors lot.

## Correctif ciblé

- Library : vignette preset complète draggable si sa source publiée et BOARD_ZONE sont admis, busy et provenance respectés. Clic inchangé ; image décorative draggable=false.
- Session de drag UI typée ComposerDragSession, extension locale du source publié. Le preset est validé par catalogue/template/capacité BOARD_ZONE, puis porté avec le label exact dans le ref et le state du drag. Aucune variable globale, aucun nouveau champ persistant ou moteur.
- preparedDrop transporte presetKey ; place appelle choose avec la clé typée capturée avant endDrag. Les presets ne sont pas admis sur une cible autre que BOARD_ZONE. Les sources et cibles restent recontrôlées au dépôt.
- Le fallback dataTransfer générique conserve son comportement pour les assets ordinaires sans provider. Un preset sans session officielle est explicitement refusé, jamais réduit silencieusement au template générique. Board privilégie la session officielle même avant le rendu d'un grabbed et stoppe la propagation du drop. Le ref est consommé par endDrag avant toute création, donc pas de seconde mutation de la même session.
- Recette Preview/Auth existante : ?r63=1 expose seulement identités/templates/presets des contextes renvoyés par les vraies réponses du serveur synthétique. Aucun intercept réseau de navigateur ni lecture de React interne. Aucun writer distant/Apply. Production ne peut pas accéder à cette route de recette.

## Contrôles locaux exécutés

9 contrôles ciblés PASS : transport Bar/techno/Mascara ; même état sémantique complet obtenu par DROP clic et DROP préparé DnD à identité identique ; presetForContext exact ; même identité jamais dupliquée dans l'état ; mauvais preset/template et BLOCKED refusés ; handlers Library transmettent une fois la bonne clé ; images non draggables ; fallback preset sans provider refusé. Niveau SYNTHETIC_TRANSPORT_COMPILER_REACT, remoteWrites0, Applyfalse. Ce n'est pas une certification de geste natif. TypeScript final exit0. Une erreur de typage intermédiaire (clé string du contrat DROP versus union du catalogue) a été corrigée en utilisant la clé typée de la session déjà validée, sans cast ni fallback générique.

La carte fermée, sa mise en page, le hook de maintien180ms R6.2, la carte ouverte, les sources financières et la sérialisation ne sont pas modifiés. Finance198 : **UNCHANGED_NOT_RERUN**. Les preuves natives, build Vercel, PR et décision de livraison restent à renseigner après exécution. Pas de merge si le geste natif essentiel n'est pas démontré conformément au cahier R6.3.

## Réception navigateur réelle — un seul build produit

**PRODUCT_SHA_TESTED=640622c273fea34f5a5f6874d3632404759f02a0**. Preview https://budgetisation-5tpzuxyum-adriensauvageot34-6137s-projects.vercel.app, **dpl_FVec56ut1JfY1CJ8wAQfWjvvm3EY=READY**. Recette via alias de test officiellement affecté, session Auth existante, ?r63=1&r62=rich&barProbe=1. Le SHA est lu dans data-bar-product-sha. Viewport1440×900, réinitialisé à la fin. Aucun déploiement ou réglage Production.

Les gestes passent par la commande native drag de l'outil navigateur Codex, sans dispatchEvent ni autre pilote. Le probe existant n'enregistre que les événements isTrusted. Les identités ci-dessous proviennent de semanticState.contexts des réponses serveur réellement consommées par la recette, puis presetForContext lit fields.composerPresentation.presetKey ; ce n'est pas l'illustration du ghost.

| Parcours | Preuve et résultat |
|---|---|
|Clic Bar|PASS_BROWSER : un seul nouveau contexte7e8f5df7-c489-4346-8cef-f7e415222830, preset bar-apero ; le Bar riche initial est distinct.|
|DnD Bar|**PASS_NATIVE** : dragstart/drop/dragend réels, une seule création1a7a4118-815b-4a25-8227-6bd7c660e3e2, template night-out et preset bar-apero. Même éditeur Bar à la réouverture, aucun doublon image+parent.|
|DnD techno|**PASS_NATIVE** : d9e8889a-880c-4c0d-b936-d464c54b3273, night-out/techno-night, éditeur Configurer Soirée techno. Jamais Soirée générique.|
|DnD autre famille|**PASS_NATIVE** : Mascara673e8e7d-0f31-41e7-9e40-dc46a4da1572, beauty-restock/mascara, éditeur Configurer Mascara. Première tentative sans événement drop accepté : aucune création ; dépôt suivant sur la zone Board libre observée admis, une seule création.|
|Refus hors cible|PASS_NATIVE : vignette Mascara déposée sur l'en-tête Library ; digest et liste des contextes strictement inchangés. Le rejet d'une capacité explicitement BLOCKED est en plus testé localement.|
|Undo/Redo|PASS_BROWSER :5→4→5 contextes ; mêmes IDs, templates et presets, digest initial restitué. Une comparaison JSON brute a d'abord signalé false uniquement car l'ordre des propriétés d'objet différait ; comparaison des triplets ID/template/preset et digest donnent PASS, aucun contenu perdu.|
|Clic simple/cible directe|PASS_BROWSER : clic sur une vraie zone de fond non interactive ouvre Bar ; clic sur son montant ouvre l'action prévue ; aucun ghost actif et digest inchangé, aucune saisie effectuée. Réouverture du Bar issu du DnD confirme l'éditeur Bar.|
|Carte Bar maintien→corbeille→Undo|**NOT_RUN_NATIVE_POINTER** pour la séquence complète exigée. Une tentative native sur le fond a émis dragstart puis click, sans état dragging=true ni corbeille visible ; digest inchangé. L'API drag documentée ne fournit pas de phase de maintien configurable, donc aucune preuve qu'un maintien≥180ms ait été exercé. Ni PASS natif inventé, ni conclusion de défaut produit à partir d'un geste sans maintien prouvé. Le délai180ms et les protections ne sont pas abaissés pour satisfaire l'outil.|

Le label de session est exact pour chaque preset (contrôle local) et startDrag remplit synchroniquement le dragImage avec ce label. Pas de capture du ghost en cours de geste atomique : ne pas confondre ce fait avec une observation visuelle du ghost. Les autres champs RAW/date/lieu n'ont pas fait l'objet d'une nouvelle campagne de maintien natif ; leur mécanisme n'est pas modifié.

Preuves : native-evidence.json (événements natifs, transitions, identités, digests synthétiques), native-techno.png, native-mascara.png, native-board-result.png : trois captures utiles seulement. Aucun secret, cookie, JWT, donnée financière personnelle ou état Auth enregistré. Tous les scénarios restent en mémoire ; remoteWrites0, Applyfalse. Aucun foyer, Plan, Draft officiel ou source réelle modifié.

## Verdict et livraison

**DND_STATUS=READY_FOR_REVIEW_NOT_MERGED**. PR https://github.com/adriensauvageot34/Budgetisation/pull/73. TypeScript PASS ; build Next complet Preview READY ;9contrôles locaux PASS ; native Library/Bar/techno/Mascara et refus/absence de doublon PASS. **FINANCE=UNCHANGED_NOT_RERUN**.

**Seul gate de livraison restant : vraie séquence maintien≥180ms sur fond Bar fermé → déplacement → corbeille → Undo restituant IDs/contenus.** Le cahier R6.3 interdit précisément la fusion automatique tant que ce geste essentiel n'est pas vérifié. MERGE_SHA=NOT_MERGED, PRODUCTION=NOT_DEPLOYED pour R6.3 ; la Production R6.2 reste intacte. Aucun manque d'autorisation Git/Vercel, aucune migration requise.

Contrôle manuel minimal si l'outil ne peut pas maintenir : sur la Preview/recette ouverte, rejoindre la carte Bar riche68€, maintenir le fond libre à droite des consommations environ250ms puis glisser vers Retirer ; cliquer Undo et vérifier la même carte68€ et ses trois lignes. Ne pas cliquer Transformer en Plan. Le probe et le relevé serveur permettent de reprendre cette unique preuve sans recommencer les cas déjà PASS.

## Ajustement demandé après réception — survol du Canvas

Suppression de l'aperçu `packGhost` et de son CSS : aucun panneau de carte provisoire, icône générique, « Moment principal » ou « Estimation après ajout » n'est rendu dans le Canvas pendant le drag. Le contour de compatibilité et la surbrillance existante `data-drag-over` sont conservés ; aucune modification de la résolution du dépôt ou des presets. Le badge natif attaché au pointeur reste distinct de cet aperçu Canvas.

Vérifications exécutées : TypeScript exit 0, les 9 contrôles `check-r63-preset-drag.mjs` PASS, diff --check PASS. Les deux assertions historiques du smoke sont adaptées à l'absence de carte fantôme et à la surbrillance ; cette campagne navigateur n'est pas rejouée pour cet ajustement. Le gate maintien/corbeille demeure NOT_RUN_NATIVE_POINTER, sans fusion ni livraison Production.
