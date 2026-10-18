# Campagne physique de clôture

Candidat79e3bf0. React production compilé/minifié, serveur127.0.0.1:3237, transport HTTP et fournisseurs synthétiques. Aucune Auth Supabase, aucun Apply navigateur. Les huit scénarios ne sont pas huit PASS globaux.

## C2-01

PARTIAL : création immédiate, fermeture/réouverture, date/lieu/montant directs, dock. Clic vide et Plus tard confirmés en React; pas tous rejoués au final dans navigateur.

IDs à couvrir (ne vaut pas preuve automatique) : R013, R015, R017, R018, R019, R024, R025, R030, R031, R034, R145, R146, R148, R150, R158, R162, R169, R170.

IDs réellement clôturés dans cette campagne : R158.

## C2-02

PARTIAL : calendrier ArrowRight,1tabstop, deux participants ajoutés puis retirés, activation Enter; focus de toutes les transitions non certifié.

IDs à couvrir (ne vaut pas preuve automatique) : R013, R015, R017, R018, R019, R024, R025, R030, R031, R034.

IDs réellement clôturés dans cette campagne : .

## C2-03

PARTIAL : recherche canal, homonymes/adresses/provenance visibles, ciblage Date→Lieu conserve query, TEXT explicite. Google réel final et comparaison Déclarer une dépense NOT_RUN.

IDs à couvrir (ne vaut pas preuve automatique) : R145, R146, R148, R150, R158, R162, R169, R170, R192, R196, R197, R208, R209, R210, R212, R214.

IDs réellement clôturés dans cette campagne : R158, R196, R212.

## C2-04

PARTIAL :60 regroupés→Détailler→BièreUNKNOWN→prix6, RAW Continuer, Before Vodka20SHARED/diluant4ITEM/snackUNKNOWN,15lignes+9Before et relecture locale. Suppression de la première bouteille reste refusée pour préserver son groupe; pas de promotion automatique de slot.

IDs à couvrir (ne vaut pas preuve automatique) : R218, R242, R255, R257, R264, R265.

IDs réellement clôturés dans cette campagne : R218, R264.

## C2-05

PARTIAL : Voiture→départ manquant, Maison choisie, véhicule explicite, retour inverse puis Taxi confirmé, coût12 édité directement; provider réel et tous anciens A/R NOT_RUN.

IDs à couvrir (ne vaut pas preuve automatique) : R270, R273, R274, R275, R276, R282, R287, R296.

IDs réellement clôturés dans cette campagne : R270, R273, R274, R275.

## C2-06

PARTIAL : dense stabilisé aux1152x720/1440x900/1728x900/1920x1080; aucune collision mesurée, aucun scroll Bar/dock; clipping1152 corrigé par page externe. Zoom125 dense exécuté, toutes transitions NOT_RUN. Les premiers samples de resize sont transitoires, pas du PASS.

IDs à couvrir (ne vaut pas preuve automatique) : R039, R040, R041, R042, R043, R044, R045, R046, R054, R055, R056, R057, R058, R060, R061, R062, R063, R064, R065, R068, R069, R070, R073, R076, R077, R078, R079, R080, R081, R082, R083, R084, R085, R087, R316, R317, R318, R319, R320, R321, R322, R323, R324, R325, R326, R328, R329.

IDs réellement clôturés dans cette campagne : R041, R043, R044, R045, R054, R317.

## C2-07

PARTIAL : ERROR sauvegarde avec PreviewFRESH, puis repriseSAVED. Réponses perdues/CAS/refus/suppression testés en React/HTTP, pas drag natif ni chronométrage de suppression réel.

IDs à couvrir (ne vaut pas preuve automatique) : R307, R308, R314, R315.

IDs réellement clôturés dans cette campagne : .

## C2-08

PARTIAL : carte fermée riche, Before miniatures+7, Au bar+13, lieu/montant, détails unités et mode/véhicule accessibles. Pas certification exhaustive contraste ni toutes touches.

IDs à couvrir (ne vaut pas preuve automatique) : R039, R040, R041, R042, R043, R044, R045, R046, R054, R055, R056, R057, R058, R060, R061, R062, R063, R064, R065, R068, R069, R070, R073, R076, R077, R078, R079, R080, R081, R082, R083, R084, R085, R087, R099, R101, R106, R108, R109, R110, R111, R113, R121, R126, R127, R130, R131.

IDs réellement clôturés dans cette campagne : R041, R043, R044, R045, R054, R109, R113, R121.

## Preuves

- closure/final-browser-results.json : observations exactes, rectangles, viewport réel, limites de mesure.
- closure/final-empty.json et final-empty-1152.png :245px vide, métadonnées sur bande commune.
- closure/final-dense-1440.png /1728/1920 : carte545px, aucune collision finale mesurée.
- closure/dense-stable-1152.png : **échec avant correctif**, Before masqué; ne pas prendre cette capture pour un après. Après correction, main overflowauto/scroll925 pour client720 et clic Before effectivement réussi; Bar/dock sans scroll.
- closure/final-folded-1920.png : synthèse riche655px, pas une promesse de compacité universelle.
- closure/final-place-1920.png : provenance locale visible.
- closure/save-error.png : ERROR local; PreviewFRESH constaté indépendamment.

Une mesure EMPTY a lu le mauvais onglet : exclue et remplacée par final-empty.json. Les contrôles de détails fermés ont provoqué des faux positifs dans le premier probe : second probe les exclut. Un clic pendant repacking a perdu son nœud; relecture puis reciblage réussi. Ce résultat ne certifie pas les transitions. Aucune latence produit n’est déduite du temps des outils.

## Auth C3-A

R335,R336,R337,R338,R348 : voir auth-save-diagnosis.md. NOT_RUN_AUTH, aucune session synthétique présentée comme JWT réel.

## Zoom natif effectivement exécuté

Ctrl+plus deux fois, DPR1,25 réellement lu, viewport CSS1280×720, carte dense565px, main overflowauto/scroll895/client720, zéro scroll Bar/dock et overflowXfalse. Capture/JSON final-native-zoom. Retour Ctrl+0 effectué. Ce test ne certifie pas toutes les scènes au zoom. Le réglage viewport réinitialise le zoom : seul le contrôle après touches natives est utilisé.
