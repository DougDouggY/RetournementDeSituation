# Retournement de situation

Un jeu de survie dans le navigateur : un tueur masqué en solo, huit invités et neuf minutes à tenir. La partie commence dans le jardin : infiltrez la maison et éliminez les invités isolés. La chasse ne commence que lorsqu’un invité voit un corps ou du sang. DIAG et Swonni sont les deux personnages au choix. Le mode coopératif à deux est conservé pour une étape ultérieure. Première version jouable, en français, avec une maison 3D en coupe sur trois niveaux. Le serveur décide des mouvements, collisions, IA, interactions, captures et résultats. Aucun service d’un autre jeu n’est utilisé.

## Lancer en développement

Prérequis : **Node.js 22.12 ou plus récent** (validé avec Node 24), npm et un navigateur avec WebGL2 et accélération graphique.

```sh
npm ci
npm run dev
```

Ouvrir l’adresse indiquée par Vite sur le port **5173**. Choisir **DIAG** ou **Swonni**, puis **Jouer en solo**. Aucun salon ni code n’est nécessaire. Pour la coopération ultérieure, déplier « Coopération à deux », créer un salon, transmettre le code, choisir les personnages et lancer. Les deux navigateurs doivent accéder **au même serveur**. En local, deux onglets ou deux navigateurs permettent de tester. Le solo exécute la même carte et les mêmes IA dans un Web Worker local, sans requête de jeu au serveur. Il contient exactement un tueur, pas de partenaire artificiel. Une capture termine la partie, survivre jusqu’à l’aube donne une victoire solo. Les paramètres et un onglet masqué mettent la simulation solo en pause.

Pour jouer depuis deux ordinateurs sur Internet, déployer le Worker ci-dessous ou héberger ce serveur Node derrière un reverse proxy HTTPS prenant en charge les WebSocket. Un serveur lancé sur votre ordinateur n’est pas automatiquement accessible sur Internet.

## Worker Cloudflare connecté à GitHub (configuration de l’utilisateur)

Conserver les commandes déjà configurées dans Cloudflare : **Build command** `npm run build` ; **Deploy command** `npx wrangler deploy` ; **Root directory** `/` ; branche `main`. Le build par défaut produit maintenant le solo et `wrangler.jsonc` cible le Worker statique **retournement-de-situation-solo**. Aucun changement de menu ni jeton supplémentaire dans le chat n’est nécessaire. Après l’envoi GitHub, un nouveau build doit se lancer si les déploiements automatiques de `main` sont activés.

## Publier le solo depuis GitHub sur Cloudflare Pages

Le dépôt GitHub est `DougDouggY/RetournementDeSituation` ; utiliser la branche **main**. Dans Cloudflare, créer un projet **Pages**, choisir la connexion GitHub puis ce dépôt.

| Paramètre Pages | Valeur |
| --- | --- |
| Branche de production | `main` |
| Préréglage du framework | Aucun |
| Commande de compilation | `npm run build:solo` |
| Dossier de sortie | `dist` |
| Dossier racine | Racine du dépôt (laisser vide) |
| Variable d’environnement | `NODE_VERSION` = `24` |

Cloudflare installe les dépendances et compile le site ; ne pas ajouter une commande `wrangler deploy` au build Pages. Le solo n’utilise aucune API de jeu, aucun Durable Object ni aucun secret côté navigateur. Une fois le déploiement réussi, ouvrir l’adresse `.pages.dev`, choisir DIAG ou Swonni puis **Jouer en solo**. Chaque mise à jour de `main` déclenche ensuite une nouvelle compilation Pages. Pour un projet Workers déjà configuré, utiliser plutôt les instructions Workers ci-dessus et conserver ses commandes existantes.

## Publier le solo pour le tester

```sh
npm run test:solo
npm run deploy:solo
```

`deploy:solo` compile le mode solo puis publie uniquement les fichiers statiques via `wrangler.jsonc` (la configuration `wrangler.solo.jsonc` reste compatible), sous le nom dédié **retournement-de-situation-solo**. Aucun Durable Object et aucune ressource du multijoueur ne sont requis. L’interface publiée masque les commandes coopératives ; les noms sont **DIAG** et **Swonni**. L’URL HTTPS réelle est fournie par Wrangler après une publication réussie.

La publication nécessite un compte Cloudflare authentifié. Dans cet environnement, `wrangler whoami` a confirmé qu’aucune session n’est connectée. Les besoins `CLOUDFLARE_API_TOKEN` (secret, destination `api.cloudflare.com`) et `CLOUDFLARE_ACCOUNT_ID` (non secret) sont déclarés dans le brouillon de configuration. Renseigner ces valeurs dans les paramètres sécurisés de l’environnement, jamais dans le chat ni les fichiers du dépôt. Utiliser un jeton limité au compte cible avec les droits nécessaires pour publier des Workers et leurs assets (Workers Scripts Edit et lecture des paramètres du compte). Sur son poste, `npx wrangler login` est une alternative à ce jeton.

L’archive `retournement-de-situation-solo.zip` contient le site statique : elle peut également être téléversée manuellement dans un nouveau projet Cloudflare Pages via l’interface Direct Upload. Le contenu de `index.html`, `assets/`, `licenses/` et `favicon.svg` doit se trouver à la racine du déploiement. Un double-clic sur `index.html` n’est pas un lancement pris en charge : le jeu et son Web Worker nécessitent un serveur HTTP/HTTPS.

## Commandes

| Commande | Action |
| --- | --- |
| ZQSD, WASD ou flèches | Se déplacer |
| Souris | Orienter le personnage et sa lampe |
| Maj | Courir (endurance limitée, bruit audible) |
| Ctrl ou C | S’accroupir |
| E | Porte, cachette, escalier, interrupteur ou objet à proximité |
| Maintenir E 2 secondes | Déverrouiller discrètement une fenêtre extérieure |
| Espace | Éliminer un invité isolé à moins de 1,6 m |
| R | Prendre / déposer un corps à proximité ; déplacements ralentis en le traînant |
| Maintenir E 2,5 secondes | Détacher un partenaire capturé à proximité |
| F | Lampe torche |
| G | Lancer une bouteille vers la souris (trois, rechargeables dans les pièces) |
| Tab | État de l’équipe et rappel des règles |
| Échap | Paramètres (la nuit continue en ligne) |

Les étiquettes au sol identifient les pièces ; les escaliers sont aux deux extrémités du couloir. Approcher les bouteilles, réveils, télévisions et interrupteurs pour les utiliser. Éteindre la lampe et s’accroupir réduit la détection. Une cachette peut être fouillée : une entrée vue par un poursuivant est particulièrement dangereuse.

Les tueurs commencent dehors ; les huit invités se déplacent sans armes dans la maison. La porte ouest donne sur le couloir ; la fenêtre nord du salon et celle du garage s’ouvrent en maintenant E deux secondes. Les portes fermées et les murs masquent réellement les pièces voisines. Une porte ouverte révèle une pièce adjacente seulement à proximité et sans obstacle entre le joueur et l’ouverture. La visibilité est recalculée, jamais conservée comme une carte explorée. L’éclairage général est nocturne, avec quelques lampes locales et les torches.

Une élimination exige une cible à portée, sans autre invité vivant à moins de 6 m disposant d’une ligne de vue vers elle. Elle produit un corps et une flaque rouge permanente. R permet de traîner le corps à vitesse réduite, avec une nouvelle trace tous les 40 cm environ ; déposer le corps ne nettoie ni la flaque ni les traces. On ne peut pas se cacher en portant un corps. Un invité doit réellement voir le corps ou le sang pour déclencher l’alarme : les invités vivants s’arment et cherchent d’abord autour des indices, sans connaître automatiquement la position des joueurs. Ils possèdent un champ de vision directionnel, y compris à très courte distance.

Éliminer le dernier invité gagne immédiatement la manche ; survivre jusqu’à l’aube demeure une autre victoire possible. Après l’alarme, Trois coups entraînent une capture. Un survivant escorte physiquement le prisonnier vers le garage ; son partenaire peut le détacher pendant le trajet ou à destination. Il dispose de **75 secondes** avant l’élimination. Deux joueurs capturés/éliminés mettent fin à la manche. À l’aube : deux joueurs libres = victoire parfaite ; un seul = victoire imparfaite.

Une déconnexion suspend la nuit pendant 45 secondes pour permettre la reconnexion. Recharger la page puis rejoindre le même code depuis le même onglet restaure son personnage. Une connexion concurrente avec la même session est refusée. Après le délai, le joueur absent est éliminé ; une panne ou un redémarrage du serveur fait expirer les parties en mémoire.

## Cloudflare Workers et Durable Objects

Le fichier `wrangler.coop.jsonc` définit un Worker coopératif **retournement-de-situation**, un binding `ROOMS`, une classe `GameRoom` et sa propre migration SQLite. Les fichiers statiques compilés sont servis par Workers Assets. Chaque salon dispose de sa propre autorité Durable Object. Aucun jeton n’est envoyé au client.

Pour servir les fichiers compilés avec Node : `npm run build` puis `npm start` (port 5173, HTTP et WebSocket).

```sh
npm run cf:dev        # build puis exécution avec le runtime Cloudflare local
npm run deploy:coop  # build coop puis publication sur VOTRE compte Cloudflare
```

Avant un déploiement réel, s’authentifier avec `npx wrangler login` sur son poste, ou fournir les identifiants Cloudflare par un mécanisme sécurisé adapté au CI. Les droits Workers et Durable Objects sont nécessaires. Si ce nom de Worker existe déjà dans votre compte, choisir **un nouveau nom dédié à ce jeu** avant publication afin de ne rien écraser. Vérifier le compte sélectionné et les coûts des Durable Objects actifs : la simulation reste en mémoire avec une boucle à 20 Hz et ne met pas les sockets en hibernation. Les salons sans connexion sont supprimés après cinq minutes. L’arrêt d’un acteur n’est pas une sauvegarde de manche.

Après publication, partager l’URL HTTPS réellement fournie par Wrangler et un code de salon. Le code est une invitation privée ; ne le publier pas. Les deux ordinateurs n’ont pas besoin d’être sur le même réseau.

Aucun déploiement sur un compte Cloudflare distant n’est effectué par les tests. Le test `--dry-run` vérifie l’assemblage, pas les permissions du compte ni le comportement du réseau public. Il reste à vérifier une partie depuis deux ordinateurs après publication.

## Validation

```sh
npm test                   # logique, carte et protocole de salon
npm run build              # assets de production
npm run test:browser        # deux contextes Chromium indépendants
npm run test:solo           # vrai solo sans API ni WebSocket
npx wrangler deploy --dry-run
```

Le test navigateur utilise `/usr/bin/chromium` par défaut. Définir `CHROMIUM_PATH` si nécessaire, ou installer Chromium et adapter cette variable. Le runner crée son propre serveur de test sur **5174**, exécute une manche complète **raccourcie à 25 secondes**, vérifie les deux clients et ferme ses processus. Le jeu normal conserve neuf minutes. `RDS_NIGHT_SECONDS` est uniquement une surcharge de durée du serveur Node ; elle n’expose aucune commande de triche côté client et ne concerne pas le Worker de production.

Les 31 tests de logique vérifient notamment deux nuits simulées entières de neuf minutes (infiltration et chasse), les corps, leur déplacement, les traces permanentes, les témoins, le déclenchement physique de l’alarme, les entrées extérieures et le masquage des pièces, les huit agents sur les trois niveaux, chaque porte/escalier, l’accès aux cachettes, l’occlusion de la vision, l’audition, la poursuite, la capture, le sauvetage et les trois issues. Les tests navigateur vérifient les salons, les rôles, le clavier réel, la synchronisation, la lampe, les bruits, l’interface d’équipe et la reconnexion. Les artefacts des essais sont écrits dans `test-results/`, ignoré par Git. Pour vérifier le Durable Object local, lancer `npm run cf:dev`, puis dans un autre terminal `npm run test:cloudflare`.

## Architecture

- `shared/map.js` : carte déterministe, obstacles, objets, visibilité et navigation A*.
- `shared/simulation.js` : logique autoritaire indépendante du moteur de rendu.
- `server/room.js` : salons à deux places, sessions, protocole et reconnexions.
- `server/local.js` : serveur de développement Node/WebSocket + Vite.
- `server/worker.js` : adaptation Cloudflare Workers/Durable Objects.
- `src/scene.js` : scène Three.js, personnages articulés, meubles, ombres, portes et interpolation.
- `src/solo-worker.js` : simulation solo locale, indépendante du rendu.
- `src/main.js` : écrans français, saisie, réseau, affichage et paramètres.
- `src/audio.js` : sons synthétisés originaux et voix du navigateur.

La simulation tourne à 20 Hz et diffuse à 10 Hz. Les trajectoires sont interpolées par le rendu. Les entrées sont bornées, le nombre de joueurs limité à deux, les origines WebSocket contrôlées et les messages limités en taille/fréquence. Ceci reste une première version : avant une ouverture publique large, ajouter une limitation distribuée de création de salons, une politique d’expiration/persistance plus avancée et des métriques de charge.

## Périmètre et limites de cette version

- Trois niveaux, **18 pièces meublées et trois couloirs**. Les cachettes, portes et escaliers fonctionnent ; le plan n’inclut pas encore toutes les pièces de la liste de conception initiale.
- Personnages procéduraux articulés, tenues et masques originaux. Les invités sont visuellement désarmés avant l’alarme ; leurs armes et lampes apparaissent au début de la chasse. Marche/course, accroupissement, interaction, blessure, capture, transitions de cachette et pose de victoire sont réalisés par animation procédurale ; pas de motion capture ni de cinématique montée.
- IA à cinq personnalités : vision directionnelle et occultée, audition atténuée, dernière position connue, coordination locale, inspection de cachettes et priorités de secteurs selon l’avancement de la nuit. Pas d’omniscience liée au temps passé caché.
- L’éclairage influence la portée visuelle par pièce, pas par lecture physique des pixels éclairés. Les étages hors écran continuent d’être simulés. Les pièces non visibles et leurs habitants/objets disparaissent. Les façades restent opaques depuis le jardin ; les murs hauts deviennent translucides à l’intérieur pour conserver la lisibilité.
- Bouteilles, TV, alarmes, disjoncteurs, portes bruyantes et accidents de course créent des diversions. Les meubles ne sont pas des corps rigides avec une simulation complète de chute ; aucune destruction physique générale.
- Sons originaux synthétisés et voix françaises par la synthèse vocale du navigateur, si disponible. Pas de doublage enregistré ni de chat vocal intégré.
- Optimisations : géométries statiques regroupées, géométries et matériaux réutilisés, éclairages limités et mode sans ombres. Les performances GPU sur les machines des joueurs restent à mesurer ; Chromium logiciel en environnement cloud n’est pas représentatif d’un GPU de jeu.
- Cible clavier/souris sur ordinateur. L’interface s’adapte aux petites fenêtres ; aucune commande tactile de jeu n’est implémentée.

Les ressources graphiques et les sons sont créés dans le code. Three.js, ws, Vite, Playwright et Wrangler conservent leurs licences respectives dans leurs paquets ; les polices Barlow Condensed et DM Sans sont distribuées localement sous SIL Open Font License.
