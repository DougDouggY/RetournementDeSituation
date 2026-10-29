# Vérifications exécutées — 29 octobre 2026

Environnement : Linux, Node.js 24.19.0, Chromium système avec WebGL logiciel SwiftShader. Aucun déploiement distant effectué.

| Vérification | Résultat |
| --- | --- |
| `npm test` | 17 tests réussis, aucun échec ou test ignoré |
| Nuit entière simulée de 540 secondes | Huit IA, trois étages visités, aucune traversée d’obstacle ni téléportation hors escaliers |
| Navigation | Les 18 portes, les quatre transitions d’escalier et chaque accès de cachette vérifiés |
| Détection | Vision directionnelle, portes/murs/meubles opaques, accroupissement, obscurité et lampe vérifiés |
| Audition | Source réelle du bruit, atténuation par obstacles et isolation des étages vérifiées |
| Capture / sauvetage | Poursuite, attaque, capture, maintien de 2,5 secondes, immunité temporaire et élimination à 75 secondes vérifiés |
| Fin de manche | Défaite, victoire parfaite et victoire imparfaite vérifiées dans la simulation |
| `npm run build` | Compilation de production réussie |
| `npm run test:browser` | Deux contextes Chromium indépendants : salon privé, choix de rôles, porte, clavier réel, positions partagées, lampe, bouteille/bruit, interface Tab et reconnexion par rechargement |
| Manche complète dans les deux navigateurs | Manche de test de 25 secondes maximum ; même résultat autoritaire de défaite confirmé sur les deux clients lors du dernier essai de régression |
| Erreurs JavaScript / WebGL du parcours navigateur de production | Aucune |
| `wrangler deploy --dry-run` | Worker, assets et binding Durable Object assemblés ; aucune publication |
| Runtime Cloudflare local et `npm run test:cloudflare` | Création du salon, deux WebSocket dans le même Durable Object, lancement, mouvement autoritaire et lampe synchronisée vérifiés |
| Inspection visuelle | Captures des écrans d’accueil, du salon et de jeu dans Chromium |

Les premiers essais ont mis en évidence un chevauchement du formulaire de connexion sur une fenêtre de faible hauteur et des erreurs du canal de développement Vite. Le formulaire a été corrigé ; le serveur de développement utilise maintenant son propre canal HMR sur le même serveur HTTP. Les essais fonctionnels finaux portent sur les fichiers de **production**, sans client Vite injecté.

## Limites des vérifications

- La partie navigateur est raccourcie ; la durée normale de neuf minutes est testée dans la simulation, pas dans deux navigateurs pendant neuf minutes réelles.
- Le rendu WebGL logiciel cloud est lent : environ **1 image/seconde avec les deux navigateurs de test**. Les échanges réseau et la simulation serveur fonctionnent indépendamment. Ce résultat ne valide pas la fluidité graphique ; un essai sur les GPU des joueurs est indispensable avant de conclure sur les performances. Le mode performances réduit la résolution et désactive les ombres.
- Le compte Cloudflare, ses permissions, la connexion Internet de deux ordinateurs distants et une publication publique n’ont pas été testés.
- Le test Cloudflare utilise le runtime local Wrangler/workerd. Celui-ci a signalé l’absence des métadonnées réseau `Request.cf` de production ; il a démarré avec ses valeurs locales par défaut. Le jeu ne dépend pas de ces métadonnées.
- L’équilibrage sur de nombreuses parties avec deux joueurs humains et les performances à grande échelle restent à travailler.

Les rapports détaillés et captures sont générés dans `test-results/` (ignoré par Git). Les limites fonctionnelles de la première version sont décrites dans `README.md`.

## Ajout du mode solo

- Un seul personnage, DIAG ou Swonni, contre huit poursuivants ; introduction au singulier, capture fatale en solo et victoire solo distincte vérifiées dans les deux nouveaux tests de logique.
- Le site solo est compilé avec `npm run build:solo` et dispose d’une configuration de publication statique indépendante (`wrangler.solo.jsonc`).
- Aucune publication publique confirmée à ce stade : `wrangler whoami` rapporte une absence d’authentification Cloudflare. Les accès nécessaires sont déclarés dans les paramètres sécurisés de l’environnement.

Test navigateur solo réussi (`npm run test:solo`) : Swonni seul, huit chasseurs, sélection depuis l’accueil, pause/reprise et gel de l’horloge, lampe, porte et bouteille. Les appels `/api/**` étaient bloqués par le test : aucun appel API de jeu, aucun WebSocket et aucune erreur JavaScript/WebGL n’ont été observés. La régression à deux navigateurs du mode coopératif conservé passe également après le renommage en Swonni.

La tentative de publication réelle du mode solo a échoué avant toute publication, car Wrangler requiert `CLOUDFLARE_API_TOKEN` dans cet environnement non interactif. L’archive statique est prête pour un téléversement manuel alternatif.

## Infiltration nocturne et retournement après découverte

Les 31 tests de logique passent : 17 contrôles de régression et 14 contrôles d’infiltration. Les deux nuits complètes de neuf minutes exécutées dans la simulation couvrent séparément la chasse et la nouvelle soirée sans alarme. Les huit invités restent physiques sur les trois niveaux, sans traverser les obstacles ni se téléporter hors escaliers.

Vérifications nouvelles : départ solo/coop dehors ; portes extérieures avec collisions réelles ; fenêtres ouvertes par maintien de deux secondes et annulation du maintien ; visibilité limitée à la région actuelle et aux régions directement observables par les portes ouvertes ; fermeture qui remasque ; vision directionnelle même de près ; cible isolée et témoin masqué par un mur ; création du corps et de la flaque ; transport réel, ralentissement, dépose et traces permanentes ; découverte d’un indice visible qui arme les invités et cible l’indice, pas le joueur ; pas d’alarme sur un indice derrière un mur ou dans le dos ; victoire par élimination du dernier invité et par survie ; remise à zéro ; limitation des répliques.

Le test navigateur solo passe avec les API de jeu bloquées : départ dans le jardin avec huit invités, aucun invité rendu à travers les pièces fermées, pause/reprise, déplacement au clavier vers la porte d’entrée, ouverture qui révèle le couloir, lampe et bouteille. Aucun appel API de jeu ni WebSocket, aucune erreur JavaScript/WebGL. Captures inspectées : `test-results/infiltration-outside.png` et `test-results/infiltration-entry.png`. Les éliminations et le transport des corps sont vérifiés par la simulation ; le parcours navigateur ne prétend pas avoir reproduit ces actions manuellement.

La lecture de l’URL publique fournie par l’utilisateur est refusée par le proxy réseau de cet environnement (HTTP CONNECT 403). Cela ne démontre pas une panne du site Cloudflare et empêche de confirmer ici l’activation distante d’une nouvelle version. La vérification locale et la confirmation de l’envoi GitHub sont distinctes du déploiement public.

La régression navigateur coopérative de la version 0.2 passe : deux clients indépendants, départ dans le jardin, entrée ouest synchronisée, mouvement, lampe, bouteille, reconnexion et victoire parfaite à la fin de la manche de test de 25 secondes. Aucune erreur JavaScript ou WebGL. Le solo publié reste à un seul personnage.

## Déploiement simplifié pour les réglages Cloudflare existants

La capture du tableau de bord indique `npm run build` puis `npx wrangler deploy`. Ces commandes sont désormais les valeurs par défaut du solo : compilation en mode solo et Worker statique nommé `retournement-de-situation-solo`. La configuration coopérative reste dans `wrangler.coop.jsonc`, avec les scripts explicites `build:coop` et `deploy:coop`. Vérifications : compilation par la commande exacte du tableau de bord, assemblage `wrangler deploy --dry-run` sans bindings, et test navigateur solo avec les API bloquées.

## Version 0.3 : fenêtres, éclairage et nouveau plan

Les tests de logique sont portés à 42. Les anciennes vérifications de portes/murs ont été repositionnées sur les nouvelles cloisons, sans désactiver leurs assertions. Les dimensions et limites de chaque meuble sont vérifiées sur les 18 pièces ; les deux nuits simulées complètes restent couvertes.

Nouveaux contrôles : six fenêtres associées aux six pièces du rez-de-chaussée ; zones d’arrivée libres des deux côtés ; observation à travers une vitre fermée à proximité, et masquage en s’éloignant ; distinction entre visibilité et collision physique du verre ; refus des attaques et des prises de corps au travers de la vitre ; marche toujours bloquée, escalade réservée à V après déverrouillage ; progression/hauteur de l’animation et retour par la même fenêtre ; refus de l’escalade à distance ou les mains occupées ; coupure générale par le coffret extérieur et celui du sous-sol, réglages locaux préservés et impossibilité de contourner une panne par un interrupteur ; influence de la panne sur la vision des invités ; fenêtres laissées fermées par les IA qui passent à proximité.

Le rendu comprend six bornes d’allée, des vitrages à cadres, des lueurs au sol, un éclairage intérieur renforcé et des façades qui s’effacent localement pour l’observation. Les classes de matériaux et les géométries sont réutilisées ; seules deux lumières de fenêtres proches sont actives à la fois.

Le test navigateur de la version 0.3 passe sur le vrai build solo, sans appels d’API de jeu ni WebSocket et sans erreur JavaScript/WebGL : lumières de l’allée au départ, ouverture de l’entrée, déplacement au coffret au clavier, extinction/rétablissement effectif des intensités des lampes de pièces et d’allée et de l’émission des vitres, observation du bureau à travers sa vitre encore fermée, maintien E jusqu’au déverrouillage puis V pour entrer et V pour ressortir. Les captures `power-off.png`, `window-scouting.png` et `window-inside.png` ont été inspectées. Le test ne remplace pas un essai de performances sur le GPU du joueur.

Un contrôle supplémentaire couvre l’approche d’une fenêtre en biais : son propre vitrage ne doit pas empêcher son déverrouillage, tout en conservant l’occlusion des murs et des autres obstacles. Les changements de touche envoient désormais immédiatement les commandes, sans attendre la prochaine image.

La coupure de courant réduit aussi la portée de découverte du sang par les invités non armés, en plus de la détection des joueurs. La régression à deux navigateurs passe sur la version 0.3 : salon, rôles, entrée, mouvements, lampe et bruit synchronisés, reconnexion et victoire parfaite à l’issue de la manche de test raccourcie.

## Version 0.4 : soirée, indices effaçables et inquiétude progressive

Les **52 tests de logique passent**, dont dix nouveaux tests sur la soirée initiale, la sortie ordinaire d’un seul invité à la fois, le nombre limité de curieux selon le bruit, les patrouilles ajoutées après plusieurs incidents, le bruit réel d’une élimination, le nettoyage continu pendant trois secondes et son annulation, l’impossibilité de nettoyer à travers une vitre ou en traînant un corps, la dissimulation/reprise d’un corps, la réaction au masque (fuite, perte de vue ou confrontation prolongée), les pièces en L et la remise à zéro. Les deux simulations de neuf minutes, l’accès aux cachettes, les fenêtres et les collisions restent couverts.

`npm run test:party` passe dans Chromium avec les vraies commandes X, R et E : progression visible, annulation du nettoyage au relâchement, suppression du sang, transport, dissimulation et reprise du corps. La scène déterministe est injectée uniquement dans la réponse du Worker de développement interceptée par Playwright ; aucun contrôle de test n’est exposé dans le jeu publié. Aucun message d’erreur JavaScript/WebGL. Capture inspectée : `test-results/party-clean-stash.png`.

Le parcours du build solo passe aussi, sans API de jeu ni WebSocket : départ dans le jardin, pause, porte, bouteille, coupure/rétablissement du courant, observation par la vitre fermée, déverrouillage, déplacement vertical du panneau inférieur sans rotation, escalade dans les deux sens. Deux premiers parcours en rendu logiciel dépassaient l’alignement de la fenêtre à cause du délai entre images et commandes ; la résolution du test a été réduite à 800 × 600 et le suivi de la position utilise un intervalle de 50 ms. Le parcours final passe. Cela ne constitue pas une mesure de performances sur le GPU du joueur.

La régression à deux contextes Chromium passe également : salon privé, personnages distincts, portes/mouvements/lampe/bruit synchronisés, reconnexion sans doublon et fin de manche identique sur les deux clients. La manche accélérée de cette version se termine en défaite après détection des joueurs ; ce contrôle ne garantit pas une victoire. Le rendu logiciel observé reste lent (0–2 images/s selon le contexte) et ne représente pas un essai sur carte graphique.

## Version 0.5 : plans, observateur et enquêtes temporaires

Les **62 tests de logique passent**. Dix nouveaux contrôles couvrent la préparation et le plafond de portée d’une bouteille, la concordance entre prévision et point d’impact, le bruit différé jusqu’à l’impact, l’annulation sans consommation, la rotation progressive vers un son derrière soi, le refus de détecter le joueur ou du sang dans son dos, le déplacement réel d’un seul réparateur et les trois secondes au coffret, la réparation pendant la chasse, le retour au calme après une enquête sans preuve, la recherche d’un ami absent depuis un endroit mémorisé, l’absence de panique sur une fenêtre ouverte et un tueur autonome qui se déplace sans franchir les collisions avant de réussir une élimination.

`npm run test:observer` passe dans Chromium : lancement du tueur IA depuis le menu, toutes les pièces du niveau révélées, sélection des trois niveaux, vitesse ×4, pause/reprise, première élimination autonome ; puis lancement manuel, maintien G avec trajectoire visible sans consommation, relâchement qui consomme une bouteille et bruit à l’impact. Les onglets du plan actuel et de la proposition chargent leurs SVG sans erreur. Aucun message d’erreur JavaScript/WebGL. Le mode observateur possède une lumière de lecture indépendante du courant simulé ; elle est absente du mode manuel. Capture vérifiée : `observer-global.png`. La trajectoire a été inspectée sur `bottle-aim.png`.

Le parcours solo existant passe également : départ au jardin, pause, entrée, bouteille, coffret extérieur, extinction/rétablissement des éclairages de pièces/jardin/vitres, observation du bureau derrière le verre, ouverture coulissante et escalade aller/retour. Il reste sans API de jeu ni WebSocket.

Les plans SVG/PNG de `public/plans/` sont des artefacts de revue : le plan actuel reprend les coordonnées des pièces, murs, portes, fenêtres, meubles et escaliers du jeu. La proposition RDC + un étage avec piscine n’est pas une carte implémentée et ne modifie pas les niveaux actuels. Le script `scripts/generate-plans.mjs` produit les SVG et la page de comparaison. Les images ont été rendues dans Chromium et inspectées.

La régression coopérative à deux contextes passe sur cette version : salon privé, rôles distincts, portes, déplacements, lampe, inventaire et bruit de bouteille synchronisés, reconnexion sans doublon, puis victoire parfaite identique à l’issue de la manche accélérée de 25 secondes. Le rendu logiciel observé (environ 2 images/s) ne représente pas les performances sur le GPU du joueur.
