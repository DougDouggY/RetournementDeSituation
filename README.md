# Retournement de situation

Un jeu de survie dans le navigateur : un tueur masqué en solo, huit invités et neuf minutes à tenir. La partie commence dans le jardin : infiltrez la maison et éliminez les invités isolés. La soirée reste calme jusqu’aux premiers bruits ; la chasse commence lorsqu’un invité découvre un corps, du sang ou confirme la présence d’un intrus masqué. DIAG et Swonni sont les deux personnages au choix. Le mode coopératif à deux est conservé pour une étape ultérieure. Première version jouable, en français, avec une villa 3D en coupe sur deux niveaux, sans sous-sol. Le serveur décide des mouvements, collisions, IA, interactions, captures et résultats. Aucun service d’un autre jeu n’est utilisé.

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

### Si les mises à jour GitHub ne déclenchent aucun build

Dans Settings → Builds, le bandeau « This project is disconnected from your Git account » signale que l’application GitHub Cloudflare n’a plus accès au dépôt. Le bouton Manage ouvre les autorisations GitHub : ajouter `DougDouggY/RetournementDeSituation` aux dépôts autorisés, puis enregistrer. Il est aussi possible d’autoriser tous ses dépôts, si c’est le périmètre souhaité pour Cloudflare. Après reconnexion, un nouvel envoi sur `main` permet de déclencher un build avec la dernière version du jeu.

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
| V | Escalader une fenêtre ouverte, pour entrer ou sortir |
| Espace | Éliminer un invité isolé à moins de 1,6 m |
| R | Prendre / déposer un corps à proximité ; déplacements ralentis en le traînant |
| E avec un corps près d’une cachette | Dissimuler le cadavre (R pour le ressortir) |
| Maintenir X 3 secondes, immobile | Nettoyer une petite zone de sang ; relâcher ou bouger annule la progression |
| Maintenir E 2,5 secondes | Détacher un partenaire capturé à proximité |
| F | Lampe torche |
| Maintenir G, puis relâcher | Afficher la trajectoire et charger la portée (maximum après 2 s, jusqu’à 12 m), puis lancer |
| Tab | État de l’équipe et rappel des règles |
| Échap | Paramètres (la nuit continue en ligne) |

Les étiquettes au sol identifient les pièces ; l’escalier principal se trouve dans le hall et l’escalier de service près de la cuisine. Les deux ont leur propre palier à l’étage. Approcher les bouteilles, réveils, télévisions et interrupteurs pour les utiliser. Éteindre la lampe et s’accroupir réduit la détection. Une cachette peut être fouillée : une entrée vue par un poursuivant est particulièrement dangereuse.

Les tueurs commencent dehors ; les huit invités sont répartis sans armes entre le grand salon (cinq) et la terrasse (trois). Un invité à la fois s’absente pour les toilettes, la cuisine ou les WC à l’étage, puis revient à la soirée. La porte ouest donne sur le couloir ; les six fenêtres du rez-de-chaussée se déverrouillent en maintenant E deux secondes. Les portes fermées et les murs masquent réellement les pièces voisines. Les six pièces du rez-de-chaussée ont chacune une vitre : en s’approchant à moins de trois mètres, face à la fenêtre, on peut observer sa pièce sans l’ouvrir. Les invités peuvent aussi voir à travers le verre si le joueur est dans leur champ de vision. E maintenu déverrouille le panneau inférieur, qui coulisse verticalement devant le panneau supérieur fixe ; V le franchit avec une animation de 0,85 seconde. Même ouvert, un encadrement de fenêtre bloque la marche normale : il faut escalader. Le passage nécessite un point d’arrivée libre et n’est pas possible en portant un corps. Une porte ouverte révèle une pièce adjacente seulement à proximité et sans obstacle entre le joueur et l’ouverture. La visibilité est recalculée, jamais conservée comme une carte explorée. Le jardin reste nocturne, mais des bornes lumineuses éclairent l’allée et le pourtour de la maison. Les vitres éclairées projettent une lueur sur le jardin et les pièces disposent d’un éclairage intérieur plus fort au départ. Le coffret extérieur près du garage coupe/rétablit le courant de toute la maison et de l’allée. Les interrupteurs locaux conservent leur réglage, sans pouvoir contourner la coupure générale ; les torches restent sur batterie.

Une élimination exige une cible à portée, sans autre invité vivant à moins de 6 m disposant d’une ligne de vue vers elle. Elle produit un corps, une flaque rouge et un bruit audible par les invités à portée. R permet de traîner le corps à vitesse réduite, avec une nouvelle trace tous les 40 cm environ ; déposer le corps ne nettoie ni la flaque ni les traces. Maintenir X immobile pendant trois secondes nettoie une zone de sang de 1,1 m autour de la trace visée, sans supprimer le corps. Les traces plus éloignées demandent un autre nettoyage. E près d’une cachette libre dissimule le corps traîné ; le sang reste, la cachette est occupée et R permet de reprendre le corps. On ne peut pas se cacher en portant un corps. Un petit bruit attire un invité, un bruit fort deux ; les incidents espacés augmentent progressivement l’inquiétude, le nombre de curieux (jusqu’à quatre) et les patrouilles (jusqu’à trois), sans armer immédiatement tout le monde. Un invité doit réellement voir le corps ou le sang pour déclencher cette alarme : les invités vivants s’arment et cherchent d’abord autour des indices, sans connaître automatiquement la position des joueurs. Ils possèdent un champ de vision directionnel, y compris à très courte distance. Un masque aperçu provoque une brève confrontation : s’enfuir, disparaître de sa vue ou rester plus de 2,5 secondes déclenche aussi l’alerte générale. Le dernier point réellement vu sert de départ à la recherche.

Le grand salon et deux chambres possèdent des décrochements ; le palier tourne autour d’un vide sur le hall. Les décrochements du couloir, sols, murs, collisions et zones de visibilité utilisent le même plan. Armoires, étagères, plans de travail et gros équipements sont adossés aux murs, avec accès aux cachettes et dégagement derrière les fenêtres.

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

Les 76 tests de logique vérifient notamment deux nuits simulées entières de neuf minutes (infiltration et chasse), les corps, leur déplacement, les traces, leur nettoyage, la dissimulation des corps, la soirée, les réactions graduées au bruit, le masque, les pièces en L et les témoins, le déclenchement physique de l’alarme, les entrées extérieures et le masquage des pièces, les huit agents sur les deux niveaux, chaque porte/escalier, l’accès aux cachettes, l’occlusion de la vision, l’audition, la poursuite, la capture, le sauvetage et les trois issues. Les tests navigateur vérifient les salons, les rôles, le clavier réel, la synchronisation, la lampe, les bruits, l’interface d’équipe et la reconnexion. Les artefacts des essais sont écrits dans `test-results/`, ignoré par Git. `npm run test:party` vérifie au clavier réel X (progression, annulation et nettoyage), R (transport), E (dissimulation) et R (reprise), dans une scène déterministe injectée uniquement par le test dans la réponse du Worker de développement. Pour vérifier le Durable Object local, lancer `npm run cf:dev`, puis dans un autre terminal `npm run test:cloudflare`.

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

- Deux niveaux, **13 pièces meublées et deux halls**, sans sous-sol, dans une enveloppe élargie à 50 × 32 mètres. Le plan comprend un grand salon avec décrochement, une salle à manger, une cuisine, un bureau, un WC/vestiaire, un garage/buanderie, quatre chambres et les sanitaires/lingerie à l’étage. Les deux escaliers, les pièces irrégulières et les portes-fenêtres utilisent la même géométrie dans le rendu et les collisions.
- Personnages procéduraux articulés, tenues et masques originaux. Les invités sont visuellement désarmés avant l’alarme ; leurs armes et lampes apparaissent au début de la chasse. Marche/course, accroupissement, interaction, blessure, capture, transitions de cachette et pose de victoire sont réalisés par animation procédurale ; pas de motion capture ni de cinématique montée.
- IA à cinq personnalités : vision directionnelle et occultée, audition atténuée, dernière position connue, coordination locale, inspection de cachettes et priorités de secteurs selon l’avancement de la nuit. Pas d’omniscience liée au temps passé caché.
- L’éclairage influence la portée visuelle par pièce, pas par lecture physique des pixels éclairés. Les étages hors écran continuent d’être simulés. Les pièces non visibles et leurs habitants/objets disparaissent. Les façades restent opaques depuis le jardin ; les murs hauts deviennent translucides à l’intérieur pour conserver la lisibilité.
- Bouteilles, TV, alarmes, disjoncteurs, portes bruyantes et accidents de course créent des diversions. Les meubles ne sont pas des corps rigides avec une simulation complète de chute ; aucune destruction physique générale.
- Sons originaux synthétisés et voix françaises par la synthèse vocale du navigateur, si disponible. Pas de doublage enregistré ni de chat vocal intégré.
- Optimisations : géométries statiques regroupées, géométries et matériaux réutilisés, éclairages limités et mode sans ombres. Les performances GPU sur les machines des joueurs restent à mesurer ; Chromium logiciel en environnement cloud n’est pas représentatif d’un GPU de jeu.
- Cible clavier/souris sur ordinateur. L’interface s’adapte aux petites fenêtres ; aucune commande tactile de jeu n’est implémentée.

Les ressources graphiques et les sons sont créés dans le code. Three.js, ws, Vite, Playwright et Wrangler conservent leurs licences respectives dans leurs paquets ; les polices Barlow Condensed et DM Sans sont distribuées localement sous SIL Open Font License.


## Mode observateur, enquêtes et plan de la villa

Le menu propose **Observer une partie · tueur IA**. Un tueur autonome utilise la même simulation et les mêmes collisions, coupe le courant, approche des invités isolés et tente de fuir pendant la chasse. Le spectateur voit toutes les pièces du niveau sélectionné, peut choisir le RDC ou l’étage, choisir un cadrage jardin + maison, maison seule ou suivi de l’IA, accélérer la simulation ×1/×2/×4 et mettre en pause avec les paramètres. Une lumière de lecture permet de suivre la scène même pendant une panne ; elle ne change pas la visibilité des IA. Le mode reste une première IA de démonstration, pas une stratégie optimale garantie.

En solo manuel, maintenir G affiche une trajectoire calculée avec les mêmes collisions que le lancer réel. La portée augmente de 2,5 à 12 mètres en deux secondes ; un mur ou un obstacle la raccourcit. La bouteille est consommée au relâchement et le bruit apparaît à l’impact, après le vol. La pause ou la perte de focus annule la préparation sans consommer de bouteille.

Les invités se tournent progressivement, au lieu de faire volte-face instantanément vers un bruit. Leur orientation à l’écran est celle utilisée pour leur champ de vision (environ 97° au total) ; le sang n’est plus automatiquement visible derrière eux à courte portée. Entendre derrière soi reste possible, voir derrière soi ne l’est pas. Les pièces éclairées sont plus lumineuses.

Un seul invité disponible est chargé de rejoindre le coffret réellement actionné et de le réparer pendant trois secondes, pendant l’infiltration ou la chasse. Sans preuve, l’inquiétude commence à décroître après 35 secondes sans nouvel incident et les patrouilles retournent à la soirée. L’absence prolongée d’un ami peut provoquer une recherche locale depuis son dernier emplacement vu, sans révéler un corps caché ni déclencher automatiquement une chasse. Une fenêtre ouverte, seule, n’est pas une preuve.

La page **/plans.html** montre maintenant le plan exact de la **villa jouable : RDC + un étage, sans sous-sol**. Le jardin comprend une terrasse de soirée, un bar avec bouteilles et une piscine. Le bassin est un obstacle : les acteurs doivent le contourner. Le vide sur le hall est entouré d’une rambarde et ne peut pas être traversé. Les SVG et la page sont régénérés depuis la carte par `npm run plans` ; les PNG de `public/plans/` sont les images de revue correspondantes. Les anciennes URL de proposition restent disponibles et affichent le plan désormais intégré.

`npm run test:observer` teste le mode autonome, la vue globale, les deux sélecteurs de niveau, la vitesse et la pause, puis la préparation de G, sa trajectoire visible, le relâchement et le bruit d’impact. Le test vérifie aussi les vues d’ensemble, du RDC et de l’étage, sans erreurs JavaScript/WebGL. Les données du mode observateur ne passent par aucun service de jeu externe.


## Version 0.6 : la nouvelle carte est intégrée

Les sols des pièces et des halls, les murs, les ouvertures, les obstacles, les emplacements de cachette et les lumières viennent des nouvelles empreintes. Les limites de déplacement englobent le jardin ; aucun objet, escalier ou but d’IA ne pointe vers un sous-sol supprimé. Les invités et le tueur IA choisissent les destinations de la villa ; les captifs sont escortés dans le nouveau garage. Plusieurs lampes éclairent les grandes pièces, et les interrupteurs locaux les commandent ensemble. Les WC, transats, bar, bassin, portes-fenêtres à deux vantaux et palier avec rambarde ont leur rendu correspondant.

Le test `tests/villa.test.js` vérifie spécifiquement les deux niveaux, l’absence de géométrie/destination au sous-sol, l’agrandissement, la couverture exacte des sols sans superposition ni trou, le contournement du bassin, les deux escaliers et leurs paliers appariés, les ouvertures des portes et les fenêtres, les trois groupes d’invités et l’accès au coffret extérieur. Les anciennes vérifications de gameplay ont été déplacées sur des positions valides de la nouvelle carte.

## Version 0.7 — stabilité et rythme

Le rendu utilise huit lumières de proximité et deux lueurs de fenêtres en nombre fixe : révéler une pièce ne change plus le nombre de lumières dans les shaders. La navigation réutilise les collisions statiques et une file de priorité pour réduire les recherches coûteuses. Salon, terrasse et lampe du joueur sont plus lumineux. Le mode observation accepte la molette (zoom progressif).

Une élimination coûte 40 d’énergie, impose trois secondes entre attaques et suspend la récupération pendant cinq secondes. Une fenêtre émet un grincement de portée 5 m, atténué par les obstacles et inaudible aux autres étages. L verrouille/déverrouille la porte proche depuis une pièce : elle se ferme, les invités ne peuvent plus l’ouvrir normalement, et le côté opposé ne peut pas la déverrouiller. Après 25 secondes, les invités à portée viennent vérifier ; après 45 secondes, le verrou cède. Les portes-fenêtres sont concernées, les fenêtres coulissantes utilisent toujours E/V.

## Version 0.8 — deux vues sur la même partie

Le menu propose « Solo · vue du dessus » et « Solo · première personne ». F2 ou le bouton « Changer de vue » commute sans redémarrer la nuit. Les deux vues utilisent exactement la même simulation : invités, bruit, détection, endurance, corps et sang, nettoyage, portes/verrous, fenêtres et escalade, bouteilles, courant, objectifs et fin de partie. L’observateur garde sa caméra du dessus.

En première personne, cliquer « regarder avec la souris » capture le pointeur ; Échap le libère et ouvre les paramètres. ZQSD/WASD et les flèches déplacent relativement au regard, Maj fait courir, C/Ctrl accroupit. La souris dirige le regard horizontalement et verticalement ; les touches E/L/F/V/Espace/R/X/G gardent leurs fonctions. Le joueur ne voit plus son propre modèle, les murs sont opaques et les pièces ont des plafonds. Le lancer conserve sa trajectoire affichée pendant la charge.

Les pièces reçoivent plusieurs appliques visibles sur leurs murs et leurs interrupteurs sont représentés à hauteur de main. Toutes les appliques d’une pièce suivent son interrupteur et la coupure générale. Le budget fixe de dix lumières ponctuelles est conservé. Les invités en discussion bougent les bras et la tête ; leurs déplacements et leurs sorties vers les toilettes/cuisine restent autoritaires. Les annonces de poursuite n’énoncent plus de barre oblique et une même phrase n’est pas répétée pendant 45 secondes ; une phrase en cours n’est plus interrompue par une autre.

`npm run test:fps` vérifie le parcours en première personne au clavier et à la souris, le verrouillage réel du pointeur, l’interrupteur de toutes les appliques du bureau et le passage F2 entre les deux caméras.

## Version 0.8.1 — soirée plus vivante

Les invités calmes alternent entre discussion, écoute, petite danse et verre à la main, avec des gestes distincts. Toutes les 9 à 19 secondes environ, ils peuvent se décaler de moins d’un mètre autour de leur place, sans quitter leur zone de fête ni traverser les meubles. Ces déplacements utilisent les collisions et les orientations de la simulation : leur champ de vision suit leur regard réel. Les sorties ordinaires vers les toilettes ou la cuisine restent limitées à une personne à la fois. Les nouvelles animations fonctionnent dans les deux vues et en observation.

## Version 0.8.2 — ambiance nocturne et portes entrouvertes

Les deux vues restent disponibles, avec bascule F2 pendant la même partie. En première personne, les lumières des autres pièces ne traversent plus les cloisons vers le joueur ; la lune et l’ambiance globale sont réduites à l’intérieur. Une pièce éteinte reste sombre, et la lampe suit aussi le regard vertical.

Les voix des invités diminuent progressivement avec la distance, sont atténuées par les murs et portes opaques et ne passent pas d’un étage à l’autre. Les sous-titres suivent la même proximité. Les pas sont plus discrets, avec des volumes distincts pour marche, course et accroupissement. La terrasse possède une boucle musicale originale synthétisée localement, une enceinte, des projecteurs muraux et deux guirlandes ; le courant coupe la musique et les éclairages de fête. Le réglage Musique contrôle cette boucle.

Les portes ordinaires sont opaques. **B** entrouvre la porte proche à 30° ou la referme ; **E** ouvre complètement une porte entrouverte. La fente et le panneau interviennent dans la vision et les collisions de la simulation, pour les deux vues ; une porte verrouillée reste verrouillée. Les fenêtres coulissantes et portes-fenêtres conservent leurs commandes. Les chaises, canapés, étagères, armoires et bureaux concernés sont orientés vers leur espace d’utilisation. L’interrupteur du bureau se trouve maintenant à côté du chambranle, sans prendre la priorité sur la porte.

Le déploiement Cloudflare existant conserve ses commandes et `wrangler.jsonc`.

## Version 0.8.3 — éclairage stable et observation avec E

Les pièces alimentées restent éclairées en permanence, même vues de loin par une fenêtre. Leur éclairage ambiant propre est indépendant de la proximité et de la direction de la caméra ; les interrupteurs et le coffret restent fonctionnels. En première personne, la géométrie intérieure est présente derrière les vitres à toute distance, tandis que les murs et portes opaques continuent de masquer ce qui se trouve derrière eux.

**Appuyer brièvement sur E** ouvre ou ferme une porte simple. **Maintenir E** entrouvre une porte fermée après 0,35 seconde et permet de regarder discrètement depuis la fente, sans déplacer le personnage ni traverser l’ouverture. **Relâcher E** referme immédiatement. Bouger ou ouvrir les paramètres annule l’observation. La touche B n’est plus utilisée. La discrétion vaut face aux invités de l’autre côté du battant, lampe éteinte ; un invité du même côté peut toujours voir le joueur. Une porte verrouillée ne peut pas être entrouverte.

Les portes simples mesurent maintenant un mètre de large et 2,7 mètres de haut. Les ouvertures des murs, encadrements, collisions et chemins utilisent la même nouvelle largeur. Les fenêtres et les grandes portes-fenêtres doubles gardent leurs dimensions et leurs commandes.
