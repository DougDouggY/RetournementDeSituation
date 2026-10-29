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
